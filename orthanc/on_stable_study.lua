-- =============================================================
-- Module 2 — Notification automatique au Module 1 (SIH/RIS)
-- Callback déclenché par Orthanc quand une étude DICOM est
-- considérée stable (StableAge secondes après le dernier upload).
-- =============================================================

function OnStableStudy(studyId, tags, metadata)
  -- Récupérer les informations principales de l'étude
  local study = ParseJson(RestApiGet('/studies/' .. studyId))
  local mainTags = study['MainDicomTags']

  local studyInstanceUID = mainTags['StudyInstanceUID']
  local accessionNumber  = mainTags['AccessionNumber']

  if accessionNumber == nil or accessionNumber == '' then
    print('[Module2] Pas d AccessionNumber sur l etude ' .. studyId .. ' — notification ignoree')
    return
  end

  print('[Module2] ============================================')
  print('[Module2] Etude stable detectee : ' .. studyInstanceUID)
  print('[Module2] AccessionNumber       : ' .. accessionNumber)
  print('[Module2] OrthancStudyID        : ' .. studyId)

  -- 1. Authentification JWT auprès du backend Module 1
  local authBody = '{"username":"modality_ct","password":"demo"}'
  local authHeaders = { ['Content-Type'] = 'application/json' }

  local authSuccess, authResp = pcall(function()
    return HttpPost('http://backend:8000/api/v1/auth/login/', authBody, authHeaders)
  end)

  if not authSuccess or authResp == nil then
    print('[Module2] ERREUR : Impossible de contacter le backend pour authentification')
    return
  end

  local tokens = ParseJson(authResp)
  local jwt = tokens['access']

  if jwt == nil then
    print('[Module2] ERREUR : Token JWT non recu — verifiez le compte modality_ct')
    return
  end

  print('[Module2] Authentification reussie — token obtenu')

  -- 2. Chercher l'examen correspondant dans la worklist du Module 1
  local wlHeaders = {
    ['Authorization'] = 'Bearer ' .. jwt,
    ['Content-Type'] = 'application/json'
  }

  local wlSuccess, wlResp = pcall(function()
    return HttpGet('http://backend:8000/api/v1/worklist/?status=PLANIFIE', wlHeaders)
  end)

  if not wlSuccess or wlResp == nil then
    print('[Module2] ERREUR : Impossible d interroger la worklist')
    return
  end

  local worklist = ParseJson(wlResp)
  local examId = nil

  for _, item in ipairs(worklist) do
    if item['AccessionNumber'] == accessionNumber then
      examId = item['ExamID']
      break
    end
  end

  if examId == nil then
    print('[Module2] Examen non trouve dans la worklist pour AccessionNumber=' .. accessionNumber)
    print('[Module2] L examen n est peut-etre pas au statut PLANIFIE ou l AccessionNumber ne correspond pas')
    return
  end

  print('[Module2] Examen trouve : ExamID=' .. examId)

  -- 3. Appeler mark-performed pour basculer PLANIFIE → REALISE
  local markBody = '{"study_instance_uid":"' .. studyInstanceUID .. '","notes":"Acquisition PACS auto-detectee via Orthanc OnStableStudy (Lua callback)"}'

  local markSuccess, markResp = pcall(function()
    return HttpPost(
      'http://backend:8000/api/v1/exams/' .. examId .. '/mark-performed/',
      markBody, wlHeaders
    )
  end)

  if markSuccess and markResp ~= nil then
    print('[Module2] Notification envoyee au Module 1 — examen marque REALISE')
    print('[Module2] Reponse : ' .. markResp)
  else
    print('[Module2] ERREUR lors de l appel mark-performed')
  end

  print('[Module2] ============================================')
end

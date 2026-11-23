import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import PriorityBadge from '../components/PriorityBadge';
import DicomViewer from '../components/DicomViewer';
import {
  HardDrive, RefreshCw, Eye, Upload, Database,
  AlertCircle, CheckCircle2, Image, ExternalLink, Zap,
  Film, FolderArchive
} from 'lucide-react';

export default function PacsConsole() {
  const [activeTab, setActiveTab] = useState('worklist'); // 'worklist' | 'studies' | 'viewer' | 'upload'
  const [worklist, setWorklist] = useState([]);
  const [studies, setStudies] = useState([]);
  const [pacsInfo, setPacsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected study for the integrated viewer
  const [selectedStudyUID, setSelectedStudyUID] = useState(null);
  const [selectedStudyTitle, setSelectedStudyTitle] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const fetchWorklist = async () => {
    try {
      const res = await api.get('/worklist/?status=PLANIFIE');
      setWorklist(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setWorklist([]);
    }
  };

  const fetchStudies = async () => {
    try {
      const res = await api.get('/pacs/studies/');
      setStudies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setStudies([]);
    }
  };

  const fetchPacsInfo = async () => {
    try {
      const res = await api.get('/pacs/info/');
      setPacsInfo(res.data);
    } catch {
      setPacsInfo(null);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError('');
    await Promise.all([fetchWorklist(), fetchStudies(), fetchPacsInfo()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleSync = async (examId = null) => {
    setSyncing(true);
    setError('');
    try {
      const payload = examId ? { exam_id: examId } : {};
      const res = await api.post('/pacs/sync/', payload);
      setSuccessMsg(res.data.message || 'Synchronisation PACS réussie !');
      setTimeout(() => setSuccessMsg(''), 5000);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la synchronisation PACS.');
    } finally {
      setSyncing(false);
    }
  };

  const openInViewer = (studyUID, title = '') => {
    setSelectedStudyUID(studyUID);
    setSelectedStudyTitle(title);
    setActiveTab('viewer');
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadResult(null);
    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        await api.post('/pacs/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded++;
      } catch {
        failed++;
      }
    }

    setUploading(false);
    setUploadResult({ uploaded, failed });
    setSuccessMsg(`${uploaded} fichier(s) DICOM envoyé(s) au PACS.`);
    setTimeout(() => setSuccessMsg(''), 5000);
    await refreshAll();
  };

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="Module 2 — Imagerie médicale"
        title="Console PACS"
        description="Gestion du stockage Orthanc, consultation des examens et visualiseur OHIF intégré."
        icon={HardDrive}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSync()}
              disabled={syncing || loading}
              className="app-button-primary inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[11px] font-medium text-white shadow-sm disabled:opacity-50"
            >
              <Zap className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronisation en cours…' : 'Synchroniser PACS ↔ RIS'}
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading || syncing}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#DCE6EF] bg-white px-3 text-[11px] font-medium text-[#54687A] transition hover:border-[#B9D2EA] hover:bg-[#F3F8FC] hover:text-[#1566C0] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        }
      />

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          {error}
        </div>
      )}

      {/* Stats PACS */}
      {pacsInfo && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Patients indexés', value: pacsInfo.CountPatients || 0, icon: '👤' },
            { label: 'Études dans le PACS', value: pacsInfo.CountStudies || 0, icon: '📋' },
            { label: 'Séries d’images', value: pacsInfo.CountSeries || 0, icon: '🗂️' },
            { label: 'Instances DICOM', value: pacsInfo.CountInstances || 0, icon: '🖼️' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-[#DCE6EF] bg-white p-4 text-center shadow-xs">
              <div className="text-2xl">{stat.icon}</div>
              <div className="mt-1 text-[22px] font-bold text-[#0F2233]">{stat.value}</div>
              <div className="text-[11px] text-[#71869A]">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Onglets de navigation */}
      <div className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-[#DCE6EF] bg-white p-1.5 shadow-[0_6px_24px_rgba(21,102,192,0.05)]">
        <button
          type="button"
          onClick={() => setActiveTab('worklist')}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'worklist'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC]'
          }`}
        >
          <Database className="w-4 h-4" />
          Worklist DICOM ({worklist.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('studies')}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'studies'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC]'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          Études archivées dans le PACS ({studies.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('viewer')}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'viewer'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC]'
          }`}
        >
          <Film className="w-4 h-4 text-[#1566C0]" />
          Visualiseur OHIF (Iframe intégrée)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'upload'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC]'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload DICOM
        </button>
      </div>

      {/* ONGLET 1: WORKLIST DICOM */}
      {activeTab === 'worklist' && (
        <div className="app-panel overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-[12px] text-[#71869A]">
              <span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-[#DCE6EF] border-t-[#1566C0]" />
              Chargement de la worklist…
            </div>
          ) : worklist.length === 0 ? (
            <div className="p-14 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
              <p className="text-[14px] font-semibold text-[#0F2233]">Worklist vide</p>
              <p className="mt-1 text-[11px] text-[#71869A]">
                Tous les examens planifiés ont été acquis ou synchronisés avec le PACS.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="app-data-table min-w-full border-collapse text-[12px]">
                <thead className="bg-[#EEF4FA] text-left text-[11px] font-medium text-[#54687A]">
                  <tr className="h-10">
                    <th className="px-4">Accession</th>
                    <th className="px-4">Patient (ID / Nom)</th>
                    <th className="px-4">Modalité</th>
                    <th className="px-4">Procédure</th>
                    <th className="px-4">Date prévue</th>
                    <th className="px-4">Priorité</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {worklist.map((item) => (
                    <tr key={item.AccessionNumber} className="h-12 border-t border-[#DCE6EF] hover:bg-[#F3F8FC]">
                      <td className="whitespace-nowrap px-4 font-mono text-[11px] font-medium text-[#54687A]">
                        {item.AccessionNumber}
                      </td>
                      <td className="px-4">
                        <div className="text-[12px] font-medium text-[#0F2233]">{item.PatientName?.replace('^', ' ')}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-[#71869A]">{item.PatientID}</div>
                      </td>
                      <td className="px-4">
                        <span className="rounded-md bg-[#E6F0FB] px-2 py-1 font-mono text-[10px] font-medium text-[#1566C0]">
                          {item.Modality}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 text-[11px] text-[#54687A]">
                        {item.ScheduledProcedureStepDescription}
                      </td>
                      <td className="whitespace-nowrap px-4 text-[11px] text-[#54687A]">
                        {item.ScheduledProcedureStepStartDate} {item.ScheduledProcedureStepStartTime}
                      </td>
                      <td className="px-4">
                        <PriorityBadge priority={item.Priority} />
                      </td>
                      <td className="whitespace-nowrap px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleSync(item.ExamID)}
                          disabled={syncing}
                          className="mr-1.5 inline-flex h-8 items-center gap-1 rounded-lg bg-[#E6F0FB] px-2.5 text-[10px] font-medium text-[#1566C0] transition hover:bg-[#1566C0] hover:text-white disabled:opacity-50"
                          title="Associer automatiquement une image du PACS à cet examen"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Associer image
                        </button>
                        <Link
                          to={`/exams/${item.ExamID}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCE6EF] px-2.5 text-[10px] font-medium text-[#54687A] hover:bg-[#F3F8FC] hover:text-[#1566C0]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Détails
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2: ÉTUDES STOCKÉES DANS LE PACS ORTHANC */}
      {activeTab === 'studies' && (
        <div className="app-panel overflow-hidden">
          <div className="border-b border-[#DCE6EF] bg-[#F8FAFC] p-4 text-[12px] text-[#54687A] flex justify-between items-center">
            <span>
              <strong>{studies.length} étude(s)</strong> actuellement archivée(s) dans le serveur PACS Orthanc.
            </span>
            <span className="text-[11px] text-[#71869A]">
              Cliquez sur « Visualiser » pour charger instantanément l'étude dans l'iframe OHIF.
            </span>
          </div>

          {loading ? (
            <div className="p-14 text-center text-[12px] text-[#71869A]">
              <span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-[#DCE6EF] border-t-[#1566C0]" />
              Chargement des études PACS…
            </div>
          ) : studies.length === 0 ? (
            <div className="p-14 text-center">
              <FolderArchive className="mx-auto mb-3 h-9 w-9 text-slate-400" />
              <p className="text-[14px] font-semibold text-[#0F2233]">Aucune étude dans le PACS</p>
              <p className="mt-1 text-[11px] text-[#71869A]">
                Importez des images via l'onglet « Upload DICOM » ou utilisez le simulateur de modalité.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="app-data-table min-w-full border-collapse text-[12px]">
                <thead className="bg-[#EEF4FA] text-left text-[11px] font-medium text-[#54687A]">
                  <tr className="h-10">
                    <th className="px-4">Patient</th>
                    <th className="px-4">Identifiant Patient</th>
                    <th className="px-4">Accession Number</th>
                    <th className="px-4">Description de l'examen</th>
                    <th className="px-4">Date de l'étude</th>
                    <th className="px-4 text-center">Séries</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studies.map((s) => (
                    <tr key={s.id} className="h-12 border-t border-[#DCE6EF] hover:bg-[#F3F8FC]">
                      <td className="whitespace-nowrap px-4 font-semibold text-[#0F2233]">
                        {s.patient_name || 'Anonyme'}
                      </td>
                      <td className="whitespace-nowrap px-4 font-mono text-[11px] text-[#54687A]">
                        {s.patient_id || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 font-mono text-[11px]">
                        {s.accession_number ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold border border-emerald-200">
                            {s.accession_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Non rattaché</span>
                        )}
                      </td>
                      <td className="px-4 text-[11px] text-[#54687A]">
                        {s.study_description || 'Examen d’imagerie médicale'}
                      </td>
                      <td className="whitespace-nowrap px-4 font-mono text-[11px] text-[#54687A]">
                        {s.study_date ? `${s.study_date.slice(6, 8)}/${s.study_date.slice(4, 6)}/${s.study_date.slice(0, 4)}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 text-center font-semibold text-[#1566C0]">
                        {s.series_count}
                      </td>
                      <td className="whitespace-nowrap px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openInViewer(s.study_instance_uid, `${s.patient_name} — ${s.study_description || s.accession_number}`)}
                          className="app-button-primary inline-flex h-8 items-center gap-1.5 px-3 text-[11px] font-medium text-white shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Visualiser (Iframe)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ONGLET 3: VISUALISEUR OHIF INTÉGRÉ EN IFRAME */}
      {activeTab === 'viewer' && (
        <div className="app-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE6EF] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[#0F2233]">
                Étude sélectionnée :
              </span>
              <select
                value={selectedStudyUID || ''}
                onChange={(e) => {
                  const uid = e.target.value;
                  const st = studies.find((x) => x.study_instance_uid === uid);
                  setSelectedStudyUID(uid || null);
                  setSelectedStudyTitle(st ? `${st.patient_name} — ${st.study_description || st.accession_number}` : '');
                }}
                className="h-9 rounded-lg border border-[#DCE6EF] bg-white px-3 text-[11px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
              >
                <option value="">-- Navigateur de toutes les études PACS --</option>
                {studies.map((s) => (
                  <option key={s.id} value={s.study_instance_uid}>
                    {s.patient_name} [{s.accession_number || s.patient_id}] — {s.study_description || 'Étude DICOM'}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[11px] text-[#71869A]">
              Propulsé par <strong>OHIF Viewer v3</strong> connecté en direct au PACS Orthanc.
            </span>
          </div>

          <DicomViewer
            studyInstanceUID={selectedStudyUID}
            title={selectedStudyTitle || (selectedStudyUID ? "Étude sélectionnée" : "Toutes les études du PACS")}
            height="75vh"
          />
        </div>
      )}

      {/* ONGLET 4: UPLOAD DICOM */}
      {activeTab === 'upload' && (
        <div className="app-panel p-6">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F0FB] text-[#1566C0]">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="text-[14px] font-semibold text-[#0F2233]">
              Envoyer des images DICOM vers le PACS
            </h3>
            <p className="mt-1 text-[11px] text-[#54687A]">
              Sélectionnez un ou plusieurs fichiers DICOM (.dcm) à archiver dans Orthanc.
              Les images seront automatiquement indexées et consultables dans OHIF Viewer.
            </p>

            <label className="mt-5 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#B8D3EC] bg-[#F3F8FC] p-8 transition hover:border-[#1566C0] hover:bg-[#E6F0FB]">
              <Image className="h-8 w-8 text-[#71869A]" />
              <span className="text-[12px] font-medium text-[#54687A]">
                {uploading ? 'Upload en cours…' : 'Cliquez ou glissez vos fichiers DICOM ici'}
              </span>
              <input
                type="file"
                accept=".dcm,application/dicom"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {uploadResult && (
              <div className="mt-4 rounded-lg border border-[#DCE6EF] bg-white p-3 text-[11px] text-[#54687A]">
                ✅ {uploadResult.uploaded} fichier(s) uploadé(s)
                {uploadResult.failed > 0 && <span className="text-rose-600"> · ❌ {uploadResult.failed} échec(s)</span>}
              </div>
            )}

            <div className="mt-5 rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] p-3 text-left text-[11px] text-[#54687A]">
              <strong className="text-[#0F2233]">💡 Conseil :</strong> Avant l'upload, vous pouvez utiliser le script{' '}
              <code className="rounded bg-white px-1 font-mono text-[#1566C0]">scripts/tag_dicom.py</code>{' '}
              pour aligner les tags PatientID et AccessionNumber avec les données du Module 1.
            </div>

            <div className="mt-3">
              <a
                href="http://localhost:8042"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#1566C0] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir l'interface web Orthanc
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

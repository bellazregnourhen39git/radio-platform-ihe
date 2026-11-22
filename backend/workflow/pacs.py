"""
Module 2 — Client d'intégration Orthanc PACS.
Fournit les fonctions utilitaires pour communiquer avec le serveur Orthanc
via son API REST et DICOMweb.
"""

import requests
from django.conf import settings


def _get_orthanc_url():
    return getattr(settings, 'ORTHANC_URL', 'http://orthanc:8042')


def _get_orthanc_auth():
    user = getattr(settings, 'ORTHANC_USER', 'orthanc')
    password = getattr(settings, 'ORTHANC_PASS', 'orthanc')
    return (user, password)


def get_orthanc_system_info():
    """Récupérer les informations système d'Orthanc (version, AET, etc.)."""
    resp = requests.get(
        f"{_get_orthanc_url()}/system",
        auth=_get_orthanc_auth(),
        timeout=5
    )
    resp.raise_for_status()
    return resp.json()


def find_studies_by_accession(accession_number):
    """Rechercher des études dans Orthanc par AccessionNumber via DICOMweb QIDO-RS."""
    resp = requests.get(
        f"{_get_orthanc_url()}/dicom-web/studies",
        params={"AccessionNumber": accession_number},
        auth=_get_orthanc_auth(),
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def find_studies_by_uid(study_instance_uid):
    """Rechercher des études dans Orthanc par StudyInstanceUID via DICOMweb QIDO-RS."""
    resp = requests.get(
        f"{_get_orthanc_url()}/dicom-web/studies",
        params={"StudyInstanceUID": study_instance_uid},
        auth=_get_orthanc_auth(),
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def get_study_series(study_instance_uid):
    """Récupérer les séries d'une étude via DICOMweb."""
    resp = requests.get(
        f"{_get_orthanc_url()}/dicom-web/studies/{study_instance_uid}/series",
        auth=_get_orthanc_auth(),
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def list_all_studies():
    """Lister toutes les études stockées dans Orthanc (API REST native)."""
    resp = requests.get(
        f"{_get_orthanc_url()}/studies?expand",
        auth=_get_orthanc_auth(),
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def get_study_detail(orthanc_study_id):
    """Récupérer les métadonnées complètes d'une étude Orthanc par son ID interne."""
    resp = requests.get(
        f"{_get_orthanc_url()}/studies/{orthanc_study_id}",
        auth=_get_orthanc_auth(),
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def upload_dicom_instance(dicom_bytes):
    """Envoyer une instance DICOM à Orthanc via l'API REST."""
    resp = requests.post(
        f"{_get_orthanc_url()}/instances",
        data=dicom_bytes,
        headers={"Content-Type": "application/dicom"},
        auth=_get_orthanc_auth(),
        timeout=30
    )
    resp.raise_for_status()
    return resp.json()


def get_statistics():
    """Récupérer les statistiques du PACS (nombre d'études, séries, instances)."""
    resp = requests.get(
        f"{_get_orthanc_url()}/statistics",
        auth=_get_orthanc_auth(),
        timeout=5
    )
    resp.raise_for_status()
    return resp.json()


def sync_pacs_with_exams(actor=None, target_exam_id=None):
    """
    Synchronise les études du PACS Orthanc avec les demandes d'examen du RIS :
    - Associe les études non étiquetées aux examens PLANIFIÉS de la Worklist.
    - Met à jour les tags DICOM (PatientID, PatientName, AccessionNumber) dans Orthanc.
    - Bascule les examens au statut RÉALISÉ pour débloquer la visualisation OHIF et le compte rendu.
    """
    import io
    import pydicom
    from django.utils import timezone
    from .models import ExamRequest, ExamStatusChoices, StatusHistory
    from .audit import log_event

    studies = list_all_studies()
    exams_query = ExamRequest.objects.filter(statut=ExamStatusChoices.PLANIFIE).select_related('patient')

    if target_exam_id:
        exams_query = exams_query.filter(id=target_exam_id)

    planned_exams = list(exams_query.order_by('date_demande'))
    synced = []

    # 1. Vérifier si des études ont déjà l'AccessionNumber
    for study in list(studies):
        acc = study.get('MainDicomTags', {}).get('AccessionNumber', '').strip()
        study_uid = study.get('MainDicomTags', {}).get('StudyInstanceUID', '').strip()
        if acc and study_uid:
            match = next((e for e in planned_exams if e.accession_number == acc), None)
            if match:
                match.study_instance_uid = study_uid
                match.statut = ExamStatusChoices.REALISE
                match.date_realisation = timezone.now()
                match.save(update_fields=['study_instance_uid', 'statut', 'date_realisation'])

                StatusHistory.objects.create(
                    exam=match,
                    ancien_statut=ExamStatusChoices.PLANIFIE,
                    nouveau_statut=ExamStatusChoices.REALISE,
                    change_par=actor,
                    commentaire=f"Synchronisation PACS automatique. StudyInstanceUID: {study_uid}"
                )
                log_event(
                    actor=actor,
                    action='PACS_AUTO_SYNC',
                    resource_type='ExamRequest',
                    resource_id=str(match.id),
                    outcome='SUCCESS',
                    details={'accession': acc, 'study_instance_uid': study_uid}
                )
                synced.append({
                    'exam_id': str(match.id),
                    'accession_number': acc,
                    'patient': f"{match.patient.nom} {match.patient.prenom}",
                    'study_instance_uid': study_uid,
                    'action': 'linked'
                })
                planned_exams.remove(match)

    # 2. Études sans AccessionNumber : leur attribuer l'examen et les réinsérer dans Orthanc
    unlinked_studies = [
        s for s in studies
        if not s.get('MainDicomTags', {}).get('AccessionNumber', '').strip()
    ]

    for study in unlinked_studies:
        if not planned_exams:
            break
        exam = planned_exams.pop(0)
        study_id = study['ID']

        # Récupérer l'instance et son fichier DICOM
        try:
            inst_resp = requests.get(
                f"{_get_orthanc_url()}/studies/{study_id}/instances",
                auth=_get_orthanc_auth(),
                timeout=10
            )
            if not inst_resp.ok or not inst_resp.json():
                continue

            first_inst_id = inst_resp.json()[0]['ID']
            file_resp = requests.get(
                f"{_get_orthanc_url()}/instances/{first_inst_id}/file",
                auth=_get_orthanc_auth(),
                timeout=20
            )
            if not file_resp.ok:
                continue

            # Modifier les tags avec pydicom
            ds = pydicom.dcmread(io.BytesIO(file_resp.content))
            ds.PatientID = exam.patient.ipp
            ds.PatientName = f"{exam.patient.nom}^{exam.patient.prenom}"
            ds.AccessionNumber = exam.accession_number
            study_uid = str(ds.StudyInstanceUID)

            out = io.BytesIO()
            ds.save_as(out)
            upload_dicom_instance(out.getvalue())

            # Supprimer l'ancienne étude non étiquetée
            requests.delete(
                f"{_get_orthanc_url()}/studies/{study_id}",
                auth=_get_orthanc_auth(),
                timeout=10
            )

            # Mettre à jour la demande d'examen
            exam.study_instance_uid = study_uid
            exam.statut = ExamStatusChoices.REALISE
            exam.date_realisation = timezone.now()
            exam.save(update_fields=['study_instance_uid', 'statut', 'date_realisation'])

            StatusHistory.objects.create(
                exam=exam,
                ancien_statut=ExamStatusChoices.PLANIFIE,
                nouveau_statut=ExamStatusChoices.REALISE,
                change_par=actor,
                commentaire=f"Synchronisation PACS & taggage automatique. StudyInstanceUID: {study_uid}"
            )
            log_event(
                actor=actor,
                action='PACS_AUTO_TAG_SYNC',
                resource_type='ExamRequest',
                resource_id=str(exam.id),
                outcome='SUCCESS',
                details={'accession': exam.accession_number, 'study_instance_uid': study_uid}
            )

            synced.append({
                'exam_id': str(exam.id),
                'accession_number': exam.accession_number,
                'patient': f"{exam.patient.nom} {exam.patient.prenom}",
                'study_instance_uid': study_uid,
                'action': 'tagged_and_linked'
            })
        except Exception:
            continue

    return synced

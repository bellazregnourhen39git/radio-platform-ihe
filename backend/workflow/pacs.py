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

#!/usr/bin/env python3
"""
Module 2 — Simulateur de Modalité d'Acquisition DICOM.
Simule le cycle complet d'acquisition :
  1. Interrogation de la DICOM Modality Worklist (Module 1)
  2. Sélection d'un examen PLANIFIÉ
  3. Prélèvement d'une image test dans dicom_OP
  4. Tagging de l'image (PatientID, PatientName, AccessionNumber, StudyInstanceUID)
  5. Envoi au PACS Orthanc (REST C-STORE simulé)
  6. Déclenchement automatique de la notification vers le Module 1
"""

import os
import sys
import time
import requests
import pydicom
from pydicom.uid import generate_uid

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
ORTHANC_URL = os.environ.get("ORTHANC_URL", "http://localhost:8042")
ORTHANC_USER = os.environ.get("ORTHANC_USER", "orthanc")
ORTHANC_PASS = os.environ.get("ORTHANC_PASS", "orthanc")

DICOM_TEST_DIR = os.environ.get("DICOM_TEST_DIR", r"C:\hayfatp\dicom_OP\Mild")


def login_as_modality():
    """Authentification en tant que compte de service modalité."""
    print("[1/5] Authentification auprès du SIH/RIS (Module 1)...")
    resp = requests.post(
        f"{BACKEND_URL}/api/v1/auth/login/",
        json={"username": "modality_ct", "password": "demo"},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json()["access"]
    print("      ✓ Authentification réussie (JWT obtenu)")
    return token


def fetch_worklist(token):
    """Interroger la worklist pour trouver des examens planifiés."""
    print("[2/5] Interrogation de la DICOM Modality Worklist...")
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(
        f"{BACKEND_URL}/api/v1/worklist/?status=PLANIFIE",
        headers=headers,
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json()
    print(f"      ✓ {len(items)} examen(s) en attente d'acquisition")
    return items


def prepare_and_tag_dicom(worklist_item, sample_file, output_file):
    """Taguer l'image DICOM avec les données de l'examen."""
    print(f"[3/5] Préparation & Tagging DICOM depuis {os.path.basename(sample_file)}...")
    ds = pydicom.dcmread(sample_file)

    study_uid = generate_uid()
    ds.PatientID = worklist_item["PatientID"]
    ds.PatientName = worklist_item["PatientName"]
    ds.AccessionNumber = worklist_item["AccessionNumber"]
    ds.StudyInstanceUID = study_uid
    ds.Modality = worklist_item.get("Modality", "CT")

    ds.save_as(output_file)
    print(f"      ✓ PatientID        : {ds.PatientID}")
    print(f"      ✓ PatientName      : {ds.PatientName}")
    print(f"      ✓ AccessionNumber  : {ds.AccessionNumber}")
    print(f"      ✓ StudyInstanceUID : {study_uid}")
    return study_uid


def upload_to_orthanc(dicom_path):
    """Envoi de l'image vers le serveur PACS Orthanc."""
    print("[4/5] Transfert Modalité → PACS Orthanc...")
    with open(dicom_path, "rb") as f:
        dicom_bytes = f.read()

    resp = requests.post(
        f"{ORTHANC_URL}/instances",
        data=dicom_bytes,
        headers={"Content-Type": "application/dicom"},
        auth=(ORTHANC_USER, ORTHANC_PASS),
        timeout=20,
    )
    resp.raise_for_status()
    res_data = resp.json()
    instance_id = res_data.get("ID")
    print(f"      ✓ Instance archivée dans Orthanc (ID={instance_id})")
    return res_data


def check_exam_status(token, exam_id):
    """Vérifier l'état de l'examen dans le Module 1."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(
        f"{BACKEND_URL}/api/v1/exams/{exam_id}/",
        headers=headers,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    print("==============================================================")
    print("  SIMULATEUR DE MODALITÉ & WORKFLOW PACS (MODULE 2)           ")
    print("==============================================================")

    try:
        token = login_as_modality()
    except Exception as e:
        print(f"❌ Erreur de connexion au backend: {e}")
        print("   Assurez-vous que le stack Docker est démarré.")
        sys.exit(1)

    worklist = fetch_worklist(token)
    if not worklist:
        print("⚠️ Aucun examen au statut PLANIFIE dans la worklist.")
        print("   Planifiez d'abord un examen depuis la console RIS.")
        return

    selected = worklist[0]
    print(f"\nTarget: {selected['AccessionNumber']} - {selected['PatientName']} ({selected['ScheduledProcedureStepDescription']})")

    # Trouver un fichier de test
    if not os.path.isdir(DICOM_TEST_DIR):
        print(f"❌ Répertoire DICOM introuvable: {DICOM_TEST_DIR}")
        return

    sample_files = [
        os.path.join(DICOM_TEST_DIR, f)
        for f in os.listdir(DICOM_TEST_DIR)
        if f.endswith(".dcm") or "." not in f
    ]
    if not sample_files:
        print(f"❌ Aucun fichier DICOM dans {DICOM_TEST_DIR}")
        return

    sample_file = sample_files[0]
    output_temp = os.path.join(os.path.dirname(sample_file), "_temp_tagged.dcm")

    study_uid = prepare_and_tag_dicom(selected, sample_file, output_temp)

    try:
        upload_to_orthanc(output_temp)
    except Exception as e:
        print(f"❌ Erreur lors de l'envoi à Orthanc: {e}")
        print("   Vérifiez qu'Orthanc tourne sur port 8042.")
        return
    finally:
        if os.path.exists(output_temp):
            try:
                os.remove(output_temp)
            except Exception:
                pass

    print("[5/5] Attente de la détection de stabilité Orthanc (Lua OnStableStudy)...")
    print("      (Orthanc attend StableAge=10s pour clôturer l'étude)")

    for i in range(15):
        time.sleep(2)
        exam = check_exam_status(token, selected["ExamID"])
        if exam.get("statut") == "REALISE":
            print(f"\n🎉 SUCCÈS ! L'examen {selected['AccessionNumber']} est passé au statut REALISE !")
            print(f"   StudyInstanceUID associé: {exam.get('study_instance_uid')}")
            print(f"   Visualisable dans OHIF Viewer:")
            print(f"   👉 http://localhost:3000/exams/{selected['ExamID']} (onglet Images PACS)")
            print(f"   👉 http://localhost:3001/viewer?StudyInstanceUIDs={study_uid}")
            return
        sys.stdout.write(".")
        sys.stdout.flush()

    print("\n⏳ Délai dépassé. Vous pouvez vérifier les logs Orthanc avec: docker logs radio_orthanc")


if __name__ == "__main__":
    main()

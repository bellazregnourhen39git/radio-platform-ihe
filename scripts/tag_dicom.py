#!/usr/bin/env python3
"""
Module 2 — Outil de taggage DICOM.
Modifie les tags PatientID, PatientName, AccessionNumber et StudyInstanceUID
des fichiers DICOM pour les aligner avec les données du Module 1 (SIH/RIS).

Usage:
    python tag_dicom.py <dossier_dicom> <patient_id> <patient_name> <accession_number> [study_uid]

Exemple:
    python tag_dicom.py ./dicom_OP/Mild IPP-2026-31678 "BERNARD^Pierre" ACC-20261122-1234

Si study_uid n'est pas fourni, un UID unique est généré automatiquement.
"""

import sys
import os
import pydicom
from pydicom.uid import generate_uid


def tag_dicom_file(filepath, patient_id, patient_name, accession_number, study_uid):
    """Modifie les tags DICOM d'un fichier pour correspondre au dossier du Module 1."""
    try:
        ds = pydicom.dcmread(filepath)
    except Exception as e:
        print(f"  [SKIP] Impossible de lire {filepath}: {e}")
        return False

    ds.PatientID = patient_id
    ds.PatientName = patient_name
    ds.AccessionNumber = accession_number
    ds.StudyInstanceUID = study_uid

    ds.save_as(filepath)
    print(f"  [OK] {os.path.basename(filepath)}")
    return True


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    folder = sys.argv[1]
    patient_id = sys.argv[2]
    patient_name = sys.argv[3]
    accession = sys.argv[4] if len(sys.argv) > 4 else f"ACC-TAG-{os.getpid()}"
    study_uid = sys.argv[5] if len(sys.argv) > 5 else generate_uid()

    if not os.path.isdir(folder):
        print(f"ERREUR: Le dossier '{folder}' n'existe pas.")
        sys.exit(1)

    print(f"=== Taggage DICOM ===")
    print(f"  Dossier        : {folder}")
    print(f"  PatientID      : {patient_id}")
    print(f"  PatientName    : {patient_name}")
    print(f"  AccessionNumber: {accession}")
    print(f"  StudyInstanceUID: {study_uid}")
    print()

    count_ok = 0
    count_skip = 0

    for filename in sorted(os.listdir(folder)):
        filepath = os.path.join(folder, filename)
        if not os.path.isfile(filepath):
            continue
        # Accepter les fichiers .dcm ou sans extension
        if filename.endswith('.dcm') or '.' not in filename:
            if tag_dicom_file(filepath, patient_id, patient_name, accession, study_uid):
                count_ok += 1
            else:
                count_skip += 1

    print(f"\nTerminé: {count_ok} fichier(s) modifié(s), {count_skip} ignoré(s).")
    print(f"StudyInstanceUID utilisé: {study_uid}")


if __name__ == '__main__':
    main()

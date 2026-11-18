"""
Générateur de ressources HL7 FHIR R4 standard pour l'interopérabilité
avec le Module 3 (Téléexpertise) et le Module 4 (Interopérabilité).
"""

def patient_to_fhir_r4(patient):
    """Convertit une instance Patient en ressource FHIR R4 Patient JSON valide."""
    gender_map = {
        'M': 'male',
        'F': 'female',
        'O': 'other'
    }

    fhir_doc = {
        "resourceType": "Patient",
        "id": str(patient.id),
        "identifier": [
            {
                "use": "usual",
                "type": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                            "code": "MR",
                            "display": "Medical Record Number"
                        }
                    ]
                },
                "system": "urn:oid:1.2.250.1.213.1.4.2",
                "value": patient.ipp
            }
        ],
        "active": patient.is_active,
        "name": [
            {
                "use": "official",
                "family": patient.nom.upper(),
                "given": [patient.prenom]
            }
        ],
        "gender": gender_map.get(patient.sexe, 'unknown'),
        "birthDate": patient.date_naissance.isoformat() if patient.date_naissance else None,
        "telecom": [],
        "address": []
    }

    if patient.telephone:
        fhir_doc["telecom"].append({
            "system": "phone",
            "value": patient.telephone,
            "use": "mobile"
        })

    if patient.adresse:
        fhir_doc["address"].append({
            "use": "home",
            "text": patient.adresse
        })

    return fhir_doc


def exam_to_fhir_servicerequest_r4(exam):
    """
    Convertit une instance ExamRequest en ressource FHIR R4 ServiceRequest JSON valide.
    Mapping imposé :
    ROUTINE -> routine
    URGENT -> urgent
    TRES_URGENT -> asap
    """
    priority_map = {
        'ROUTINE': 'routine',
        'URGENT': 'urgent',
        'TRES_URGENT': 'asap'
    }

    status_map = {
        'DEMANDE': 'active',
        'PLANIFIE': 'active',
        'REALISE': 'completed',
        'TERMINE': 'completed',
        'ANNULE': 'revoked'
    }

    doc_name = (
        exam.medecin_demandeur.get_full_name()
        if exam.medecin_demandeur and exam.medecin_demandeur.get_full_name()
        else (exam.medecin_demandeur.username if exam.medecin_demandeur else "Médecin Demandeur")
    )

    fhir_doc = {
        "resourceType": "ServiceRequest",
        "id": str(exam.id),
        "identifier": [
            {
                "use": "usual",
                "type": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                            "code": "ACSN",
                            "display": "Accession ID"
                        }
                    ]
                },
                "value": exam.accession_number
            }
        ],
        "status": status_map.get(exam.statut, 'active'),
        "intent": "order",
        "priority": priority_map.get(exam.priorite, 'routine'),
        "code": {
            "coding": [
                {
                    "system": "http://dicom.nema.org/resources/ontology/DCM",
                    "code": exam.modalite,
                    "display": exam.type_examen
                }
            ],
            "text": f"{exam.type_examen} ({exam.region_anatomique})"
        },
        "subject": {
            "reference": f"Patient/{exam.patient_id}",
            "display": f"{exam.patient.nom.upper()} {exam.patient.prenom}"
        },
        "authoredOn": exam.date_demande.isoformat() if exam.date_demande else None,
        "requester": {
            "reference": f"Practitioner/{exam.medecin_demandeur_id}",
            "display": doc_name
        },
        "reasonCode": [
            {
                "text": exam.indication_clinique
            }
        ],
        "bodySite": [
            {
                "text": exam.region_anatomique
            }
        ]
    }

    if exam.date_planifiee:
        fhir_doc["occurrenceDateTime"] = exam.date_planifiee.isoformat()

    return fhir_doc


def exam_to_fhir_diagnosticreport_r4(exam):
    """
    Convertit le compte rendu d'une instance ExamRequest en ressource FHIR R4 DiagnosticReport.
    Statut FHIR :
    VALIDE -> final
    BROUILLON -> preliminary
    AUCUN -> registered
    """
    report_status_map = {
        'VALIDE': 'final',
        'BROUILLON': 'preliminary',
        'AUCUN': 'registered'
    }

    radio_name = (
        exam.radiologue_assigne.get_full_name()
        if exam.radiologue_assigne and exam.radiologue_assigne.get_full_name()
        else (exam.radiologue_assigne.username if exam.radiologue_assigne else "Radiologue")
    )

    fhir_doc = {
        "resourceType": "DiagnosticReport",
        "id": str(exam.id),
        "identifier": [
            {
                "use": "usual",
                "type": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                            "code": "ACSN",
                            "display": "Accession ID"
                        }
                    ]
                },
                "value": exam.accession_number
            }
        ],
        "basedOn": [
            {
                "reference": f"ServiceRequest/{exam.id}",
                "display": f"Demande {exam.accession_number}"
            }
        ],
        "status": report_status_map.get(exam.report_status, 'registered'),
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                        "code": "RAD",
                        "display": "Radiology"
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://dicom.nema.org/resources/ontology/DCM",
                    "code": exam.modalite,
                    "display": exam.type_examen
                }
            ],
            "text": exam.type_examen
        },
        "subject": {
            "reference": f"Patient/{exam.patient_id}",
            "display": f"{exam.patient.nom.upper()} {exam.patient.prenom}"
        },
        "effectiveDateTime": (
            exam.date_realisation.isoformat() if exam.date_realisation
            else (exam.date_planifiee.isoformat() if exam.date_planifiee else exam.date_demande.isoformat())
        ),
        "issued": exam.date_modification.isoformat(),
        "performer": [
            {
                "reference": f"Practitioner/{exam.radiologue_assigne_id}" if exam.radiologue_assigne_id else None,
                "display": radio_name
            }
        ] if exam.radiologue_assigne else [],
        "conclusion": exam.report_text or "Compte rendu non encore rédigé.",
        "presentedForm": [
            {
                "contentType": "text/plain",
                "data": exam.report_text
            }
        ]
    }

    if exam.study_instance_uid:
        fhir_doc["imagingStudy"] = [
            {
                "identifier": {
                    "system": "urn:dicom:uid",
                    "value": f"urn:oid:{exam.study_instance_uid}"
                }
            }
        ]

    return fhir_doc

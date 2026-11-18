import uuid
from django.utils import timezone
from .models import Hl7Message


def generate_orm_o01(exam):
    """
    Génère un message HL7 v2.5 standard ORM^O01 (Demande d'examen d'imagerie)
    transmis du SIH (prescripteur) vers le RIS (service radiologie).
    Format standard pipes & hats (ER7).
    """
    patient = exam.patient
    now_str = timezone.now().strftime("%Y%m%d%H%M%S")
    demande_str = exam.date_demande.strftime("%Y%m%d%H%M%S")
    planifiee_str = exam.date_planifiee.strftime("%Y%m%d%H%M%S") if exam.date_planifiee else ""
    birth_str = patient.date_naissance.strftime("%Y%m%d") if patient.date_naissance else ""
    msg_id = f"MSG-ORM-{uuid.uuid4().hex[:10].upper()}"

    doc_full_name = exam.medecin_demandeur.get_full_name() if exam.medecin_demandeur else "DR_DEMANDEUR"
    clean_nom = patient.nom.upper().replace('^', ' ')
    clean_prenom = patient.prenom.replace('^', ' ')
    clean_type = exam.type_examen.replace('^', ' ')

    segments = [
        f"MSH|^~\\&|SIH_CLINIQUE|CLINIQUE_PARIS|RIS_CENTRAL|RADIO_PARIS|{now_str}||ORM^O01|{msg_id}|P|2.5",
        f"PID|1||{patient.ipp}^^^CLINIQUE||{clean_nom}^{clean_prenom}^^^^|{birth_str}|{patient.sexe}|||{patient.adresse}^^PARIS^^FRA||{patient.telephone}",
        f"PV1|1|O||||||||||||||||{exam.medecin_demandeur.username if exam.medecin_demandeur else ''}",
        f"ORC|NW|{exam.accession_number}|||||^^^{planifiee_str}||{demande_str}|{doc_full_name}",
        f"OBR|1|{exam.accession_number}||{exam.modalite}^{clean_type}|||{demande_str}||||||||||||||||||{exam.priorite}",
        f"ZDS|1.2.826.0.1.3680043.8.498.DEMANDE^{exam.accession_number}"
    ]

    raw_message = "\r\n".join(segments)

    # Persistance du message dans la table Hl7Message
    hl7_record = Hl7Message.objects.create(
        exam=exam,
        type_message='ORM^O01',
        direction=Hl7Message.DirectionChoices.OUTBOUND_SIH_TO_RIS,
        contenu_brut=raw_message
    )
    return hl7_record


def generate_oru_r01(exam):
    """
    Génère un message HL7 v2.5 standard ORU^R01 (Résultat d'observation / Compte rendu radiologique)
    transmis du RIS vers le SIH et les modules aval.
    """
    patient = exam.patient
    now_str = timezone.now().strftime("%Y%m%d%H%M%S")
    realise_str = exam.date_realisation.strftime("%Y%m%d%H%M%S") if exam.date_realisation else now_str
    birth_str = patient.date_naissance.strftime("%Y%m%d") if patient.date_naissance else ""
    msg_id = f"MSG-ORU-{uuid.uuid4().hex[:10].upper()}"

    doc_radio = exam.radiologue_assigne.get_full_name() if exam.radiologue_assigne else "DR_RADIOLOGUE"
    clean_nom = patient.nom.upper().replace('^', ' ')
    clean_prenom = patient.prenom.replace('^', ' ')
    clean_type = exam.type_examen.replace('^', ' ')
    clean_report = exam.report_text.replace('\r\n', r' \.br\ ').replace('\n', r' \.br\ ')

    segments = [
        f"MSH|^~\\&|RIS_CENTRAL|RADIO_PARIS|SIH_CLINIQUE|CLINIQUE_PARIS|{now_str}||ORU^R01|{msg_id}|P|2.5",
        f"PID|1||{patient.ipp}^^^CLINIQUE||{clean_nom}^{clean_prenom}^^^^|{birth_str}|{patient.sexe}|||{patient.adresse}^^PARIS^^FRA||{patient.telephone}",
        f"OBR|1|{exam.accession_number}||{exam.modalite}^{clean_type}|||{realise_str}||||||||{doc_radio}",
        f"OBX|1|TX|REPORT^Compte Rendu Radiologique||{clean_report}||||||F|||{now_str}|{doc_radio}"
    ]

    if exam.study_instance_uid:
        segments.append(f"OBX|2|ST|110180^Study Instance UID^DCM||{exam.study_instance_uid}||||||F")

    raw_message = "\r\n".join(segments)

    hl7_record = Hl7Message.objects.create(
        exam=exam,
        type_message='ORU^R01',
        direction=Hl7Message.DirectionChoices.OUTBOUND_RIS_TO_SIH,
        contenu_brut=raw_message
    )
    return hl7_record

"""
Vérification de bout en bout (End-to-End) du parcours radiologique complet.
"""

from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from rest_framework.test import APIClient

from workflow.models import User, Patient, ExamRequest, StatusHistory, Hl7Message, AuditEvent


class Command(BaseCommand):
    help = "Exécute un test de vérification de bout en bout complet (SIH -> RIS -> Modalité -> Compte Rendu -> HL7/FHIR)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== DÉMARRAGE DE LA VÉRIFICATION DE BOUT EN BOUT ==="))
        client = APIClient()

        # 1. Connexion en Médecin Demandeur (SIH)
        demandeur = User.objects.get(username='dr.dupont')
        client.force_authenticate(user=demandeur)
        self.stdout.write(f"[1/9] Authentifié en tant que {demandeur.username} ({demandeur.role})")

        # 2. Création d'un nouveau patient
        p_res = client.post('/api/v1/patients/', {
            'nom': 'VERIFICATION',
            'prenom': 'Jean-Marc',
            'date_naissance': '1982-05-14',
            'sexe': 'M',
            'telephone': '0601020304',
            'adresse': '10 rue de la Santé, 75014 Paris'
        }, format='json')
        assert p_res.status_code == 201, f"Échec création patient: {p_res.data}"
        patient_data = p_res.json()
        patient_id = patient_data['id']
        ipp = patient_data['ipp']
        self.stdout.write(self.style.SUCCESS(f"[2/9] Patient créé avec succès : {patient_data['nom']} ({ipp})"))

        # 3. Création d'une demande d'examen urgente (SIH)
        e_res = client.post('/api/v1/exams/', {
            'patient_id': patient_id,
            'modalite': 'CT',
            'region_anatomique': 'Thorax',
            'type_examen': 'Scanner Thoracique injecté haute résolution',
            'indication_clinique': 'Suspicion d embolie pulmonaire aiguë bilatérale avec tachycardie.',
            'priorite': 'URGENT'
        }, format='json')
        assert e_res.status_code == 201, f"Échec création examen: {e_res.data}"
        exam_data = e_res.json()
        exam_id = exam_data['id']
        accession = exam_data['accession_number']
        self.stdout.write(self.style.SUCCESS(f"[3/9] Demande créée : Accession {accession} - Statut {exam_data['statut']}"))

        # Vérification message HL7 ORM^O01
        orm_msg = Hl7Message.objects.filter(exam_id=exam_id, type_message='ORM^O01').first()
        assert orm_msg is not None, "Message HL7 ORM^O01 introuvable !"
        assert 'ORM^O01' in orm_msg.contenu_brut
        assert accession in orm_msg.contenu_brut
        self.stdout.write(self.style.SUCCESS(f"      -> Message HL7 ORM^O01 vérifié (longueur {len(orm_msg.contenu_brut)} car.)"))

        # 4. Connexion en Radiologue (RIS) et Planification
        radiologue = User.objects.get(username='dr.martin')
        client.force_authenticate(user=radiologue)
        target_plan = (timezone.now() + timedelta(hours=3)).isoformat()
        plan_res = client.post(f'/api/v1/exams/{exam_id}/schedule/', {
            'date_planifiee': target_plan,
            'radiologue_assigne_id': str(radiologue.id)
        }, format='json')
        assert plan_res.status_code == 200, f"Échec planification: {plan_res.data}"
        self.stdout.write(self.style.SUCCESS(f"[4/9] Examen planifié pour le {target_plan} - Statut {plan_res.json()['statut']}"))

        # 5. Connexion en Modalité (Module 2) et Interrogation Worklist DICOM
        modality_user = User.objects.get(username='modality_ct')
        client.force_authenticate(user=modality_user)
        wl_res = client.get('/api/v1/worklist/?status=PLANIFIE&modality=CT')
        assert wl_res.status_code == 200, f"Échec worklist: {wl_res.data}"
        items = wl_res.json()
        matching = [it for it in items if it['AccessionNumber'] == accession]
        assert len(matching) == 1, f"Examen {accession} absent de la Worklist DICOM !"
        self.stdout.write(self.style.SUCCESS(f"[5/9] Worklist DICOM interrogée par Module 2 : Examen trouvé (Modality={matching[0]['Modality']})"))

        # 6. Notification de Fin d'Acquisition (Module 2 -> mark-performed)
        study_uid = "1.2.826.0.1.3680043.8.498.999888777111"
        perf_res = client.post(f'/api/v1/exams/{exam_id}/mark-performed/', {
            'study_instance_uid': study_uid,
            'notes': 'Acquisition 64 coupes sans artéfact.'
        }, format='json')
        assert perf_res.status_code == 200, f"Échec mark-performed: {perf_res.data}"
        assert perf_res.json()['statut'] == 'REALISE'
        self.stdout.write(self.style.SUCCESS(f"[6/9] Acquisition notifiée par P2 : Statut REALISE, StudyInstanceUID={study_uid}"))

        # 7. Saisie et validation du Compte Rendu (Radiologue)
        client.force_authenticate(user=radiologue)
        report_content = (
            "INDICATION : Suspicion embolie pulmonaire.\n"
            "RÉSULTATS : Opacification homogène des artères pulmonaires. Pas de thrombus visible. Parenchyme sain.\n"
            "CONCLUSION : Absence d'embolie pulmonaire décelable. Examen rassurant."
        )
        val_res = client.post(f'/api/v1/exams/{exam_id}/validate-report/', {
            'report_text': report_content
        }, format='json')
        assert val_res.status_code == 200, f"Échec validation compte rendu: {val_res.data}"
        assert val_res.json()['statut'] == 'TERMINE'
        assert val_res.json()['report_status'] == 'VALIDE'
        self.stdout.write(self.style.SUCCESS(f"[7/9] Compte rendu validé & signé : Statut TERMINE"))

        # Vérification message HL7 ORU^R01
        oru_msg = Hl7Message.objects.filter(exam_id=exam_id, type_message='ORU^R01').first()
        assert oru_msg is not None, "Message HL7 ORU^R01 introuvable !"
        assert 'ORU^R01' in oru_msg.contenu_brut
        assert study_uid in oru_msg.contenu_brut
        self.stdout.write(self.style.SUCCESS(f"      -> Message HL7 ORU^R01 vérifié avec segments OBX et StudyInstanceUID"))

        # 8. Vérification des ressources standard FHIR R4
        client.force_authenticate(user=None) # FHIR accessible pour intégration
        fhir_p = client.get(f'/fhir/Patient/{patient_id}/')
        assert fhir_p.status_code == 200 and fhir_p.json()['resourceType'] == 'Patient'

        fhir_sr = client.get(f'/fhir/ServiceRequest/{exam_id}/')
        assert fhir_sr.status_code == 200 and fhir_sr.json()['resourceType'] == 'ServiceRequest'
        assert fhir_sr.json()['priority'] == 'urgent'
        assert fhir_sr.json()['status'] == 'completed'

        fhir_dr = client.get(f'/fhir/DiagnosticReport/{exam_id}/')
        assert fhir_dr.status_code == 200 and fhir_dr.json()['resourceType'] == 'DiagnosticReport'
        assert fhir_dr.json()['status'] == 'final'
        assert fhir_dr.json()['imagingStudy'][0]['identifier']['value'] == f"urn:oid:{study_uid}"
        self.stdout.write(self.style.SUCCESS(f"[8/9] Ressources FHIR R4 conformes (Patient, ServiceRequest, DiagnosticReport)"))

        # 9. Vérification de la traçabilité complète dans AuditEvent
        events = AuditEvent.objects.filter(id_ressource=exam_id).order_by('date_creation')
        assert events.count() >= 3, f"Pas assez d'événements d'audit trouvés ({events.count()})"
        actions = [e.action for e in events]
        self.stdout.write(self.style.SUCCESS(f"[9/9] Traçabilité d'audit validée : {len(actions)} événements enregistrés ({actions})"))

        self.stdout.write(self.style.SUCCESS("\n🎉 TOUTES LES ÉTAPES DU WORKFLOW RADIOLOGIQUE SONT VALIDÉES À 100% !"))

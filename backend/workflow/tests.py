import re
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from workflow.models import (
    User, UserRole, Patient, ExamRequest, StatusHistory, Hl7Message, AuditEvent,
    ModalityChoices, PriorityChoices, ExamStatusChoices, ReportStatusChoices
)


class WorkflowModule1Tests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Utilisateur SIH (Médecin demandeur)
        self.demandeur = User.objects.create_user(
            username='dr.test.demandeur',
            password='password123',
            first_name='Claude',
            last_name='Bernard',
            role=UserRole.MEDECIN_DEMANDEUR
        )

        # Utilisateur RIS (Radiologue)
        self.radiologue = User.objects.create_user(
            username='dr.test.radio',
            password='password123',
            first_name='Marie',
            last_name='Curie',
            role=UserRole.RADIOLOGUE
        )

        # Compte de service modalité (Module 2)
        self.modalite_service = User.objects.create_user(
            username='service.ct.test',
            password='password123',
            first_name='Console',
            last_name='CT',
            role=UserRole.MODALITE_SERVICE
        )

        # Administrateur
        self.admin = User.objects.create_user(
            username='admin.test',
            password='password123',
            role=UserRole.ADMIN,
            is_staff=True
        )

        # Patient de test
        self.patient = Patient.objects.create(
            ipp=Patient.generate_unique_ipp(),
            nom='MOREAU',
            prenom='Alice',
            date_naissance=date(1990, 6, 15),
            sexe=Patient.SexChoices.F,
            telephone='0611223344',
            adresse='10 rue de Rivoli, 75001 Paris'
        )

    # 1. Test création patient et génération IPP
    def test_01_patient_creation_and_auto_ipp(self):
        self.client.force_authenticate(user=self.demandeur)
        response = self.client.post('/api/v1/patients/', {
            'nom': 'LEROY',
            'prenom': 'David',
            'date_naissance': '1985-03-20',
            'sexe': 'M',
            'telephone': '0699887766',
            'adresse': '12 avenue Foch, 69006 Lyon'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data['ipp'].startswith('IPP-'))
        self.assertRegex(data['ipp'], r'^IPP-\d{4}-\d{5}$')
        self.assertEqual(data['nom'], 'LEROY')

    # 2. Test soft-delete patient (pas de suppression physique)
    def test_02_patient_soft_delete(self):
        self.client.force_authenticate(user=self.demandeur)
        response = self.client.delete(f'/api/v1/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Vérification : l'enregistrement existe toujours en base mais is_active=False
        patient_db = Patient.objects.get(id=self.patient.id)
        self.assertFalse(patient_db.is_active)

        # Ne doit plus apparaître dans le listing actif
        res_list = self.client.get('/api/v1/patients/')
        self.assertEqual(len(res_list.json()['results']), 0)

    # 3. Test création demande d'examen et génération unique d'Accession Number
    def test_03_exam_creation_and_accession_number(self):
        self.client.force_authenticate(user=self.demandeur)
        response = self.client.post('/api/v1/exams/', {
            'patient_id': str(self.patient.id),
            'modalite': 'CT',
            'region_anatomique': 'Thorax',
            'type_examen': 'Scanner thoracique injecté',
            'indication_clinique': 'Suspicion embolie pulmonaire',
            'priorite': 'URGENT'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn('accession_number', data)
        self.assertRegex(data['accession_number'], r'^ACC-\d{8}-\d{4,5}$')
        self.assertEqual(data['statut'], 'DEMANDE')

    # 4. Test génération automatique HL7 ORM^O01 lors de la création d'examen
    def test_04_hl7_orm_generation(self):
        self.client.force_authenticate(user=self.demandeur)
        response = self.client.post('/api/v1/exams/', {
            'patient_id': str(self.patient.id),
            'modalite': 'MR',
            'region_anatomique': 'Genou',
            'type_examen': 'IRM genou droit',
            'indication_clinique': 'Lésion méniscale suspectée',
            'priorite': 'ROUTINE'
        }, format='json')

        exam_id = response.json()['id']
        exam = ExamRequest.objects.get(id=exam_id)

        hl7_msg = Hl7Message.objects.filter(exam=exam, type_message='ORM^O01').first()
        self.assertIsNotNone(hl7_msg)
        self.assertIn('MSH|^~\\&|SIH_CLINIQUE', hl7_msg.contenu_brut)
        self.assertIn('PID|1||', hl7_msg.contenu_brut)
        self.assertIn(self.patient.nom.upper(), hl7_msg.contenu_brut)
        self.assertIn(exam.accession_number, hl7_msg.contenu_brut)

    # 5. Test transition valide : DEMANDE -> PLANIFIE
    def test_05_valid_transition_demande_to_planifie(self):
        self.client.force_authenticate(user=self.demandeur)
        create_res = self.client.post('/api/v1/exams/', {
            'patient_id': str(self.patient.id),
            'modalite': 'CT',
            'region_anatomique': 'Abdomen',
            'type_examen': 'Scanner abdomino-pelvien',
            'indication_clinique': 'Douleurs abdominales',
            'priorite': 'ROUTINE'
        }, format='json')
        exam_id = create_res.json()['id']

        # Radiologue planifie
        self.client.force_authenticate(user=self.radiologue)
        target_date = (timezone.now() + timedelta(days=1)).isoformat()
        plan_res = self.client.post(f'/api/v1/exams/{exam_id}/schedule/', {
            'date_planifiee': target_date,
            'radiologue_assigne_id': str(self.radiologue.id)
        }, format='json')

        self.assertEqual(plan_res.status_code, status.HTTP_200_OK)
        self.assertEqual(plan_res.json()['statut'], 'PLANIFIE')

        # Vérification historique
        history = StatusHistory.objects.filter(exam_id=exam_id, nouveau_statut='PLANIFIE').first()
        self.assertIsNotNone(history)
        self.assertEqual(history.ancien_statut, 'DEMANDE')

    # 6. Test transition valide : PLANIFIE -> REALISE (mark-performed par P2)
    def test_06_valid_transition_planifie_to_realise(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='CT',
            region_anatomique='Thorax',
            type_examen='Scanner Thorax',
            indication_clinique='Contrôle',
            priorite='ROUTINE',
            statut=ExamStatusChoices.PLANIFIE,
            medecin_demandeur=self.demandeur,
            radiologue_assigne=self.radiologue,
            date_planifiee=timezone.now() + timedelta(hours=2)
        )

        self.client.force_authenticate(user=self.modalite_service)
        perf_res = self.client.post(f'/api/v1/exams/{exam.id}/mark-performed/', {
            'study_instance_uid': '1.2.826.0.1.3680043.8.498.1122334455',
            'notes': 'Acquisition CT sans injection réussie.'
        }, format='json')

        self.assertEqual(perf_res.status_code, status.HTTP_200_OK)
        self.assertEqual(perf_res.json()['statut'], 'REALISE')
        self.assertEqual(perf_res.json()['study_instance_uid'], '1.2.826.0.1.3680043.8.498.1122334455')

    # 7. Test transition valide : REALISE -> TERMINE avec validation CR et génération HL7 ORU^R01
    def test_07_valid_transition_realise_to_termine_and_hl7_oru(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='CT',
            region_anatomique='Thorax',
            type_examen='Scanner Thorax',
            indication_clinique='Contrôle',
            priorite='ROUTINE',
            statut=ExamStatusChoices.REALISE,
            medecin_demandeur=self.demandeur,
            radiologue_assigne=self.radiologue,
            study_instance_uid='1.2.826.0.1.3680043.8.498.998877',
            date_realisation=timezone.now()
        )

        self.client.force_authenticate(user=self.radiologue)
        val_res = self.client.post(f'/api/v1/exams/{exam.id}/validate-report/', {
            'report_text': 'Parenchyme pulmonaire sain, pas de masse ni condensation.'
        }, format='json')

        self.assertEqual(val_res.status_code, status.HTTP_200_OK)
        self.assertEqual(val_res.json()['statut'], 'TERMINE')
        self.assertEqual(val_res.json()['report_status'], 'VALIDE')

        # Vérification message HL7 ORU^R01
        oru_msg = Hl7Message.objects.filter(exam=exam, type_message='ORU^R01').first()
        self.assertIsNotNone(oru_msg)
        self.assertIn('ORU^R01', oru_msg.contenu_brut)
        self.assertIn('Parenchyme pulmonaire sain', oru_msg.contenu_brut)

    # 8. Test transition invalide : DEMANDE -> TERMINE (doit échouer avec code 400)
    def test_08_invalid_transition_demande_to_termine_fails_400(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='CR',
            region_anatomique='Thorax',
            type_examen='Radio Thorax',
            indication_clinique='Toux',
            priorite='ROUTINE',
            statut=ExamStatusChoices.DEMANDE,
            medecin_demandeur=self.demandeur
        )

        self.client.force_authenticate(user=self.radiologue)
        val_res = self.client.post(f'/api/v1/exams/{exam.id}/validate-report/', {
            'report_text': 'Tentative de validation prématurée.'
        }, format='json')

        self.assertEqual(val_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', val_res.json())

    # 9. Test transition invalide : examen déjà REALISE ne peut pas être replanifié (code 400)
    def test_09_invalid_transition_realise_to_planifie_fails_400(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='CR',
            region_anatomique='Thorax',
            type_examen='Radio Thorax',
            indication_clinique='Toux',
            priorite='ROUTINE',
            statut=ExamStatusChoices.REALISE,
            medecin_demandeur=self.demandeur,
            date_realisation=timezone.now()
        )

        self.client.force_authenticate(user=self.radiologue)
        res = self.client.post(f'/api/v1/exams/{exam.id}/schedule/', {
            'date_planifiee': timezone.now().isoformat()
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 10. Test annulation avec motif obligatoire (et rejet si sans motif)
    def test_10_cancel_exam_with_mandatory_motif(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='US',
            region_anatomique='Abdomen',
            type_examen='Echo Abdominale',
            indication_clinique='Douleur',
            priorite='ROUTINE',
            statut=ExamStatusChoices.DEMANDE,
            medecin_demandeur=self.demandeur
        )

        self.client.force_authenticate(user=self.demandeur)

        # 10.a : Échec sans motif_annulation
        bad_res = self.client.post(f'/api/v1/exams/{exam.id}/cancel/', {}, format='json')
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 10.b : Succès avec motif valide
        ok_res = self.client.post(f'/api/v1/exams/{exam.id}/cancel/', {
            'motif_annulation': 'Patient non à jeun, examen reporté ultérieurement.'
        }, format='json')
        self.assertEqual(ok_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ok_res.json()['statut'], 'ANNULE')
        self.assertEqual(ok_res.json()['motif_annulation'], 'Patient non à jeun, examen reporté ultérieurement.')

    # 11. Test : impossible d'annuler un examen déjà TERMINE
    def test_11_cannot_cancel_already_finished_exam(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='MR',
            region_anatomique='Rachis',
            type_examen='IRM Rachis',
            indication_clinique='Douleur',
            priorite='ROUTINE',
            statut=ExamStatusChoices.TERMINE,
            medecin_demandeur=self.demandeur,
            report_text='CR signé',
            report_status=ReportStatusChoices.VALIDE
        )

        self.client.force_authenticate(user=self.demandeur)
        res = self.client.post(f'/api/v1/exams/{exam.id}/cancel/', {
            'motif_annulation': 'Trop tard pour annuler.'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 12. Test permissions : Médecin demandeur ne peut pas valider de compte rendu (403)
    def test_12_demandeur_cannot_validate_report(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='CT',
            region_anatomique='Thorax',
            type_examen='Scanner',
            indication_clinique='Bilan',
            priorite='ROUTINE',
            statut=ExamStatusChoices.REALISE,
            medecin_demandeur=self.demandeur
        )

        self.client.force_authenticate(user=self.demandeur)
        res = self.client.post(f'/api/v1/exams/{exam.id}/validate-report/', {
            'report_text': 'Tentative de validation par un non-radiologue.'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # 13. Test permissions : Compte de service MODALITE_SERVICE peut appeler la worklist
    def test_13_modalite_service_permissions(self):
        self.client.force_authenticate(user=self.modalite_service)
        res = self.client.get('/api/v1/worklist/?status=PLANIFIE')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # 14. Test DICOM Modality Worklist attributes
    def test_14_dicom_worklist_attributes(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='CT',
            region_anatomique='Thorax',
            type_examen='Scanner Thoracique Haute Résolution',
            indication_clinique='Bilan nodule',
            priorite='ROUTINE',
            statut=ExamStatusChoices.PLANIFIE,
            medecin_demandeur=self.demandeur,
            radiologue_assigne=self.radiologue,
            date_planifiee=timezone.now() + timedelta(hours=3)
        )

        self.client.force_authenticate(user=self.radiologue)
        res = self.client.get(f'/api/v1/worklist/?status=PLANIFIE&modality=CT')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        items = res.json()
        matching = [it for it in items if it['AccessionNumber'] == exam.accession_number]
        self.assertEqual(len(matching), 1)

        item = matching[0]
        self.assertEqual(item['PatientID'], self.patient.ipp)
        self.assertEqual(item['PatientName'], f"{self.patient.nom.upper()}^{self.patient.prenom}")
        self.assertEqual(item['Modality'], 'CT')
        self.assertEqual(item['ScheduledStationAETitle'], 'MOD_CT01')
        self.assertTrue('ScheduledProcedureStepStartDate' in item)

    # 15. Test endpoint FHIR R4 Patient
    def test_15_fhir_patient_endpoint(self):
        res = self.client.get(f'/fhir/Patient/{self.patient.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res['Content-Type'], 'application/fhir+json; charset=utf-8')

        doc = res.json()
        self.assertEqual(doc['resourceType'], 'Patient')
        self.assertEqual(doc['id'], str(self.patient.id))
        self.assertEqual(doc['gender'], 'female')
        self.assertEqual(doc['identifier'][0]['value'], self.patient.ipp)
        self.assertEqual(doc['name'][0]['family'], self.patient.nom.upper())

    # 16. Test endpoint FHIR R4 ServiceRequest (avec mapping priorités : ROUTINE->routine, URGENT->urgent, TRES_URGENT->asap)
    def test_16_fhir_servicerequest_endpoint(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='MR',
            region_anatomique='Cérébral',
            type_examen='IRM Cérébrale',
            indication_clinique='Déficit neurologique aigu',
            priorite=PriorityChoices.TRES_URGENT,
            statut=ExamStatusChoices.DEMANDE,
            medecin_demandeur=self.demandeur
        )

        res = self.client.get(f'/fhir/ServiceRequest/{exam.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        doc = res.json()

        self.assertEqual(doc['resourceType'], 'ServiceRequest')
        self.assertEqual(doc['priority'], 'asap')  # Mapping TRES_URGENT -> asap
        self.assertEqual(doc['status'], 'active')
        self.assertEqual(doc['subject']['reference'], f"Patient/{self.patient.id}")
        self.assertEqual(doc['code']['coding'][0]['code'], 'MR')

    # 17. Test endpoint FHIR R4 DiagnosticReport
    def test_17_fhir_diagnosticreport_endpoint(self):
        exam = ExamRequest.objects.create(
            patient=self.patient,
            accession_number=ExamRequest.generate_unique_accession_number(),
            modalite='CT',
            region_anatomique='Thorax',
            type_examen='Scanner Thorax',
            indication_clinique='Bilan',
            priorite=PriorityChoices.ROUTINE,
            statut=ExamStatusChoices.TERMINE,
            medecin_demandeur=self.demandeur,
            radiologue_assigne=self.radiologue,
            report_text='Absence de lésion suspecte pleuro-parenchymateuse.',
            report_status=ReportStatusChoices.VALIDE,
            study_instance_uid='1.2.826.0.1.3680043.8.498.554433'
        )

        res = self.client.get(f'/fhir/DiagnosticReport/{exam.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        doc = res.json()

        self.assertEqual(doc['resourceType'], 'DiagnosticReport')
        self.assertEqual(doc['status'], 'final')
        self.assertEqual(doc['conclusion'], 'Absence de lésion suspecte pleuro-parenchymateuse.')
        self.assertEqual(doc['imagingStudy'][0]['identifier']['value'], 'urn:oid:1.2.826.0.1.3680043.8.498.554433')

    # 18. Test traçabilité des événements dans AuditEvent
    def test_18_audit_event_logging(self):
        self.client.force_authenticate(user=self.demandeur)
        self.client.post('/api/v1/patients/', {
            'nom': 'AUDIT_TEST',
            'prenom': 'Jean',
            'date_naissance': '1970-01-01',
            'sexe': 'M'
        }, format='json')

        event = AuditEvent.objects.filter(action='PATIENT_CREATE').first()
        self.assertIsNotNone(event)
        self.assertEqual(event.acteur, self.demandeur)
        self.assertEqual(event.type_ressource, 'Patient')
        self.assertEqual(event.resultat, 'SUCCESS')

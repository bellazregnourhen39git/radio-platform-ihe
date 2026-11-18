"""
Management command to populate realistic demonstration data for Module 1.
Usage: python manage.py seed_demo
"""

from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from workflow.models import (
    User, UserRole, Patient, ExamRequest, StatusHistory, Hl7Message, AuditEvent,
    ModalityChoices, PriorityChoices, ExamStatusChoices, ReportStatusChoices
)
from workflow.hl7 import generate_orm_o01, generate_oru_r01
from workflow.audit import log_event


class Command(BaseCommand):
    help = "Peuple la base de données avec des utilisateurs, des patients et des examens de démonstration."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Initialisation du jeu de données de démonstration..."))

        with transaction.atomic():
            # 1. Utilisateurs par rôle
            users_data = [
                {
                    'username': 'dr.dupont',
                    'first_name': 'Jean',
                    'last_name': 'Dupont',
                    'email': 'jean.dupont@ch-hopital.fr',
                    'role': UserRole.MEDECIN_DEMANDEUR,
                    'service_medical': 'Médecine Interne & Urgences',
                    'password': 'demo'
                },
                {
                    'username': 'dr.martin',
                    'first_name': 'Sophie',
                    'last_name': 'Martin',
                    'email': 'sophie.martin@ch-hopital.fr',
                    'role': UserRole.RADIOLOGUE,
                    'service_medical': 'Service Central de Radiologie',
                    'password': 'demo'
                },
                {
                    'username': 'admin',
                    'first_name': 'Alexandre',
                    'last_name': 'Admin',
                    'email': 'admin@ch-hopital.fr',
                    'role': UserRole.ADMIN,
                    'service_medical': 'Direction des Systèmes d Information (DSI)',
                    'is_staff': True,
                    'is_superuser': True,
                    'password': 'admin'
                },
                {
                    'username': 'modality_ct',
                    'first_name': 'Console',
                    'last_name': 'Scanner CT01',
                    'email': 'scanner.ct01@modalites.local',
                    'role': UserRole.MODALITE_SERVICE,
                    'service_medical': 'Salle Scanner 1',
                    'password': 'demo'
                }
            ]

            users = {}
            for udata in users_data:
                pwd = udata.pop('password')
                user, created = User.objects.get_or_create(username=udata['username'], defaults=udata)
                user.set_password(pwd)
                for k, v in udata.items():
                    setattr(user, k, v)
                user.save()
                users[user.username] = user
                action_str = "Créé" if created else "Mis à jour"
                self.stdout.write(f"  -> {action_str} utilisateur {user.username} ({user.get_role_display()})")

            # 2. Patients de démonstration
            patients_data = [
                {
                    'nom': 'BERNARD',
                    'prenom': 'Pierre',
                    'date_naissance': date(1975, 4, 12),
                    'sexe': Patient.SexChoices.M,
                    'telephone': '06 12 34 56 78',
                    'adresse': '14 avenue des Vosges, 67000 Strasbourg'
                },
                {
                    'nom': 'LAURENT',
                    'prenom': 'Marie',
                    'date_naissance': date(1988, 11, 23),
                    'sexe': Patient.SexChoices.F,
                    'telephone': '06 23 45 67 89',
                    'adresse': '8 rue de la République, 69002 Lyon'
                },
                {
                    'nom': 'BENALI',
                    'prenom': 'Ahmed',
                    'date_naissance': date(1962, 8, 30),
                    'sexe': Patient.SexChoices.M,
                    'telephone': '06 34 56 78 90',
                    'adresse': '25 boulevard Michelet, 13008 Marseille'
                },
                {
                    'nom': 'DUBOIS',
                    'prenom': 'Claire',
                    'date_naissance': date(1995, 2, 14),
                    'sexe': Patient.SexChoices.F,
                    'telephone': '06 45 67 89 01',
                    'adresse': '5 square des Peupliers, 75013 Paris'
                },
                {
                    'nom': 'PETIT',
                    'prenom': 'Thomas',
                    'date_naissance': date(2005, 9, 5),
                    'sexe': Patient.SexChoices.M,
                    'telephone': '06 56 78 90 12',
                    'adresse': '19 allée des Tilleuls, 33000 Bordeaux'
                }
            ]

            patients = []
            for pdata in patients_data:
                patient = Patient.objects.filter(nom=pdata['nom'], prenom=pdata['prenom']).first()
                if not patient:
                    patient = Patient.objects.create(
                        ipp=Patient.generate_unique_ipp(),
                        **pdata
                    )
                    log_event(users['admin'], 'PATIENT_CREATE', 'Patient', str(patient.id), details={'ipp': patient.ipp})
                    self.stdout.write(f"  -> Créé patient {patient.nom} {patient.prenom} ({patient.ipp})")
                patients.append(patient)

            # 3. Examens couvrant tous les statuts
            doc = users['dr.dupont']
            rad = users['dr.martin']
            now = timezone.now()

            exams_specs = [
                # 1. DEMANDE - Routine
                {
                    'patient': patients[0],
                    'modalite': ModalityChoices.CR,
                    'region_anatomique': 'Thorax',
                    'type_examen': 'Radiographie pulmonaire face/profil',
                    'indication_clinique': 'Toux persistante depuis 3 semaines sans fièvre, suspicion bronchite traînante.',
                    'priorite': PriorityChoices.ROUTINE,
                    'statut': ExamStatusChoices.DEMANDE,
                    'medecin_demandeur': doc,
                    'date_demande': now - timedelta(hours=4)
                },
                # 2. DEMANDE - Urgent
                {
                    'patient': patients[1],
                    'modalite': ModalityChoices.CT,
                    'region_anatomique': 'Abdomen-Pelvis',
                    'type_examen': 'Scanner abdomino-pelvien injecté',
                    'indication_clinique': 'Douleur aiguë fosse iliaque droite fébrile (38.8°C), hyperleucocytose. Suspicion appendicite.',
                    'priorite': PriorityChoices.URGENT,
                    'statut': ExamStatusChoices.DEMANDE,
                    'medecin_demandeur': doc,
                    'date_demande': now - timedelta(hours=2)
                },
                # 3. PLANIFIE - Routine CT
                {
                    'patient': patients[2],
                    'modalite': ModalityChoices.CT,
                    'region_anatomique': 'Thorax',
                    'type_examen': 'Scanner thoracique haute résolution',
                    'indication_clinique': 'Bilan de surveillance nodule sous-pleural lobe supérieur droit.',
                    'priorite': PriorityChoices.ROUTINE,
                    'statut': ExamStatusChoices.PLANIFIE,
                    'medecin_demandeur': doc,
                    'radiologue_assigne': rad,
                    'date_demande': now - timedelta(days=1),
                    'date_planifiee': now + timedelta(hours=2)
                },
                # 4. PLANIFIE - Très Urgent MR
                {
                    'patient': patients[3],
                    'modalite': ModalityChoices.MR,
                    'region_anatomique': 'Cérébral',
                    'type_examen': 'IRM cérébrale avec séquences diffusion et FLAIR',
                    'indication_clinique': 'Céphalées brutales pulsatiles avec déficit sensitif transitoire hémicorps gauche.',
                    'priorite': PriorityChoices.TRES_URGENT,
                    'statut': ExamStatusChoices.PLANIFIE,
                    'medecin_demandeur': doc,
                    'radiologue_assigne': rad,
                    'date_demande': now - timedelta(hours=3),
                    'date_planifiee': now + timedelta(minutes=45)
                },
                # 5. REALISE - US Abdomen
                {
                    'patient': patients[4],
                    'modalite': ModalityChoices.US,
                    'region_anatomique': 'Abdomen',
                    'type_examen': 'Échographie hépato-bilio-pancréatique',
                    'indication_clinique': 'Coliques hépatiques post-prandiales, recherche lithiase vésiculaire.',
                    'priorite': PriorityChoices.ROUTINE,
                    'statut': ExamStatusChoices.REALISE,
                    'medecin_demandeur': doc,
                    'radiologue_assigne': rad,
                    'date_demande': now - timedelta(days=2),
                    'date_planifiee': now - timedelta(hours=5),
                    'date_realisation': now - timedelta(hours=4),
                    'study_instance_uid': '1.2.826.0.1.3680043.8.498.771239102481',
                    'report_status': ReportStatusChoices.AUCUN
                },
                # 6. REALISE - CT Crâne avec compte rendu en brouillon
                {
                    'patient': patients[0],
                    'modalite': ModalityChoices.CT,
                    'region_anatomique': 'Crâne',
                    'type_examen': 'Scanner cérébral sans injection',
                    'indication_clinique': 'Traumatisme crânien avec perte de connaissance brève consécutive à une chute.',
                    'priorite': PriorityChoices.URGENT,
                    'statut': ExamStatusChoices.REALISE,
                    'medecin_demandeur': doc,
                    'radiologue_assigne': rad,
                    'date_demande': now - timedelta(days=1),
                    'date_planifiee': now - timedelta(hours=6),
                    'date_realisation': now - timedelta(hours=5),
                    'study_instance_uid': '1.2.826.0.1.3680043.8.498.882194017320',
                    'report_text': 'Examen réalisé en urgence. Pas d hématome sous-dural ou extradural décelable. Système ventriculaire médian. Parenchyme homogène. Bilan osseux en cours de finalisation.',
                    'report_status': ReportStatusChoices.BROUILLON
                },
                # 7. TERMINE - MR Rachis avec compte rendu complet validé et HL7 ORU
                {
                    'patient': patients[1],
                    'modalite': ModalityChoices.MR,
                    'region_anatomique': 'Rachis',
                    'type_examen': 'IRM rachis lombaire sans injection',
                    'indication_clinique': 'Lombosciatique L5 droite hyperalgique résistante au traitement médical.',
                    'priorite': PriorityChoices.ROUTINE,
                    'statut': ExamStatusChoices.TERMINE,
                    'medecin_demandeur': doc,
                    'radiologue_assigne': rad,
                    'date_demande': now - timedelta(days=3),
                    'date_planifiee': now - timedelta(days=2),
                    'date_realisation': now - timedelta(days=2, hours=-1),
                    'study_instance_uid': '1.2.826.0.1.3680043.8.498.991203485172',
                    'report_text': (
                        "INDICATION :\nLombosciatique L5 droite rebelle.\n\n"
                        "RÉSULTATS :\n"
                        "- En L4-L5 : discopathie dégénérative modérée sans conflit radiculaire franc.\n"
                        "- En L5-S1 : hernie discale postéro-latérale droite venant comprimer le récessus latéral et l'émergence radiculaire L5 droite.\n"
                        "- Pas d'anomalie du cône terminal.\n\n"
                        "CONCLUSION :\nHernie discale L5-S1 droite conflictuelle concordante avec la symptomatologie clinique."
                    ),
                    'report_status': ReportStatusChoices.VALIDE
                },
                # 8. ANNULE - Annulation motivée
                {
                    'patient': patients[2],
                    'modalite': ModalityChoices.CR,
                    'region_anatomique': 'Membres',
                    'type_examen': 'Radiographie genou droit face et profil',
                    'indication_clinique': 'Gonalgie aiguë suite à entorse sportive.',
                    'priorite': PriorityChoices.ROUTINE,
                    'statut': ExamStatusChoices.ANNULE,
                    'motif_annulation': 'Le patient a annulé le rendez-vous suite à une amélioration spontanée des symptômes.',
                    'medecin_demandeur': doc,
                    'date_demande': now - timedelta(days=4)
                }
            ]

            # Création des examens et de leur écosystème (History, HL7, Audit)
            for spec in exams_specs:
                exam = ExamRequest.objects.create(
                    accession_number=ExamRequest.generate_unique_accession_number(),
                    **spec
                )

                # Message HL7 ORM^O01 initial
                generate_orm_o01(exam)

                # Événement d'audit initial
                log_event(
                    doc, 'EXAM_CREATE', 'ExamRequest', str(exam.id),
                    details={'accession': exam.accession_number, 'modalite': exam.modalite}
                )

                # Timeline d'historique
                StatusHistory.objects.create(
                    exam=exam,
                    ancien_statut='',
                    nouveau_statut=ExamStatusChoices.DEMANDE,
                    change_par=doc,
                    date=spec['date_demande'],
                    commentaire="Création initiale de la prescription d'examen (SIH)."
                )

                if spec['statut'] in [ExamStatusChoices.PLANIFIE, ExamStatusChoices.REALISE, ExamStatusChoices.TERMINE]:
                    StatusHistory.objects.create(
                        exam=exam,
                        ancien_statut=ExamStatusChoices.DEMANDE,
                        nouveau_statut=ExamStatusChoices.PLANIFIE,
                        change_par=rad,
                        date=spec['date_demande'] + timedelta(minutes=30),
                        commentaire=f"Planification de l'examen pour le {exam.date_planifiee.strftime('%d/%m/%Y %H:%M')}."
                    )

                if spec['statut'] in [ExamStatusChoices.REALISE, ExamStatusChoices.TERMINE]:
                    StatusHistory.objects.create(
                        exam=exam,
                        ancien_statut=ExamStatusChoices.PLANIFIE,
                        nouveau_statut=ExamStatusChoices.REALISE,
                        change_par=users['modality_ct'],
                        date=spec.get('date_realisation', now),
                        commentaire=f"Acquisition terminée. StudyInstanceUID: {exam.study_instance_uid}"
                    )

                if spec['statut'] == ExamStatusChoices.TERMINE:
                    StatusHistory.objects.create(
                        exam=exam,
                        ancien_statut=ExamStatusChoices.REALISE,
                        nouveau_statut=ExamStatusChoices.TERMINE,
                        change_par=rad,
                        date=spec.get('date_realisation', now) + timedelta(minutes=45),
                        commentaire="Validation et signature du compte rendu radiologique."
                    )
                    # Génération du message HL7 ORU^R01 pour examen terminé
                    generate_oru_r01(exam)

                if spec['statut'] == ExamStatusChoices.ANNULE:
                    StatusHistory.objects.create(
                        exam=exam,
                        ancien_statut=ExamStatusChoices.DEMANDE,
                        nouveau_statut=ExamStatusChoices.ANNULE,
                        change_par=doc,
                        date=spec['date_demande'] + timedelta(hours=1),
                        commentaire=f"Annulation : {spec['motif_annulation']}"
                    )

                self.stdout.write(f"  -> Créé examen {exam.accession_number} [{exam.modalite}] - Statut: {exam.statut}")

        self.stdout.write(self.style.SUCCESS("Jeu de données de démonstration initialisé avec succès !"))

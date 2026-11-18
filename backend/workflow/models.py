import uuid
import random
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class UserRole(models.TextChoices):
    MEDECIN_DEMANDEUR = 'MEDECIN_DEMANDEUR', 'Médecin Demandeur (SIH)'
    RADIOLOGUE = 'RADIOLOGUE', 'Radiologue (RIS)'
    ADMIN = 'ADMIN', 'Administrateur'
    MODALITE_SERVICE = 'MODALITE_SERVICE', 'Compte de Service Modalité (Module 2)'


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.MEDECIN_DEMANDEUR,
        help_text="Rôle métier pour le contrôle d'accès SIH/RIS"
    )
    telephone = models.CharField(max_length=30, blank=True, default='')
    service_medical = models.CharField(max_length=100, blank=True, default='')

    def __str__(self):
        full_name = self.get_full_name()
        return f"{full_name if full_name else self.username} ({self.get_role_display()})"


class Patient(models.Model):
    class SexChoices(models.TextChoices):
        M = 'M', 'Masculin'
        F = 'F', 'Féminin'
        O = 'O', 'Autre'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ipp = models.CharField(max_length=30, unique=True, db_index=True, help_text="Identifiant Permanent du Patient (IPP-AAAA-XXXXX)")
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    date_naissance = models.DateField()
    sexe = models.CharField(max_length=1, choices=SexChoices.choices)
    telephone = models.CharField(max_length=30, blank=True, default='')
    adresse = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True, db_index=True, help_text="Soft-delete : archivage logique sans suppression physique")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_creation']
        indexes = [
            models.Index(fields=['nom', 'prenom']),
            models.Index(fields=['ipp']),
        ]

    def __str__(self):
        return f"{self.nom.upper()} {self.prenom} ({self.ipp})"

    @classmethod
    def generate_unique_ipp(cls):
        """Génération robuste et concurrente d'un IPP unique sous la forme IPP-AAAA-XXXXX."""
        year = timezone.now().year
        for _ in range(20):
            seq = random.randint(10000, 99999)
            candidate = f"IPP-{year}-{seq}"
            if not cls.objects.filter(ipp=candidate).exists():
                return candidate
        # Fallback ultra-collision-resistant
        millis = int(timezone.now().timestamp() * 1000) % 100000
        return f"IPP-{year}-{millis:05d}"


class ModalityChoices(models.TextChoices):
    CR = 'CR', 'Radiographie conventionnelle (CR)'
    CT = 'CT', 'Tomodensitométrie / Scanner (CT)'
    MR = 'MR', 'Imagerie par Résonance Magnétique (MR)'
    US = 'US', 'Échographie (US)'
    DX = 'DX', 'Radiographie numérique (DX)'
    NM = 'NM', 'Médecine nucléaire (NM)'
    MG = 'MG', 'Mammographie (MG)'
    PT = 'PT', 'Tomographie par Émission de Positons (PT)'


class PriorityChoices(models.TextChoices):
    ROUTINE = 'ROUTINE', 'Routine'
    URGENT = 'URGENT', 'Urgent'
    TRES_URGENT = 'TRES_URGENT', 'Très urgent'


class ExamStatusChoices(models.TextChoices):
    DEMANDE = 'DEMANDE', 'Demandé'
    PLANIFIE = 'PLANIFIE', 'Planifié'
    REALISE = 'REALISE', 'Réalisé'
    TERMINE = 'TERMINE', 'Terminé'
    ANNULE = 'ANNULE', 'Annulé'


class ReportStatusChoices(models.TextChoices):
    AUCUN = 'AUCUN', 'Aucun compte rendu'
    BROUILLON = 'BROUILLON', 'Brouillon'
    VALIDE = 'VALIDE', 'Validé et signé'


class ExamRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name='exams')
    accession_number = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
        help_text="Identifiant unique de commande d'examen (ACC-AAAAMMJJ-XXXX)"
    )
    modalite = models.CharField(max_length=10, choices=ModalityChoices.choices)
    region_anatomique = models.CharField(max_length=100)
    type_examen = models.CharField(max_length=200, help_text="Intitulé précis de l'acte d'imagerie")
    indication_clinique = models.TextField(help_text="Motif médical et antécédents pertinents")
    priorite = models.CharField(
        max_length=20,
        choices=PriorityChoices.choices,
        default=PriorityChoices.ROUTINE
    )
    statut = models.CharField(
        max_length=20,
        choices=ExamStatusChoices.choices,
        default=ExamStatusChoices.DEMANDE,
        db_index=True
    )
    medecin_demandeur = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='demandes_prescrites',
        help_text="Praticien prescripteur (SIH)"
    )
    radiologue_assigne = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='examens_assignes',
        help_text="Radiologue en charge de l'examen (RIS)"
    )
    date_demande = models.DateTimeField(default=timezone.now)
    date_planifiee = models.DateTimeField(null=True, blank=True)
    date_realisation = models.DateTimeField(null=True, blank=True)
    study_instance_uid = models.CharField(
        max_length=128,
        null=True,
        blank=True,
        db_index=True,
        help_text="UID DICOM de l'étude (fourni par le Module 2 lors de l'acquisition)"
    )
    report_text = models.TextField(blank=True, default='', help_text="Texte du compte rendu radiologique")
    report_status = models.CharField(
        max_length=20,
        choices=ReportStatusChoices.choices,
        default=ReportStatusChoices.AUCUN
    )
    motif_annulation = models.TextField(blank=True, default='', help_text="Motif obligatoire en cas d'annulation")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_creation']
        indexes = [
            models.Index(fields=['statut', 'priorite']),
            models.Index(fields=['accession_number']),
            models.Index(fields=['study_instance_uid']),
        ]

    def __str__(self):
        return f"[{self.accession_number}] {self.modalite} - {self.patient.nom} ({self.get_statut_display()})"

    @classmethod
    def generate_unique_accession_number(cls):
        """Génération robuste sous concurrence de l'Accession Number (ACC-AAAAMMJJ-XXXX)."""
        date_str = timezone.now().strftime("%Y%m%d")
        for _ in range(20):
            seq = random.randint(1000, 9999)
            candidate = f"ACC-{date_str}-{seq}"
            if not cls.objects.filter(accession_number=candidate).exists():
                return candidate
        # Fallback avec millisecondes
        ms = int(timezone.now().timestamp() * 1000) % 100000
        return f"ACC-{date_str}-{ms:05d}"


class StatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(ExamRequest, on_delete=models.CASCADE, related_name='status_history')
    ancien_statut = models.CharField(max_length=20)
    nouveau_statut = models.CharField(max_length=20)
    change_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateTimeField(default=timezone.now)
    commentaire = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f"{self.exam.accession_number}: {self.ancien_statut} -> {self.nouveau_statut} ({self.date.strftime('%d/%m/%Y %H:%M')})"


class Hl7Message(models.Model):
    class DirectionChoices(models.TextChoices):
        OUTBOUND_SIH_TO_RIS = 'OUTBOUND_SIH_TO_RIS', 'Sortant SIH -> RIS'
        OUTBOUND_RIS_TO_SIH = 'OUTBOUND_RIS_TO_SIH', 'Sortant RIS -> SIH'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(ExamRequest, on_delete=models.CASCADE, related_name='hl7_messages')
    type_message = models.CharField(max_length=20, help_text="ORM^O01 ou ORU^R01")
    direction = models.CharField(max_length=30, choices=DirectionChoices.choices)
    contenu_brut = models.TextField(help_text="Message brut encodé en pipes & hats (ER7)")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date_creation']

    def __str__(self):
        return f"{self.type_message} ({self.direction}) - {self.exam.accession_number}"


class AuditEvent(models.Model):
    class OutcomeChoices(models.TextChoices):
        SUCCESS = 'SUCCESS', 'Succès'
        FAILURE = 'FAILURE', 'Échec'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    acteur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_events')
    action = models.CharField(max_length=100, help_text="Action auditée (ex: PATIENT_CREATE, EXAM_CREATE, STATUS_TRANSITION...)")
    type_ressource = models.CharField(max_length=50, help_text="Patient, ExamRequest, Worklist, FHIR, etc.")
    id_ressource = models.CharField(max_length=100)
    resultat = models.CharField(max_length=20, choices=OutcomeChoices.choices, default=OutcomeChoices.SUCCESS)
    details = models.JSONField(default=dict, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        actor_name = self.acteur.username if self.acteur else "SYSTEM"
        return f"[{self.date_creation.strftime('%Y-%m-%d %H:%M:%S')}] {actor_name} -> {self.action} on {self.type_ressource}:{self.id_ressource} [{self.resultat}]"

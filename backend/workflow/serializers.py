from datetime import date
from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    User, Patient, ExamRequest, StatusHistory, Hl7Message, AuditEvent,
    UserRole, ModalityChoices, PriorityChoices, ExamStatusChoices, ReportStatusChoices
)
from .audit import log_event
from .hl7 import generate_orm_o01


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'role', 'role_display', 'telephone', 'service_medical'
        ]
        read_only_fields = ['id']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Enrichit le token JWT avec les données du profil utilisateur et son rôle métier."""
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': str(self.user.id),
            'username': self.user.username,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': self.user.role,
            'role_display': self.user.get_role_display(),
            'service_medical': self.user.service_medical
        }
        return data


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'id', 'ipp', 'nom', 'prenom', 'date_naissance', 'sexe',
            'telephone', 'adresse', 'is_active', 'date_creation', 'date_modification'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification']
        extra_kwargs = {
            'ipp': {'required': False}
        }

    def validate_date_naissance(self, value):
        if value > date.today():
            raise serializers.ValidationError("La date de naissance ne peut pas être dans le futur.")
        return value

    def create(self, validated_data):
        # Génération automatique d'un IPP unique si non fourni
        if not validated_data.get('ipp'):
            validated_data['ipp'] = Patient.generate_unique_ipp()

        # Enregistrement robuste avec retry en cas de collision
        for _ in range(5):
            try:
                with transaction.atomic():
                    patient = super().create(validated_data)
                    request = self.context.get('request')
                    user = request.user if request else None
                    log_event(
                        actor=user,
                        action='PATIENT_CREATE',
                        resource_type='Patient',
                        resource_id=str(patient.id),
                        outcome='SUCCESS',
                        details={'ipp': patient.ipp, 'nom': patient.nom, 'prenom': patient.prenom}
                    )
                    return patient
            except IntegrityError:
                validated_data['ipp'] = Patient.generate_unique_ipp()

        raise serializers.ValidationError({"ipp": "Impossible de générer un IPP unique après plusieurs tentatives."})

    def update(self, instance, validated_data):
        patient = super().update(instance, validated_data)
        request = self.context.get('request')
        user = request.user if request else None
        log_event(
            actor=user,
            action='PATIENT_UPDATE',
            resource_type='Patient',
            resource_id=str(patient.id),
            outcome='SUCCESS',
            details={'ipp': patient.ipp}
        )
        return patient


class StatusHistorySerializer(serializers.ModelSerializer):
    change_par_username = serializers.CharField(source='change_par.username', read_only=True, default='')
    change_par_name = serializers.SerializerMethodField()

    class Meta:
        model = StatusHistory
        fields = [
            'id', 'ancien_statut', 'nouveau_statut',
            'change_par', 'change_par_username', 'change_par_name',
            'date', 'commentaire'
        ]

    def get_change_par_name(self, obj):
        if obj.change_par:
            full = obj.change_par.get_full_name()
            return full if full else obj.change_par.username
        return "SYSTÈME"


class Hl7MessageSerializer(serializers.ModelSerializer):
    direction_display = serializers.CharField(source='get_direction_display', read_only=True)

    class Meta:
        model = Hl7Message
        fields = ['id', 'type_message', 'direction', 'direction_display', 'contenu_brut', 'date_creation']


class ExamRequestListSerializer(serializers.ModelSerializer):
    patient_nom = serializers.CharField(source='patient.nom', read_only=True)
    patient_prenom = serializers.CharField(source='patient.prenom', read_only=True)
    patient_ipp = serializers.CharField(source='patient.ipp', read_only=True)
    medecin_demandeur_name = serializers.SerializerMethodField()
    radiologue_assigne_name = serializers.SerializerMethodField()
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_display = serializers.CharField(source='get_priorite_display', read_only=True)
    modalite_display = serializers.CharField(source='get_modalite_display', read_only=True)

    class Meta:
        model = ExamRequest
        fields = [
            'id', 'accession_number', 'patient', 'patient_nom', 'patient_prenom', 'patient_ipp',
            'modalite', 'modalite_display', 'region_anatomique', 'type_examen',
            'priorite', 'priorite_display', 'statut', 'statut_display',
            'medecin_demandeur', 'medecin_demandeur_name',
            'radiologue_assigne', 'radiologue_assigne_name',
            'date_demande', 'date_planifiee', 'date_realisation',
            'study_instance_uid', 'report_status', 'date_creation'
        ]

    def get_medecin_demandeur_name(self, obj):
        return obj.medecin_demandeur.get_full_name() if obj.medecin_demandeur else ""

    def get_radiologue_assigne_name(self, obj):
        return obj.radiologue_assigne.get_full_name() if obj.radiologue_assigne else ""


class ExamRequestDetailSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.filter(is_active=True),
        source='patient',
        write_only=True
    )
    medecin_demandeur = UserSerializer(read_only=True)
    radiologue_assigne = UserSerializer(read_only=True)
    status_history = StatusHistorySerializer(many=True, read_only=True)
    hl7_messages = Hl7MessageSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    priorite_display = serializers.CharField(source='get_priorite_display', read_only=True)
    modalite_display = serializers.CharField(source='get_modalite_display', read_only=True)
    report_status_display = serializers.CharField(source='get_report_status_display', read_only=True)

    class Meta:
        model = ExamRequest
        fields = [
            'id', 'patient', 'patient_id', 'accession_number',
            'modalite', 'modalite_display', 'region_anatomique', 'type_examen',
            'indication_clinique', 'priorite', 'priorite_display',
            'statut', 'statut_display',
            'medecin_demandeur', 'radiologue_assigne',
            'date_demande', 'date_planifiee', 'date_realisation',
            'study_instance_uid', 'report_text', 'report_status', 'report_status_display',
            'motif_annulation', 'status_history', 'hl7_messages',
            'date_creation', 'date_modification'
        ]
        read_only_fields = [
            'id', 'accession_number', 'statut', 'medecin_demandeur',
            'date_demande', 'study_instance_uid', 'date_creation', 'date_modification'
        ]


class ExamCreateSerializer(serializers.ModelSerializer):
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.filter(is_active=True),
        source='patient',
        write_only=True
    )

    class Meta:
        model = ExamRequest
        fields = [
            'id', 'patient_id', 'accession_number', 'modalite', 'region_anatomique',
            'type_examen', 'indication_clinique', 'priorite', 'statut', 'date_demande'
        ]
        read_only_fields = ['id', 'accession_number', 'statut', 'date_demande']

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None

        # Génération sûre en concurrence avec retry
        for _ in range(10):
            try:
                with transaction.atomic():
                    accession = ExamRequest.generate_unique_accession_number()
                    exam = ExamRequest.objects.create(
                        accession_number=accession,
                        medecin_demandeur=user,
                        statut=ExamStatusChoices.DEMANDE,
                        date_demande=timezone.now(),
                        **validated_data
                    )

                    # 1. Création de l'historique initial
                    StatusHistory.objects.create(
                        exam=exam,
                        ancien_statut='',
                        nouveau_statut=ExamStatusChoices.DEMANDE,
                        change_par=user,
                        commentaire="Création initiale de la demande d'examen par le prescripteur (SIH)"
                    )

                    # 2. Simulation HL7 : Génération automatique du message ORM^O01 (SIH -> RIS)
                    generate_orm_o01(exam)

                    # 3. Journalisation d'audit
                    log_event(
                        actor=user,
                        action='EXAM_CREATE',
                        resource_type='ExamRequest',
                        resource_id=str(exam.id),
                        outcome='SUCCESS',
                        details={
                            'accession_number': exam.accession_number,
                            'patient_ipp': exam.patient.ipp,
                            'modalite': exam.modalite,
                            'priorite': exam.priorite
                        }
                    )
                    return exam
            except IntegrityError:
                continue

        raise serializers.ValidationError({"accession_number": "Échec de génération d'un Accession Number unique."})


# Sérialiseurs d'actions du workflow

class ScheduleExamSerializer(serializers.Serializer):
    date_planifiee = serializers.DateTimeField(required=True)
    radiologue_assigne_id = serializers.UUIDField(required=False, allow_null=True)


class MarkPerformedSerializer(serializers.Serializer):
    study_instance_uid = serializers.CharField(required=True, max_length=128)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class SaveReportSerializer(serializers.Serializer):
    report_text = serializers.CharField(required=True, allow_blank=False)


class ValidateReportSerializer(serializers.Serializer):
    report_text = serializers.CharField(required=True, allow_blank=False)


class CancelExamSerializer(serializers.Serializer):
    motif_annulation = serializers.CharField(required=True, min_length=3, help_text="Motif obligatoire d'annulation")


class AuditEventSerializer(serializers.ModelSerializer):
    acteur_username = serializers.CharField(source='acteur.username', read_only=True, default='SYSTEM')

    class Meta:
        model = AuditEvent
        fields = ['id', 'date_creation', 'acteur', 'acteur_username', 'action', 'type_ressource', 'id_ressource', 'resultat', 'details']

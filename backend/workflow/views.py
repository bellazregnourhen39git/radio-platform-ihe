from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    User, Patient, ExamRequest, StatusHistory, AuditEvent,
    ExamStatusChoices, ReportStatusChoices, UserRole
)
from .serializers import (
    UserSerializer, CustomTokenObtainPairSerializer,
    PatientSerializer, StatusHistorySerializer,
    ExamRequestListSerializer, ExamRequestDetailSerializer, ExamCreateSerializer,
    ScheduleExamSerializer, MarkPerformedSerializer,
    SaveReportSerializer, ValidateReportSerializer, CancelExamSerializer,
    AuditEventSerializer
)
from .permissions import (
    IsMedecinDemandeur, IsRadiologue, IsModaliteServiceOrRadiologue,
    IsAdminUserRole, IsClinicalStaff
)
from .audit import log_event
from .hl7 import generate_oru_r01


class CustomTokenObtainPairView(TokenObtainPairView):
    """Endpoint d'authentification JWT enrichi avec le rôle de l'utilisateur."""
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """Consultation des praticiens et profils utilisateurs."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class PatientViewSet(viewsets.ModelViewSet):
    """
    CRUD et recherche des dossiers patients.
    Garantit le soft-delete (pas de suppression physique).
    """
    queryset = Patient.objects.filter(is_active=True)
    serializer_class = PatientSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['nom', 'prenom', 'ipp', 'telephone']
    filterset_fields = ['sexe', 'is_active']
    ordering_fields = ['date_creation', 'nom', 'date_naissance']
    ordering = ['-date_creation']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsMedecinDemandeur()]
        return [IsClinicalStaff()]

    def perform_destroy(self, instance):
        """Soft-delete : marquage is_active=False."""
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        log_event(
            actor=self.request.user,
            action='PATIENT_SOFT_DELETE',
            resource_type='Patient',
            resource_id=str(instance.id),
            outcome='SUCCESS',
            details={'ipp': instance.ipp}
        )

    @action(detail=True, methods=['get'])
    def exams(self, request, pk=None):
        """Historique complet des examens d'un patient donné, avec filtres."""
        patient = self.get_object()
        exams = ExamRequest.objects.filter(patient=patient).select_related(
            'medecin_demandeur', 'radiologue_assigne'
        )

        statut = request.query_params.get('statut')
        modalite = request.query_params.get('modalite')
        if statut:
            exams = exams.filter(statut=statut)
        if modalite:
            exams = exams.filter(modalite=modalite)

        serializer = ExamRequestListSerializer(exams, many=True)
        return Response(serializer.data)


class ExamRequestViewSet(viewsets.ModelViewSet):
    """
    Gestion des demandes d'examen et orchestration du workflow (SIH / RIS).
    Toutes les transitions d'état sont exécutées sous transaction atomique et select_for_update.
    """
    queryset = ExamRequest.objects.all().select_related(
        'patient', 'medecin_demandeur', 'radiologue_assigne'
    ).prefetch_related('status_history', 'hl7_messages')
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['statut', 'modalite', 'priorite', 'report_status']
    search_fields = ['accession_number', 'patient__nom', 'patient__prenom', 'patient__ipp', 'type_examen']
    ordering_fields = ['date_creation', 'date_demande', 'date_planifiee', 'priorite']
    ordering = ['-date_creation']

    def get_serializer_class(self):
        if self.action == 'create':
            return ExamCreateSerializer
        if self.action == 'list':
            return ExamRequestListSerializer
        return ExamRequestDetailSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsMedecinDemandeur()]
        if self.action in ['schedule', 'save_report', 'validate_report']:
            return [IsRadiologue()]
        if self.action == 'mark_performed':
            return [IsModaliteServiceOrRadiologue()]
        if self.action == 'cancel':
            return [IsClinicalStaff()]
        return [IsClinicalStaff()]

    @action(detail=True, methods=['post'], url_path='schedule')
    def schedule(self, request, pk=None):
        """
        Action RIS : Planification de l'examen (DEMANDE -> PLANIFIE).
        Exige une date_planifiee valide.
        """
        serializer = ScheduleExamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            exam = ExamRequest.objects.select_for_update().get(pk=pk)

            # Validation transition d'état
            if exam.statut != ExamStatusChoices.DEMANDE:
                raise ValidationError({
                    "error": "Transition de statut illégale",
                    "detail": f"Impossible de planifier un examen avec le statut actuel '{exam.statut}'. Statut requis: 'DEMANDE'."
                })

            date_planifiee = serializer.validated_data['date_planifiee']
            radio_id = serializer.validated_data.get('radiologue_assigne_id')

            exam.date_planifiee = date_planifiee
            if radio_id:
                try:
                    radio = User.objects.get(pk=radio_id)
                    exam.radiologue_assigne = radio
                except User.DoesNotExist:
                    pass
            elif not exam.radiologue_assigne and request.user.role == UserRole.RADIOLOGUE:
                exam.radiologue_assigne = request.user

            exam.statut = ExamStatusChoices.PLANIFIE
            exam.save()

            StatusHistory.objects.create(
                exam=exam,
                ancien_statut=ExamStatusChoices.DEMANDE,
                nouveau_statut=ExamStatusChoices.PLANIFIE,
                change_par=request.user,
                commentaire=f"Examen planifié pour le {date_planifiee.strftime('%d/%m/%Y à %H:%M')}"
            )

            log_event(
                actor=request.user,
                action='STATUS_TRANSITION',
                resource_type='ExamRequest',
                resource_id=str(exam.id),
                outcome='SUCCESS',
                details={'from': 'DEMANDE', 'to': 'PLANIFIE', 'date_planifiee': date_planifiee.isoformat()}
            )

        return Response(ExamRequestDetailSerializer(exam).data)

    @action(detail=True, methods=['post'], url_path='mark-performed')
    def mark_performed(self, request, pk=None):
        """
        Action RIS / Modalité (P2) : Marquer l'examen comme réalisé (PLANIFIE -> REALISE).
        Fournit le study_instance_uid généré par la modalité / PACS.
        """
        serializer = MarkPerformedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            exam = ExamRequest.objects.select_for_update().get(pk=pk)

            if exam.statut != ExamStatusChoices.PLANIFIE:
                raise ValidationError({
                    "error": "Transition de statut illégale",
                    "detail": f"Impossible de marquer réalisé un examen avec le statut '{exam.statut}'. Statut requis: 'PLANIFIE'."
                })

            exam.study_instance_uid = serializer.validated_data['study_instance_uid']
            exam.date_realisation = timezone.now()
            exam.statut = ExamStatusChoices.REALISE
            exam.save()

            notes = serializer.validated_data.get('notes', '')
            commentaire = f"Acquisition terminée. StudyInstanceUID: {exam.study_instance_uid}."
            if notes:
                commentaire += f" Notes: {notes}"

            StatusHistory.objects.create(
                exam=exam,
                ancien_statut=ExamStatusChoices.PLANIFIE,
                nouveau_statut=ExamStatusChoices.REALISE,
                change_par=request.user,
                commentaire=commentaire
            )

            log_event(
                actor=request.user,
                action='STATUS_TRANSITION',
                resource_type='ExamRequest',
                resource_id=str(exam.id),
                outcome='SUCCESS',
                details={
                    'from': 'PLANIFIE',
                    'to': 'REALISE',
                    'study_instance_uid': exam.study_instance_uid
                }
            )

        return Response(ExamRequestDetailSerializer(exam).data)

    @action(detail=True, methods=['post'], url_path='save-report')
    def save_report(self, request, pk=None):
        """Action RIS : Enregistre un brouillon de compte rendu (statut BROUILLON)."""
        serializer = SaveReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            exam = ExamRequest.objects.select_for_update().get(pk=pk)

            if exam.statut not in [ExamStatusChoices.REALISE, ExamStatusChoices.TERMINE]:
                raise ValidationError({
                    "error": "Action impossible",
                    "detail": "Un compte rendu ne peut être rédigé que pour un examen réalisé ou terminé."
                })

            exam.report_text = serializer.validated_data['report_text']
            if exam.statut != ExamStatusChoices.TERMINE:
                exam.report_status = ReportStatusChoices.BROUILLON
            if not exam.radiologue_assigne:
                exam.radiologue_assigne = request.user
            exam.save()

            log_event(
                actor=request.user,
                action='REPORT_SAVE_DRAFT',
                resource_type='ExamRequest',
                resource_id=str(exam.id),
                outcome='SUCCESS'
            )

        return Response(ExamRequestDetailSerializer(exam).data)

    @action(detail=True, methods=['post'], url_path='validate-report')
    def validate_report(self, request, pk=None):
        """
        Action RIS : Valide le compte rendu et termine l'examen (REALISE -> TERMINE).
        Génère automatiquement le message HL7 ORU^R01 (RIS -> SIH).
        """
        serializer = ValidateReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            exam = ExamRequest.objects.select_for_update().get(pk=pk)

            if exam.statut != ExamStatusChoices.REALISE:
                raise ValidationError({
                    "error": "Transition de statut illégale",
                    "detail": f"Impossible de valider un compte rendu pour un examen au statut '{exam.statut}'. Statut requis: 'REALISE'."
                })

            exam.report_text = serializer.validated_data['report_text']
            exam.report_status = ReportStatusChoices.VALIDE
            exam.statut = ExamStatusChoices.TERMINE
            if not exam.radiologue_assigne:
                exam.radiologue_assigne = request.user
            exam.save()

            StatusHistory.objects.create(
                exam=exam,
                ancien_statut=ExamStatusChoices.REALISE,
                nouveau_statut=ExamStatusChoices.TERMINE,
                change_par=request.user,
                commentaire="Validation finale du compte rendu radiologique et clôture de l'examen."
            )

            # Simulation HL7 : Génération du message ORU^R01
            generate_oru_r01(exam)

            log_event(
                actor=request.user,
                action='STATUS_TRANSITION',
                resource_type='ExamRequest',
                resource_id=str(exam.id),
                outcome='SUCCESS',
                details={'from': 'REALISE', 'to': 'TERMINE', 'report_status': 'VALIDE'}
            )

        return Response(ExamRequestDetailSerializer(exam).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """
        Action SIH / RIS : Annule une demande d'examen.
        Exige obligatoirement un motif_annulation.
        Ne peut être annulé que si statut est DEMANDE ou PLANIFIE.
        """
        serializer = CancelExamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            exam = ExamRequest.objects.select_for_update().get(pk=pk)

            if exam.statut not in [ExamStatusChoices.DEMANDE, ExamStatusChoices.PLANIFIE]:
                raise ValidationError({
                    "error": "Transition de statut illégale",
                    "detail": f"Impossible d'annuler un examen avec le statut '{exam.statut}'. Seuls les examens DEMANDE ou PLANIFIE peuvent être annulés."
                })

            ancien_statut = exam.statut
            motif = serializer.validated_data['motif_annulation']
            exam.statut = ExamStatusChoices.ANNULE
            exam.motif_annulation = motif
            exam.save()

            StatusHistory.objects.create(
                exam=exam,
                ancien_statut=ancien_statut,
                nouveau_statut=ExamStatusChoices.ANNULE,
                change_par=request.user,
                commentaire=f"Annulation de l'examen. Motif: {motif}"
            )

            log_event(
                actor=request.user,
                action='EXAM_CANCELLED',
                resource_type='ExamRequest',
                resource_id=str(exam.id),
                outcome='SUCCESS',
                details={'from': ancien_statut, 'to': 'ANNULE', 'motif': motif}
            )

        return Response(ExamRequestDetailSerializer(exam).data)


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Consultation des journaux d'audit (réservé aux administrateurs / P4 ATNA)."""
    queryset = AuditEvent.objects.all().select_related('acteur')
    serializer_class = AuditEventSerializer
    permission_classes = [IsAdminUserRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['action', 'type_ressource', 'resultat']
    search_fields = ['action', 'type_ressource', 'id_ressource', 'acteur__username']
    ordering = ['-date_creation']

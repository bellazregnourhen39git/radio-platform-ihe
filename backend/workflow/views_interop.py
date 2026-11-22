import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import permissions, status
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from .models import Patient, ExamRequest, ExamStatusChoices
from .permissions import IsModaliteServiceOrRadiologue, IsClinicalStaff
from .audit import log_event
from .fhir import (
    patient_to_fhir_r4,
    exam_to_fhir_servicerequest_r4,
    exam_to_fhir_diagnosticreport_r4
)

logger = logging.getLogger(__name__)


class DicomWorklistView(APIView):
    """
    Simulation de DICOM Modality Worklist (C-FIND Worklist Information Model).
    Consommé par le Module 2 (Acquisition / Modalité simulée).
    """
    permission_classes = [IsModaliteServiceOrRadiologue]

    @extend_schema(
        summary="Interrogation de la DICOM Modality Worklist",
        description="Retourne les procédures d'imagerie planifiées au format normalisé DICOM C-FIND.",
        parameters=[
            OpenApiParameter('status', OpenApiTypes.STR, description="Statut de l'examen (défaut: PLANIFIE)", default='PLANIFIE'),
            OpenApiParameter('modality', OpenApiTypes.STR, description="Filtre par modalité DICOM (ex: CT, MR, CR, US)"),
            OpenApiParameter('date', OpenApiTypes.DATE, description="Date prévue (AAAA-MM-JJ)"),
        ]
    )
    def get(self, request):
        status_filter = request.query_params.get('status', ExamStatusChoices.PLANIFIE)
        modality = request.query_params.get('modality')
        date_str = request.query_params.get('date')

        exams = ExamRequest.objects.select_related('patient', 'medecin_demandeur', 'radiologue_assigne')

        if status_filter:
            exams = exams.filter(statut=status_filter)
        if modality:
            exams = exams.filter(modalite=modality.upper())
        if date_str:
            exams = exams.filter(date_planifiee__date=date_str)

        worklist_items = []
        for exam in exams:
            patient = exam.patient
            birth_date = patient.date_naissance.strftime('%Y%m%d') if patient.date_naissance else ''
            step_start_date = exam.date_planifiee.strftime('%Y%m%d') if exam.date_planifiee else ''
            step_start_time = exam.date_planifiee.strftime('%H%M%S') if exam.date_planifiee else ''

            doctor_name = (
                exam.medecin_demandeur.get_full_name()
                if exam.medecin_demandeur and exam.medecin_demandeur.get_full_name()
                else (exam.medecin_demandeur.username if exam.medecin_demandeur else '')
            )

            worklist_items.append({
                "PatientID": patient.ipp,
                "PatientName": f"{patient.nom.upper()}^{patient.prenom}",
                "PatientBirthDate": birth_date,
                "PatientSex": patient.sexe,
                "AccessionNumber": exam.accession_number,
                "Modality": exam.modalite,
                "ScheduledProcedureStepDescription": exam.type_examen,
                "ScheduledProcedureStepStartDate": step_start_date,
                "ScheduledProcedureStepStartTime": step_start_time,
                "ScheduledStationAETitle": f"MOD_{exam.modalite}01",
                "ReferringPhysicianName": doctor_name,
                "RequestedProcedureID": str(exam.id),
                "ExamID": str(exam.id),
                "StudyInstanceUID": exam.study_instance_uid or "",
                "Priority": exam.priorite,
                "ClinicalIndication": exam.indication_clinique
            })

        log_event(
            actor=request.user,
            action='WORKLIST_QUERY',
            resource_type='Worklist',
            resource_id=f"count={len(worklist_items)}",
            outcome='SUCCESS',
            details={'modality': modality, 'status': status_filter, 'date': date_str}
        )

        return Response(worklist_items)


class FhirPatientDetailView(APIView):
    """Exposition FHIR R4 de la ressource Patient."""
    permission_classes = [permissions.AllowAny]  # Point d'intégration modulable par P4 (IUA / OAuth2)

    @extend_schema(summary="Ressource FHIR R4 Patient", responses={200: OpenApiTypes.OBJECT})
    def get(self, request, id):
        patient = get_object_or_404(Patient, id=id)
        fhir_data = patient_to_fhir_r4(patient)

        log_event(
            actor=request.user if request.user.is_authenticated else None,
            action='FHIR_READ_PATIENT',
            resource_type='Patient',
            resource_id=str(patient.id),
            outcome='SUCCESS'
        )

        return Response(fhir_data, content_type="application/fhir+json; charset=utf-8")


# =================================================================
# Module 2 — Endpoints d'intégration PACS (Orthanc)
# =================================================================

class PacsStudyDetailView(APIView):
    """
    Proxy vers Orthanc pour récupérer les informations PACS
    d'un examen ayant un StudyInstanceUID.
    """
    permission_classes = [IsClinicalStaff]

    @extend_schema(
        summary="Détails PACS d'un examen",
        description="Récupère les informations de l'étude DICOM associée à un examen.",
        responses={200: OpenApiTypes.OBJECT}
    )
    def get(self, request, exam_id):
        exam = get_object_or_404(ExamRequest, id=exam_id)
        if not exam.study_instance_uid:
            return Response(
                {"detail": "Aucune image DICOM associée à cet examen."},
                status=status.HTTP_404_NOT_FOUND
            )

        result = {
            "study_instance_uid": exam.study_instance_uid,
            "accession_number": exam.accession_number,
            "patient_ipp": exam.patient.ipp,
            "ohif_viewer_url": f"/ohif/viewer?StudyInstanceUIDs={exam.study_instance_uid}"
        }

        try:
            from .pacs import find_studies_by_uid, get_study_series
            studies = find_studies_by_uid(exam.study_instance_uid)
            result["orthanc_studies"] = studies
        except Exception as e:
            logger.warning(f"Impossible de contacter Orthanc: {e}")
            result["orthanc_studies"] = []
            result["orthanc_error"] = str(e)

        log_event(
            actor=request.user,
            action='PACS_STUDY_READ',
            resource_type='ExamRequest',
            resource_id=str(exam.id),
            outcome='SUCCESS',
            details={'study_instance_uid': exam.study_instance_uid}
        )

        return Response(result)


class PacsInfoView(APIView):
    """Récupère les statistiques du PACS Orthanc (nombre d'études, séries, instances)."""
    permission_classes = [IsClinicalStaff]

    def get(self, request):
        try:
            from .pacs import get_statistics
            stats = get_statistics()
            return Response(stats)
        except Exception as e:
            logger.warning(f"Impossible de contacter Orthanc: {e}")
            return Response(
                {"detail": f"PACS Orthanc indisponible: {e}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )


class PacsUploadView(APIView):
    """Upload d'un fichier DICOM vers Orthanc via le backend."""
    permission_classes = [IsModaliteServiceOrRadiologue]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {"detail": "Aucun fichier DICOM fourni."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .pacs import upload_dicom_instance
            dicom_bytes = file.read()
            result = upload_dicom_instance(dicom_bytes)

            log_event(
                actor=request.user,
                action='PACS_DICOM_UPLOAD',
                resource_type='DicomInstance',
                resource_id=result.get('ID', 'unknown'),
                outcome='SUCCESS',
                details={'filename': file.name, 'status': result.get('Status', '')}
            )

            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Erreur upload DICOM: {e}")
            return Response(
                {"detail": f"Erreur lors de l'upload DICOM: {e}"},
                status=status.HTTP_502_BAD_GATEWAY
            )


class FhirServiceRequestDetailView(APIView):
    """Exposition FHIR R4 de la demande d'examen (ServiceRequest)."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(summary="Ressource FHIR R4 ServiceRequest", responses={200: OpenApiTypes.OBJECT})
    def get(self, request, id):
        exam = get_object_or_404(ExamRequest.objects.select_related('patient', 'medecin_demandeur'), id=id)
        fhir_data = exam_to_fhir_servicerequest_r4(exam)

        log_event(
            actor=request.user if request.user.is_authenticated else None,
            action='FHIR_READ_SERVICEREQUEST',
            resource_type='ExamRequest',
            resource_id=str(exam.id),
            outcome='SUCCESS'
        )

        return Response(fhir_data, content_type="application/fhir+json; charset=utf-8")


# =================================================================
# Module 2 — Endpoints d'intégration PACS (Orthanc)
# =================================================================

class PacsStudyDetailView(APIView):
    """
    Proxy vers Orthanc pour récupérer les informations PACS
    d'un examen ayant un StudyInstanceUID.
    """
    permission_classes = [IsClinicalStaff]

    @extend_schema(
        summary="Détails PACS d'un examen",
        description="Récupère les informations de l'étude DICOM associée à un examen.",
        responses={200: OpenApiTypes.OBJECT}
    )
    def get(self, request, exam_id):
        exam = get_object_or_404(ExamRequest, id=exam_id)
        if not exam.study_instance_uid:
            return Response(
                {"detail": "Aucune image DICOM associée à cet examen."},
                status=status.HTTP_404_NOT_FOUND
            )

        result = {
            "study_instance_uid": exam.study_instance_uid,
            "accession_number": exam.accession_number,
            "patient_ipp": exam.patient.ipp,
            "ohif_viewer_url": f"/ohif/viewer?StudyInstanceUIDs={exam.study_instance_uid}"
        }

        try:
            from .pacs import find_studies_by_uid, get_study_series
            studies = find_studies_by_uid(exam.study_instance_uid)
            result["orthanc_studies"] = studies
        except Exception as e:
            logger.warning(f"Impossible de contacter Orthanc: {e}")
            result["orthanc_studies"] = []
            result["orthanc_error"] = str(e)

        log_event(
            actor=request.user,
            action='PACS_STUDY_READ',
            resource_type='ExamRequest',
            resource_id=str(exam.id),
            outcome='SUCCESS',
            details={'study_instance_uid': exam.study_instance_uid}
        )

        return Response(result)


class PacsInfoView(APIView):
    """Récupère les statistiques du PACS Orthanc (nombre d'études, séries, instances)."""
    permission_classes = [IsClinicalStaff]

    def get(self, request):
        try:
            from .pacs import get_statistics
            stats = get_statistics()
            return Response(stats)
        except Exception as e:
            logger.warning(f"Impossible de contacter Orthanc: {e}")
            return Response(
                {"detail": f"PACS Orthanc indisponible: {e}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )


class PacsUploadView(APIView):
    """Upload d'un fichier DICOM vers Orthanc via le backend."""
    permission_classes = [IsModaliteServiceOrRadiologue]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {"detail": "Aucun fichier DICOM fourni."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .pacs import upload_dicom_instance
            dicom_bytes = file.read()
            result = upload_dicom_instance(dicom_bytes)

            log_event(
                actor=request.user,
                action='PACS_DICOM_UPLOAD',
                resource_type='DicomInstance',
                resource_id=result.get('ID', 'unknown'),
                outcome='SUCCESS',
                details={'filename': file.name, 'status': result.get('Status', '')}
            )

            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Erreur upload DICOM: {e}")
            return Response(
                {"detail": f"Erreur lors de l'upload DICOM: {e}"},
                status=status.HTTP_502_BAD_GATEWAY
            )


class FhirDiagnosticReportDetailView(APIView):
    """Exposition FHIR R4 du compte rendu radiologique (DiagnosticReport)."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(summary="Ressource FHIR R4 DiagnosticReport", responses={200: OpenApiTypes.OBJECT})
    def get(self, request, id):
        exam = get_object_or_404(ExamRequest.objects.select_related('patient', 'radiologue_assigne'), id=id)
        fhir_data = exam_to_fhir_diagnosticreport_r4(exam)

        log_event(
            actor=request.user if request.user.is_authenticated else None,
            action='FHIR_READ_DIAGNOSTICREPORT',
            resource_type='ExamRequest',
            resource_id=str(exam.id),
            outcome='SUCCESS'
        )

        return Response(fhir_data, content_type="application/fhir+json; charset=utf-8")


# =================================================================
# Module 2 — Endpoints d'intégration PACS (Orthanc)
# =================================================================

class PacsStudyDetailView(APIView):
    """
    Proxy vers Orthanc pour récupérer les informations PACS
    d'un examen ayant un StudyInstanceUID.
    """
    permission_classes = [IsClinicalStaff]

    @extend_schema(
        summary="Détails PACS d'un examen",
        description="Récupère les informations de l'étude DICOM associée à un examen.",
        responses={200: OpenApiTypes.OBJECT}
    )
    def get(self, request, exam_id):
        exam = get_object_or_404(ExamRequest, id=exam_id)
        if not exam.study_instance_uid:
            return Response(
                {"detail": "Aucune image DICOM associée à cet examen."},
                status=status.HTTP_404_NOT_FOUND
            )

        result = {
            "study_instance_uid": exam.study_instance_uid,
            "accession_number": exam.accession_number,
            "patient_ipp": exam.patient.ipp,
            "ohif_viewer_url": f"/ohif/viewer?StudyInstanceUIDs={exam.study_instance_uid}"
        }

        try:
            from .pacs import find_studies_by_uid, get_study_series
            studies = find_studies_by_uid(exam.study_instance_uid)
            result["orthanc_studies"] = studies
        except Exception as e:
            logger.warning(f"Impossible de contacter Orthanc: {e}")
            result["orthanc_studies"] = []
            result["orthanc_error"] = str(e)

        log_event(
            actor=request.user,
            action='PACS_STUDY_READ',
            resource_type='ExamRequest',
            resource_id=str(exam.id),
            outcome='SUCCESS',
            details={'study_instance_uid': exam.study_instance_uid}
        )

        return Response(result)


class PacsInfoView(APIView):
    """Récupère les statistiques du PACS Orthanc (nombre d'études, séries, instances)."""
    permission_classes = [IsClinicalStaff]

    def get(self, request):
        try:
            from .pacs import get_statistics
            stats = get_statistics()
            return Response(stats)
        except Exception as e:
            logger.warning(f"Impossible de contacter Orthanc: {e}")
            return Response(
                {"detail": f"PACS Orthanc indisponible: {e}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )


class PacsUploadView(APIView):
    """Upload d'un fichier DICOM vers Orthanc via le backend."""
    permission_classes = [IsModaliteServiceOrRadiologue]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {"detail": "Aucun fichier DICOM fourni."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .pacs import upload_dicom_instance
            dicom_bytes = file.read()
            result = upload_dicom_instance(dicom_bytes)

            log_event(
                actor=request.user,
                action='PACS_DICOM_UPLOAD',
                resource_type='DicomInstance',
                resource_id=result.get('ID', 'unknown'),
                outcome='SUCCESS',
                details={'filename': file.name, 'status': result.get('Status', '')}
            )

            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Erreur upload DICOM: {e}")
            return Response(
                {"detail": f"Erreur lors de l'upload DICOM: {e}"},
                status=status.HTTP_502_BAD_GATEWAY
            )

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView, UserViewSet,
    PatientViewSet, ExamRequestViewSet, AuditEventViewSet
)
from .views_interop import (
    DicomWorklistView,
    FhirPatientDetailView,
    FhirServiceRequestDetailView,
    FhirDiagnosticReportDetailView
)

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'exams', ExamRequestViewSet, basename='exam')
router.register(r'users', UserViewSet, basename='user')
router.register(r'audit', AuditEventViewSet, basename='audit')

urlpatterns = [
    # Authentification JWT
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', UserViewSet.as_view({'get': 'me'}), name='auth_me'),

    # DICOM Modality Worklist (Point d'intégration Module 2)
    path('worklist/', DicomWorklistView.as_view(), name='dicom_worklist'),

    # Endpoints REST principaux (patients, examens, etc.)
    path('', include(router.urls)),
]

# URLs FHIR R4 standard (séparées pour être incluses sous /fhir/)
fhir_urlpatterns = [
    path('Patient/<uuid:id>/', FhirPatientDetailView.as_view(), name='fhir_patient_detail'),
    path('ServiceRequest/<uuid:id>/', FhirServiceRequestDetailView.as_view(), name='fhir_servicerequest_detail'),
    path('DiagnosticReport/<uuid:id>/', FhirDiagnosticReportDetailView.as_view(), name='fhir_diagnosticreport_detail'),
]

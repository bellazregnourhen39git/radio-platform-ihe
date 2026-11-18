from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView
)
from workflow.urls import fhir_urlpatterns

urlpatterns = [
    # Administration Django
    path('admin/', admin.site.urls),

    # API REST version 1
    path('api/v1/', include('workflow.urls')),

    # Endpoints FHIR R4 standard (hors préfixe api/v1 pour conformité aux spécifications IHE / FHIR)
    path('fhir/', include(fhir_urlpatterns)),

    # Schéma OpenAPI et documentation interactive Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

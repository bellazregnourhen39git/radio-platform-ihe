from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Patient, ExamRequest, StatusHistory, Hl7Message, AuditEvent


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Informations Métier', {'fields': ('role', 'telephone', 'service_medical')}),
    )
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_active')


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('ipp', 'nom', 'prenom', 'date_naissance', 'sexe', 'telephone', 'is_active', 'date_creation')
    search_fields = ('ipp', 'nom', 'prenom', 'telephone')
    list_filter = ('sexe', 'is_active', 'date_creation')


@admin.register(ExamRequest)
class ExamRequestAdmin(admin.ModelAdmin):
    list_display = ('accession_number', 'patient', 'modalite', 'type_examen', 'priorite', 'statut', 'medecin_demandeur', 'date_demande')
    search_fields = ('accession_number', 'patient__nom', 'patient__prenom', 'patient__ipp', 'type_examen', 'study_instance_uid')
    list_filter = ('statut', 'modalite', 'priorite', 'report_status', 'date_demande')
    readonly_fields = ('accession_number', 'date_creation', 'date_modification')


@admin.register(StatusHistory)
class StatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('exam', 'ancien_statut', 'nouveau_statut', 'change_par', 'date')
    search_fields = ('exam__accession_number', 'change_par__username')
    list_filter = ('nouveau_statut', 'date')


@admin.register(Hl7Message)
class Hl7MessageAdmin(admin.ModelAdmin):
    list_display = ('type_message', 'direction', 'exam', 'date_creation')
    search_fields = ('exam__accession_number', 'type_message', 'contenu_brut')
    list_filter = ('type_message', 'direction', 'date_creation')


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ('date_creation', 'acteur', 'action', 'type_ressource', 'id_ressource', 'resultat')
    search_fields = ('action', 'type_ressource', 'id_ressource', 'acteur__username')
    list_filter = ('action', 'type_ressource', 'resultat', 'date_creation')
    readonly_fields = ('date_creation',)

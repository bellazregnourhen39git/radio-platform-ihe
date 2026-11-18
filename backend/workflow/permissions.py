from rest_framework import permissions
from .models import UserRole


class IsMedecinDemandeur(permissions.BasePermission):
    """Autorise uniquement les utilisateurs ayant le rôle MEDECIN_DEMANDEUR ou ADMIN."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [UserRole.MEDECIN_DEMANDEUR, UserRole.ADMIN] or request.user.is_superuser


class IsRadiologue(permissions.BasePermission):
    """Autorise uniquement les utilisateurs ayant le rôle RADIOLOGUE ou ADMIN."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [UserRole.RADIOLOGUE, UserRole.ADMIN] or request.user.is_superuser


class IsModaliteServiceOrRadiologue(permissions.BasePermission):
    """
    Autorise les comptes de service du Module 2 (MODALITE_SERVICE) ainsi que les
    radiologues et administrateurs (ex: pour la Worklist DICOM et mark-performed).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.role in [UserRole.MODALITE_SERVICE, UserRole.RADIOLOGUE, UserRole.ADMIN]
            or request.user.is_superuser
        )


class IsAdminUserRole(permissions.BasePermission):
    """Autorise uniquement les administrateurs pour la consultation d'audit et la gestion avancée."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role == UserRole.ADMIN or request.user.is_superuser


class IsClinicalStaff(permissions.BasePermission):
    """Autorise tout professionnel de santé authentifié (lecture transverse des dossiers)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

import logging
from .models import AuditEvent

logger = logging.getLogger('audit')


def log_event(actor, action, resource_type, resource_id, outcome='SUCCESS', details=None):
    """
    Service de journalisation d'événements de sécurité et de traçabilité médicale.
    Prépare l'intégration future avec le profil IHE ATNA (Module 4 - P4).

    :param actor: Utilisateur Django ou None (compte système/service)
    :param action: Code de l'action (ex: 'PATIENT_CREATE', 'STATUS_TRANSITION', 'HL7_GENERATION')
    :param resource_type: Type de ressource ('Patient', 'ExamRequest', 'Worklist', etc.)
    :param resource_id: UUID ou identifiant métier de la ressource ciblée
    :param outcome: 'SUCCESS' ou 'FAILURE'
    :param details: Dictionnaire de métadonnées additionnelles
    """
    if details is None:
        details = {}

    actor_repr = actor.username if (actor and hasattr(actor, 'username')) else 'SYSTEM/ANONYMOUS'
    log_msg = f"[AUDIT] Actor={actor_repr} | Action={action} | Resource={resource_type}:{resource_id} | Outcome={outcome} | Details={details}"

    if outcome == 'SUCCESS':
        logger.info(log_msg)
    else:
        logger.warning(log_msg)

    try:
        # Assure la persistance dans la table AuditEvent
        return AuditEvent.objects.create(
            acteur=actor if (actor and getattr(actor, 'is_authenticated', False)) else None,
            action=action,
            type_ressource=resource_type,
            id_ressource=str(resource_id),
            resultat='SUCCESS' if outcome.upper() == 'SUCCESS' else 'FAILURE',
            details=details
        )
    except Exception as exc:
        logger.error(f"Échec d'enregistrement de l'événement d'audit en BDD: {exc}")
        return None

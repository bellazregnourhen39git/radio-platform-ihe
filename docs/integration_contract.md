# Contrat d'Intégration Inter-Modules (IHE A+F)
**Projet :** Parcours radiologique intégré avec téléexpertise  
**Auteur :** Module 1 (SIH / RIS)  
**Destinataires :** P2 (Module 2 - Imagerie/PACS), P3 (Module 3 - Téléexpertise), P4 (Module 4 - Sécurité/Interop)  
**Version :** 1.0.0 — Novembre 2026

---

## 1. Contrat pour P2 — Module 2 (Imagerie DICOM / PACS / Modalité)

Le Module 2 simule la modalité d'acquisition et le serveur PACS. Il s'interface avec le Module 1 sur deux points cardinaux :

### 1.1. Récupération de la DICOM Modality Worklist (C-FIND simulé)
* **Endpoint :** `GET /api/v1/worklist/`
* **Authentification :** JWT Bearer (`MODALITE_SERVICE`, `RADIOLOGUE`, ou `ADMIN`).
  * Compte de service dédié : `modality_ct` / `demo`
* **Paramètres de requête (Query params) :**
  * `status` : statut de l'examen (par défaut `PLANIFIE`).
  * `modality` : code modalité DICOM (ex : `CT`, `MR`, `CR`, `US`, `DX`, `MG`).
  * `date` : date programmée au format `AAAA-MM-JJ` (optionnel).
* **Format de Réponse (`200 OK`) :**
```json
[
  {
    "PatientID": "IPP-2026-31678",
    "PatientName": "BERNARD^Pierre",
    "PatientBirthDate": "19750412",
    "PatientSex": "M",
    "AccessionNumber": "ACC-20261118-3169",
    "Modality": "CT",
    "ScheduledProcedureStepDescription": "Scanner thoracique haute résolution",
    "ScheduledProcedureStepStartDate": "20261118",
    "ScheduledProcedureStepStartTime": "123000",
    "ScheduledStationAETitle": "MOD_CT01",
    "ReferringPhysicianName": "Jean Dupont",
    "RequestedProcedureID": "c3a7e4b1-8e99-4d1a-bf44-6729a8f2e105",
    "ExamID": "c3a7e4b1-8e99-4d1a-bf44-6729a8f2e105",
    "StudyInstanceUID": "",
    "Priority": "ROUTINE",
    "ClinicalIndication": "Bilan de surveillance nodule sous-pleural"
  }
]
```

### 1.2. Notification de Fin d'Acquisition (Passage à l'état RÉALISÉ)
Une fois les images acquises et archivées sur le PACS simulé, le Module 2 notifie le Module 1 pour clôturer l'étape d'acquisition :
* **Endpoint :** `POST /api/v1/exams/{id}/mark-performed/`
* **Corps de la requête (`application/json`) :**
```json
{
  "study_instance_uid": "1.2.826.0.1.3680043.8.498.771239102481",
  "notes": "Acquisition 120 kV, 80 mAs, sans injection, 320 coupes reconstruites."
}
```
* **Effets côté Module 1 :**
  1. Statut de l'examen basculé de `PLANIFIE` à `REALISE`.
  2. Enregistrement du `study_instance_uid`.
  3. Création automatique d'une entrée dans la table `StatusHistory`.
  4. Génération d'un événement dans la table `AuditEvent`.
  5. Déverrouillage de la rédaction du compte rendu pour le radiologue.

---

## 2. Contrat pour P3 — Module 3 (Plateforme de Téléexpertise)

Le Module 3 consomme les données cliniques et radiologiques pour constituer le dossier de demande d'avis spécialiste (profil IHE MHD).

### 2.1. Lecture du Patient en FHIR R4
* **Endpoint :** `GET /fhir/Patient/{id}`
* **Format retourné :** `application/fhir+json; charset=utf-8`
* **Identifiant :** contient le système `urn:oid:1.2.250.1.213.1.4.2` et la valeur `patient.ipp`.

### 2.2. Lecture de la Demande d'Examen en FHIR R4 (ServiceRequest)
* **Endpoint :** `GET /fhir/ServiceRequest/{id}`
* **Format retourné :** `application/fhir+json; charset=utf-8`
* **Règles de conversion appliquées :**
  * `priority` :
    * `ROUTINE` $\to$ `routine`
    * `URGENT` $\to$ `urgent`
    * `TRES_URGENT` $\to$ `asap`
  * `status` :
    * `DEMANDE` ou `PLANIFIE` $\to$ `active`
    * `REALISE` ou `TERMINE` $\to$ `completed`
    * `ANNULE` $\to$ `revoked`
  * `code` : codé en terminologie DICOM (`http://dicom.nema.org/resources/ontology/DCM`) avec le code modalité (`CT`, `MR`...).

### 2.3. Lecture du Compte Rendu Validé en FHIR R4 (DiagnosticReport)
* **Endpoint :** `GET /fhir/DiagnosticReport/{id}`
* **Format retourné :** `application/fhir+json; charset=utf-8`
* **Champs fournis pour la téléexpertise :**
  * `status` : `final` (si validé), `preliminary` (si brouillon), `registered` (si non encore rédigé).
  * `conclusion` : texte intégral du compte rendu radiologique rédigé par le radiologue.
  * `imagingStudy` : référence vers l'UID DICOM `urn:oid:{study_instance_uid}` (pour que le spécialiste téléexpert puisse ouvrir les coupes).
  * `performer` : praticien radiologue signataire.

---

## 3. Contrat pour P4 — Module 4 (Sécurité, ATNA, IUA/OAuth2, PIXm)

Le Module 4 chapeaute la sécurité globale, l'authentification unifiée et la conformité ATNA/PIXm.

### 3.1. Branchement du Profil IHE ATNA (Audit Trail and Node Authentication)
* **Emplacement du service d'audit :** `backend/workflow/audit.py`
* **Signature de la fonction :**
  ```python
  def log_event(actor, action, resource_type, resource_id, outcome='SUCCESS', details=None):
      ...
  ```
* **Table SQL :** `AuditEvent` (champs : `id` UUID, `acteur_id`, `action`, `type_ressource`, `id_ressource`, `resultat`, `details` JSON, `date_creation`).
* **Intégration P4 :** P4 peut ajouter un dispatcher Syslog RFC 5424 / DICOM Audit Message dans `log_event()` ou brancher un daemon de lecture des `AuditEvent`.

### 3.2. Migration vers IUA / OAuth2 (Internet User Authorization)
* **Emplacement du contrôle d'accès :** `backend/workflow/permissions.py`
* **Classes isolées :**
  * `IsMedecinDemandeur`
  * `IsRadiologue`
  * `IsModaliteServiceOrRadiologue`
  * `IsAdminUserRole`
  * `IsClinicalStaff`
* **Intégration P4 :** Les vues DRF appellent ces permissions isolées. P4 peut remplacer le décodage du JWT Django standard par la vérification d'un jeton OIDC / SMART on FHIR sans modifier les contrôleurs métier.

### 3.3. Identifiants Patients (PIXm / PDQm)
* Tous les identifiants exposés par le Module 1 sont stables :
  * `patient_id` : Clé primaire immuable UUID v4.
  * `ipp` : Format `IPP-AAAA-XXXXX`, unique et indexé, compatible avec le Patient Identifier Cross-reference (PIXm).

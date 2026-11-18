# RadioPlatform — Module 1 : Parcours Radiologique Intégré (SIH / RIS)

**Projet académique & professionnel :** *« Parcours radiologique intégré avec téléexpertise (IHE A+F) »*  
**Module développé :** **MODULE 1 — SIH & RIS (Demandes, Patients, Workflow, Interopérabilité)**  
**Technologies :** Django 6 / Django REST Framework, React 18, Vite, Tailwind CSS, PostgreSQL, HL7 v2.5, HL7 FHIR R4, DICOM Worklist.

---

## 🚀 Démarrage Rapide « en 5 commandes »

### Option A : Avec Docker Compose (Recommandé)
```bash
# 1. Cloner ou se placer dans le projet
cd projet_haifa

# 2. Copier l'environnement
cp .env.example .env

# 3. Lancer les conteneurs (PostgreSQL + Backend + Frontend)
docker compose up --build -d

# 4. Initialiser la base de données et les données de démo (si non auto)
docker compose exec backend python manage.py seed_demo

# 5. Ouvrir votre navigateur
# Frontend React : http://localhost:3000
# Backend API & Swagger : http://localhost:8000/api/docs/
```

### Option B : En local sans Docker

```bash
# 1. Backend : migrations et données de démo
cd backend
python manage.py migrate
python manage.py seed_demo

# 2. Backend : lancer le serveur API Django
python manage.py runserver 8000

# 3. Dans un second terminal, aller dans le frontend
cd frontend
npm install

# 4. Frontend : lancer le serveur de développement Vite
npm run dev

# 5. Ouvrir http://localhost:5173
```

---

## 👥 Comptes de Démonstration (Disponibles en 1-Clic sur la page de connexion)

| Identifiant | Mot de passe | Rôle Métier | Périmètre d'action |
|---|---|---|---|
| `dr.dupont` | `demo` | `MEDECIN_DEMANDEUR` (SIH) | Création patients, prescription d'examens, consultation des comptes rendus. |
| `dr.martin` | `demo` | `RADIOLOGUE` (RIS) | Planification des créneaux, interprétation, rédaction et signature des comptes rendus. |
| `modality_ct` | `demo` | `MODALITE_SERVICE` (P2) | Accès à la worklist DICOM, notification de réalisation (`mark-performed`). |
| `admin` | `admin` | `ADMIN` (DSI) | Supervision globale, consultation des journaux d'audit de sécurité ATNA. |

---

## 🏥 Architecture et Cycle de Vie de l'Examen

Le workflow suit scrupuleusement le profil **IHE Scheduled Workflow (SWF.b)** :

```text
1. Prescription (SIH)  --> DEMANDE   [Génère AccessionNumber & HL7 ORM^O01]
2. Prise en charge (RIS)--> PLANIFIE  [Date planifiée fixée, visible dans la Worklist DICOM]
3. Acquisition (P2)     --> REALISE   [Injecte le StudyInstanceUID du PACS]
4. Compte rendu (RIS)   --> TERMINE   [CR validé & signé, émission HL7 ORU^R01]
(+ Annulation motivée   --> ANNULE)   [Motif obligatoire]
```

### Points d'extension et contrats d'interface :
- **Module 2 (Imagerie / PACS) :** Consomme la Modality Worklist simulée sur `GET /api/v1/worklist/?status=PLANIFIE&modality=CT` et notifie la fin d'acquisition via `POST /api/v1/exams/{id}/mark-performed/`.
- **Module 3 (Téléexpertise) :** Interroge les ressources standardisées FHIR R4 :
  - `GET /fhir/Patient/{id}`
  - `GET /fhir/ServiceRequest/{id}` (statut `active`/`completed`, priorité mappée `routine`/`urgent`/`asap`)
  - `GET /fhir/DiagnosticReport/{id}` (statut `final`/`preliminary`, conclusion, lien UID DICOM)
- **Module 4 (Sécurité & Interopérabilité) :**
  - Table d'audit `AuditEvent` et service `workflow.audit.log_event()` pré-câblés pour ATNA.
  - Permissions isolées dans `workflow/permissions.py` prêtes pour IUA / OAuth2 / SMART on FHIR.
  - IPP stable (`IPP-AAAA-XXXXX`) prêt pour PIXm/PDQm.

Pour plus de détails techniques, consultez le document [Contrat d'Intégration complet](docs/integration_contract.md).

---

## 🧪 Lancement des Tests Automatisés

Le backend comporte une suite de 18 tests automatisés couvrant les modèles, les transitions d'état sous concurrence, la génération HL7, les endpoints FHIR et les permissions par rôle :

```bash
cd backend
python manage.py test workflow
```
Résultat : **18 tests, 100% OK.**

---

## 📑 Documentation de l'API & Collection Postman

- **Swagger UI :** Accessible à l'adresse [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- **Schéma OpenAPI :** `http://localhost:8000/api/schema/`
- **Collection Postman :** Disponible dans le fichier `docs/postman_collection.json` (à importer dans Postman).

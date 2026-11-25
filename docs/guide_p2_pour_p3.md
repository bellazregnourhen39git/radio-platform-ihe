# Guide d'Intégration et Prise en Main — Module 2 (Imagerie & PACS)
**Auteur :** Personne 2 (Module 2 — Imagerie médicale, PACS Orthanc & Visualiseur OHIF)  
**Destinataire :** Personne 3 (Module 3 — Téléexpertise radiologique, IHE MHD & FHIR)  
**Date :** Novembre 2026  
**Dépôt Git :** `main` (à jour)

---

## 🎯 1. Résumé de ce que la Personne 2 a développé

Le **Module 2** prend en charge l'ensemble du cycle de vie des images médicales DICOM, de la modalité d'acquisition jusqu'à la consultation par le médecin et le télé-expert :

1. **Serveur PACS Orthanc (Archive DICOM & DICOMweb) :**
   - Conteneur Docker `radio_orthanc`.
   - Port DICOM C-STORE standard : `4242` (AE Title : `ORTHANC`).
   - Port Web REST & DICOMweb : `8042` (`http://localhost:8042`).
   - Support complet DICOMweb (WADO-RS, QIDO-RS, STOW-RS).
   - Hook Lua d'automatisation (`orthanc/on_stable_study.lua`) : Dès qu'une série/étude DICOM est archivée dans Orthanc, le script extrait l'`AccessionNumber`, s'authentifie via JWT et notifie le backend RIS pour passer automatiquement l'examen de `PLANIFIE` à `REALISE`.

2. **Visualiseur Médical OHIF Viewer v3 (Consultation interactive) :**
   - Conteneur Docker `radio_ohif` sur le port `3001` (`http://localhost:3001`).
   - Proxy interne Nginx (`ohif/nginx.conf`) résolvant nativement les problématiques CORS vers Orthanc.
   - Intégrable en iframe dans n'importe quelle page web ou composant React :  
     `http://localhost:3001/viewer?StudyInstanceUIDs={StudyInstanceUID}`

3. **Backend Django REST (Services et Endpoints PACS) :**
   - `GET /api/v1/pacs/info/` : Métriques et statut du PACS (nombre de patients, études, séries, instances).
   - `GET /api/v1/pacs/studies/` : Liste en temps réel de toutes les études DICOM stockées sur Orthanc.
   - `GET /api/v1/exams/{id}/pacs/` : Détails PACS complets d'un examen (StudyInstanceUID, séries, lien visualiseur OHIF).
   - `POST /api/v1/pacs/upload/` : Upload multipart de fichiers `.dcm` vers Orthanc.
   - `POST /api/v1/pacs/sync/` : Synchronisation intelligente des études orphelines du PACS avec les examens RIS en attente (`PLANIFIE` -> `REALISE`).
   - `GET /api/v1/worklist/` : Modality Worklist DICOM (C-FIND).
   - `POST /api/v1/exams/{id}/mark-performed/` : Validation d'acquisition et enregistrement du `StudyInstanceUID`.

4. **Frontend React (Interfaces et Composants Réutilisables) :**
   - **Console PACS** (`/pacs`) : Tableau de bord de l'imagerie avec 4 onglets (Worklist DICOM, Études PACS archivées, Visualiseur OHIF intégré en iframe, Upload DICOM) et bouton de synchronisation 1-clic.
   - **Composant réutilisable `DicomViewer.jsx`** (`frontend/src/components/DicomViewer.jsx`) : Affiche OHIF Viewer en iframe avec mode plein écran, rechargement, ouverture dans un nouvel onglet.
   - **Page Détails Examen** (`/exams/:id`) : Visualiseur OHIF intégré directement dans l'onglet Imagerie dès que l'examen est `REALISE` ou `TERMINE`.

5. **Outillage et Données de Test :**
   - Jeu d'images DICOM réelles préparées.
   - Script `scripts/simulate_modality.py` pour simuler une modalité d'acquisition CT/MR.
   - Script `scripts/tag_dicom.py` pour manipuler les balises DICOM.

---

## 🚀 2. Commandes pas-à-pas pour lancer et accéder au projet (Pour P3)

Personne 3 peut démarrer l'ensemble de la plateforme en 3 commandes sur sa machine :

### Étape 1 : Récupérer le code à jour
```bash
git pull origin main
```

### Étape 2 : Démarrer tous les services via Docker Compose
```bash
docker compose up --build -d
```
*Cela lance 5 conteneurs :*
- `radio_db` (PostgreSQL 16)
- `radio_backend` (Django REST API sur port 8000)
- `radio_frontend` (React + Vite + Nginx sur port 3000)
- `radio_orthanc` (PACS Orthanc sur ports 4242 et 8042)
- `radio_ohif` (OHIF Viewer v3 sur port 3001)

### Étape 3 : Initialiser la base de données et les données de test
```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
```

*(Optionnel) Si vous souhaitez associer automatiquement les images DICOM aux examens de test créés :*  
Dans l'interface web, allez sur `http://localhost:3000/pacs` et cliquez sur le bouton bleu **⚡ Synchroniser PACS ↔ RIS**.

---

## 🌐 3. URLs d'Accès et Comptes de Démonstration

### 🔗 Adresses des Services
| Service | URL | Description |
|---|---|---|
| **Application Web (Frontend React)** | `http://localhost:3000` | Interface utilisateur principale (SIH / RIS / PACS) |
| **Console PACS** | `http://localhost:3000/pacs` | Supervision PACS, études DICOM, OHIF en iframe |
| **Visualiseur OHIF v3 autonome** | `http://localhost:3001` | Visualiseur DICOM universel |
| **PACS Orthanc (Interface web)** | `http://localhost:8042` | Explorateur d'études Orthanc (sans mot de passe requis) |
| **API Backend & Swagger UI** | `http://localhost:8000/api/docs/` | Documentation interactive de tous les endpoints |
| **Orthanc DICOM C-STORE** | `localhost:4242` | Port d'acquisition DICOM (AET: `ORTHANC`) |

### 🔑 Comptes de Connexion
| Utilisateur | Mot de passe | Rôle |
|---|---|---|
| `dr.martin` | `demo` | **Radiologue (RIS)** (lecture, interprétation, validation CR) |
| `dr.dupont` | `demo` | **Médecin demandeur (SIH)** (prescription, demande d'avis) |
| `modality_ct` | `demo` | **Modalité / Service P2** (gestion worklist et PACS) |
| `admin` | `admin` | **Administrateur** (supervision globale et logs ATNA) |

---

## 💡 4. Comment Personne 3 (Téléexpertise) doit intégrer les images

Dans le cadre du **Module 3 (Téléexpertise radiologique / second avis IHE MHD)**, le médecin spécialiste télé-expert doit pouvoir consulter les images de l'examen concerné.

Voici les **3 méthodes prêtes à l'emploi** pour Personne 3 :

### Méthode A : Réutiliser le composant React `DicomViewer` (Le plus simple ⭐⭐⭐)
P2 a créé un composant React complet prêt à l'emploi. Dans votre écran de téléexpertise React, importez-le simplement :

```jsx
import DicomViewer from '../components/DicomViewer';

function TeleexpertiseReviewModal({ exam }) {
  return (
    <div className="p-4 bg-white rounded-xl shadow">
      <h2 className="text-lg font-bold mb-3">Dossier d'expertise radiologique</h2>
      
      {/* Visualiseur OHIF intégré automatique */}
      <DicomViewer 
        studyInstanceUID={exam.study_instance_uid} 
        title={`Images DICOM - ${exam.accession_number}`}
        height="650px"
      />
    </div>
  );
}
```

### Méthode B : Intégration brute via Iframe HTML/React
Si vous construisez une vue sur mesure :
```jsx
const ohifUrl = `http://localhost:3001/viewer?StudyInstanceUIDs=${studyInstanceUid}`;

<iframe
  src={ohifUrl}
  title="Visualiseur Téléexpertise"
  className="w-full h-[650px] rounded-xl border border-slate-300 shadow-inner"
  allow="fullscreen"
/>
```

### Méthode C : Récupération des métadonnées via l'API REST ou FHIR
Avant d'afficher l'iframe, vous pouvez récupérer le `study_instance_uid` :

1. **Via l'endpoint REST dédié PACS :**
   ```http
   GET /api/v1/exams/{exam_id}/pacs/
   Authorization: Bearer <token_jwt>
   ```
   **Réponse :**
   ```json
   {
     "study_instance_uid": "1.2.826.0.1.3680043.8.498.771239102481",
     "accession_number": "ACC-20261122-8122",
     "patient_ipp": "IPP-2026-79219",
     "ohif_viewer_url": "/ohif/viewer?StudyInstanceUIDs=1.2.826.0.1.3680043.8.498.771239102481",
     "orthanc_studies": [...]
   }
   ```

2. **Via la ressource standard FHIR R4 (Profil IHE MHD) :**
   ```http
   GET /fhir/DiagnosticReport/{exam_id}/
   ```
   Dans la réponse FHIR JSON, le champ `imagingStudy` fournit l'identifiant DICOM :
   ```json
   {
     "resourceType": "DiagnosticReport",
     "status": "final",
     "imagingStudy": [
       {
         "identifier": {
           "system": "urn:dicom:uid",
           "value": "urn:oid:1.2.826.0.1.3680043.8.498.771239102481"
         },
         "display": "Étude DICOM sur PACS Orthanc"
       }
     ],
     "conclusion": "..."
   }
   ```

---

## 🛠️ 5. Résolution des problèmes fréquents (Troubleshooting)

1. **L'iframe OHIF affiche un écran noir ou « Study Not Found » :**
   - Assurez-vous que l'examen est bien à l'état `REALISE` ou `TERMINE` (les examens `DEMANDE` ou `PLANIFIE` n'ont pas encore d'images).
   - Rendez-vous sur `http://localhost:3000/pacs` et cliquez sur **⚡ Synchroniser PACS ↔ RIS** pour lier les images aux examens.
2. **Erreur de connexion à Orthanc ou OHIF :**
   - Vérifiez que les 5 conteneurs tournent avec `docker compose ps`.
   - Si besoin, redémarrez : `docker compose restart orthanc ohif`.
3. **Besoin d'images DICOM supplémentaires :**
   - Allez sur l'onglet **Upload DICOM** dans `http://localhost:3000/pacs` et glissez-déposez n'importe quel fichier `.dcm`.

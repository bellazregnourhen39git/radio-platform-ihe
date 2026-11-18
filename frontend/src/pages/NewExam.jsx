import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, FilePlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const modalities = [
  { code: 'CT', name: 'Scanner (CT)', desc: 'Tomodensitométrie haute résolution' },
  { code: 'MR', name: 'IRM (MR)', desc: 'Imagerie par Résonance Magnétique' },
  { code: 'CR', name: 'Radiographie (CR)', desc: 'Radiographie standard conventionnelle' },
  { code: 'US', name: 'Échographie (US)', desc: 'Ultrasonographie hépato-abdomino-pelvienne' },
  { code: 'DX', name: 'Radio Numérique (DX)', desc: 'Radiographie capteur plan numérique' },
  { code: 'MG', name: 'Mammographie (MG)', desc: 'Dépistage et diagnostic sénologique' },
  { code: 'NM', name: 'Méd. Nucléaire (NM)', desc: 'Scintigraphie osseuse et métabolique' },
  { code: 'PT', name: 'TEP-Scan (PT)', desc: 'Tomographie par Émission de Positons' },
];

const regions = [
  'Crâne / Cérébral',
  'Thorax / Pulmonaire',
  'Abdomen-Pelvis',
  'Rachis Cervical / Lombaire',
  'Membres Supérieurs',
  'Membres Inférieurs / Genou',
  'Pelvis / Hanche',
  'Cou / Thyroïde'
];

export default function NewExam() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get('patient_id') || '');
  const [modalite, setModalite] = useState('CT');
  const [regionAnatomique, setRegionAnatomique] = useState('Thorax / Pulmonaire');
  const [typeExamen, setTypeExamen] = useState('');
  const [indicationClinique, setIndicationClinique] = useState('');
  const [priorite, setPriorite] = useState('ROUTINE');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await api.get('/patients/');
        setPatients(res.data.results || res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatients();
  }, []);

  // Suggestions automatiques de titre d'examen selon modalité et région
  useEffect(() => {
    if (!typeExamen) {
      if (modalite === 'CT' && regionAnatomique.includes('Thorax')) {
        setTypeExamen('Scanner thoracique injecté');
      } else if (modalite === 'MR' && regionAnatomique.includes('Cérébral')) {
        setTypeExamen('IRM cérébrale avec séquences FLAIR et diffusion');
      } else if (modalite === 'CR' && regionAnatomique.includes('Thorax')) {
        setTypeExamen('Radiographie pulmonaire face et profil');
      }
    }
  }, [modalite, regionAnatomique]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setError('Veuillez sélectionner un patient.');
      return;
    }
    if (!typeExamen.trim()) {
      setError('Veuillez préciser le libellé de l\'examen.');
      return;
    }
    if (!indicationClinique.trim()) {
      setError('L\'indication clinique est indispensable pour justifier l\'acte d\'imagerie.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        patient_id: selectedPatientId,
        modalite,
        region_anatomique: regionAnatomique,
        type_examen: typeExamen,
        indication_clinique: indicationClinique,
        priorite
      };

      const res = await api.post('/exams/', payload);
      navigate(`/exams/${res.data.id}?created=true`);
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        JSON.stringify(err.response?.data) || 
        'Erreur lors de la création de la demande.'
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="Demande d’imagerie"
        title="Nouvelle prescription"
        description="Créez une demande et transmettez-la au RIS via HL7 v2 (ORM^O01)."
        icon={FilePlus}
      />

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Sélection du Patient */}
        <div className="app-panel p-5 lg:p-6">
          <h2 className="mb-5 flex items-center gap-3 text-[14px] font-semibold text-[#0F2233]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E6F0FB] text-[11px] font-semibold text-[#1566C0]">01</span>
            Dossier patient
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
                Sélectionner le patient *
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                required
                className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
              >
                <option value="">-- Choisir un patient existant --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} {p.prenom} ({p.ipp}) - Né(e) le {p.date_naissance}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Link
                to="/patients"
                className="app-button-secondary flex h-10 items-center justify-center px-4 text-[11px] font-medium"
              >
                + Créer un nouveau patient
              </Link>
            </div>
          </div>

          {selectedPatient && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] px-4 py-3 text-[11px] text-[#54687A]">
              <div>
                <span className="font-medium text-slate-900">{selectedPatient.nom} {selectedPatient.prenom}</span>
                <span className="ml-2 font-mono text-slate-500">[{selectedPatient.ipp}]</span>
              </div>
              <div>
                <span>Sexe: {selectedPatient.sexe}</span>
                <span className="ml-3">Né(e) le: {selectedPatient.date_naissance}</span>
                <span className="ml-3 font-mono">Tél: {selectedPatient.telephone || '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Paramètres de l'examen */}
        <div className="app-panel space-y-6 p-5 lg:p-6">
          <h2 className="flex items-center gap-3 text-[14px] font-semibold text-[#0F2233]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E6F0FB] text-[11px] font-semibold text-[#1566C0]">02</span>
            Paramètres de l’examen
          </h2>

          {/* Choix de modalité */}
          <div>
            <label className="mb-2 block text-[11px] font-medium text-[#54687A]">
              Modalité d'imagerie requise *
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {modalities.map((m) => (
                <button
                  type="button"
                  key={m.code}
                  onClick={() => setModalite(m.code)}
                  className={`min-h-[82px] rounded-lg border p-3 text-left transition-colors ${
                    modalite === m.code
                      ? 'border-[#1566C0] bg-[#E6F0FB]'
                      : 'border-[#DCE6EF] bg-white hover:border-[#B8D3EC] hover:bg-[#F3F8FC]'
                  }`}
                >
                  <div className={`text-[13px] font-semibold ${modalite === m.code ? 'text-[#1566C0]' : 'text-[#0F2233]'}`}>
                    {m.code}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-[#54687A]">{m.name}</div>
                  <div className="mt-0.5 truncate text-[9px] text-[#8295A6]">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Région & Titre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
                Région anatomique explorée *
              </label>
              <select
                value={regionAnatomique}
                onChange={(e) => setRegionAnatomique(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] focus:border-[#1566C0] focus:outline-none"
              >
                {regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
                Intitulé précis de l'acte d'imagerie *
              </label>
              <input
                type="text"
                required
                value={typeExamen}
                onChange={(e) => setTypeExamen(e.target.value)}
                placeholder="ex: Scanner Thoraco-Abdomino-Pelvien injecté"
                className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] focus:border-[#1566C0] focus:outline-none"
              />
            </div>
          </div>

          {/* Priorité */}
          <div>
            <label className="mb-2 block text-[11px] font-medium text-[#54687A]">
              Niveau de priorité clinique *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 transition-colors ${
                priorite === 'ROUTINE' ? 'border-[#A8BBC6] bg-[#EEF4FA]' : 'border-[#DCE6EF] hover:bg-[#F3F8FC]'
              }`}>
                <input
                  type="radio"
                  name="priorite"
                  value="ROUTINE"
                  checked={priorite === 'ROUTINE'}
                  onChange={() => setPriorite('ROUTINE')}
                  className="text-slate-600 focus:ring-slate-500"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800">Routine</div>
                  <div className="text-[10px] text-slate-400">Programmable standard</div>
                </div>
              </label>

              <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 transition-colors ${
                priorite === 'URGENT' ? 'border-amber-400 bg-amber-50' : 'border-[#DCE6EF] hover:bg-[#F3F8FC]'
              }`}>
                <input
                  type="radio"
                  name="priorite"
                  value="URGENT"
                  checked={priorite === 'URGENT'}
                  onChange={() => setPriorite('URGENT')}
                  className="text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <div className="text-xs font-semibold text-orange-800">Urgent</div>
                  <div className="text-[10px] text-orange-600/70">Sous 24h</div>
                </div>
              </label>

              <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 transition-colors ${
                priorite === 'TRES_URGENT' ? 'border-rose-400 bg-rose-50' : 'border-[#DCE6EF] hover:bg-[#F3F8FC]'
              }`}>
                <input
                  type="radio"
                  name="priorite"
                  value="TRES_URGENT"
                  checked={priorite === 'TRES_URGENT'}
                  onChange={() => setPriorite('TRES_URGENT')}
                  className="text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="text-xs font-semibold text-red-800">Très urgent</div>
                  <div className="text-[10px] text-red-600/70">Immédiat / Vital (asap)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Indication clinique */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
              Indication clinique & antécédents médicaux pertinents *
            </label>
            <textarea
              rows="4"
              required
              value={indicationClinique}
              onChange={(e) => setIndicationClinique(e.target.value)}
              placeholder="Exemple : Patient de 68 ans présentant une dyspnée aiguë fébrile avec désaturation à 91% en air ambiant. Antécédents de néoplasie colique traitée..."
              className="w-full rounded-lg border border-[#DCE6EF] bg-white px-3 py-2.5 text-[12px] focus:border-[#1566C0] focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Ce texte sera transmis au RIS via le segment OBR du message HL7 ORM^O01 et injecté dans la ressource FHIR ServiceRequest.
            </p>
          </div>
        </div>

        {/* Bouton de soumission */}
        <div className="flex justify-end gap-2">
          <Link
            to="/dashboard"
            className="app-button-secondary inline-flex h-10 items-center px-4 text-[12px] font-medium"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="app-button-primary inline-flex h-10 items-center gap-2 px-4 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Création et transmission HL7...' : 'Créer et transmettre la demande'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

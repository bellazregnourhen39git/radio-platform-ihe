import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Users, UserPlus, Search, Edit2, Trash2,
  FileText, PlusCircle, AlertCircle, X, Check
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function PatientsList() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    sexe: 'M',
    telephone: '',
    adresse: ''
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchPatients = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get(`/patients/?search=${encodeURIComponent(search)}`);
      setPatients(res.data.results || res.data);
    } catch (err) {
      console.error(err);
      setLoadError('Impossible de charger les patients. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchPatients();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  const handleOpenCreate = () => {
    setEditingPatient(null);
    setFormData({
      nom: '',
      prenom: '',
      date_naissance: '',
      sexe: 'M',
      telephone: '',
      adresse: ''
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingPatient(p);
    setFormData({
      nom: p.nom,
      prenom: p.prenom,
      date_naissance: p.date_naissance,
      sexe: p.sexe,
      telephone: p.telephone || '',
      adresse: p.adresse || ''
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (editingPatient) {
        await api.put(`/patients/${editingPatient.id}/`, formData);
        setSuccessMsg(`Patient ${formData.nom} mis à jour avec succès.`);
      } else {
        const res = await api.post('/patients/', formData);
        setSuccessMsg(`Nouveau patient créé avec l'IPP ${res.data.ipp}.`);
      }
      setModalOpen(false);
      fetchPatients();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || 
        JSON.stringify(err.response?.data) || 
        'Erreur lors de l\'enregistrement du patient.'
      );
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Confirmer l'archivage (soft-delete) du patient ${name} ?`)) return;
    try {
      await api.delete(`/patients/${id}/`);
      setSuccessMsg(`Patient archivé.`);
      fetchPatients();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert("Erreur lors de l'archivage du patient.");
    }
  };

  const canManagePatients = user?.role === 'MEDECIN_DEMANDEUR' || user?.role === 'ADMIN';

  return (
    <section className="w-full">
      <PageHeader
        eyebrow="Répertoire clinique"
        title="Patients"
        description="Consultez et gérez les dossiers patients de l’établissement."
        icon={Users}
        actions={canManagePatients && (
          <button
            onClick={handleOpenCreate}
            className="app-button-primary inline-flex h-10 items-center justify-center gap-2 px-4 text-[13px] font-medium text-white"
          >
            <UserPlus className="h-4 w-4" />
            Nouveau patient
          </button>
        )}
      />

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-10 min-w-[240px] flex-1 items-center gap-2.5 rounded-lg border border-[#DCE6EF] bg-white px-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom, IPP ou téléphone"
          className="w-full bg-transparent text-[12px] text-[#0F2233] placeholder:text-[#8295A6] focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-500 hover:text-slate-800">
            Effacer
          </button>
        )}
        </div>
        <span className="text-[12px] text-[#54687A]">{loading ? 'Chargement…' : `${patients.length} patient${patients.length === 1 ? '' : 's'}`}</span>
      </div>

      <div className="app-panel overflow-hidden">
        {loadError && (
          <div role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-500">
            Chargement des dossiers patients…
          </div>
        ) : patients.length === 0 ? (
          <div className="p-14 text-center text-[13px] text-slate-500">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F0FB] text-[#1566C0]">
              <Users className="h-5 w-5" />
            </span>
            <p className="font-medium text-[#0F2233]">Aucun patient trouvé</p>
            <p className="mt-1 text-xs">Modifiez vos critères ou créez un nouveau patient.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-data-table min-w-full border-collapse text-[12px]">
              <thead className="bg-[#EEF4FA] text-left text-[11px] font-medium text-[#54687A]">
                <tr className="h-10">
                  <th className="px-4">IPP</th>
                  <th className="px-4">Identité du patient</th>
                  <th className="px-4">Sexe / âge</th>
                  <th className="px-4">Contact</th>
                  <th className="px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const birth = new Date(p.date_naissance);
                  const age = new Date().getFullYear() - birth.getFullYear();
                  return (
                    <tr key={p.id} className="h-14 border-t border-[#DCE6EF] transition-colors hover:bg-[#F3F8FC]">
                      <td className="whitespace-nowrap px-4 font-mono text-[11px] font-medium text-[#54687A]">
                        {p.ipp}
                      </td>
                      <td className="whitespace-nowrap px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E6F0FB] text-[10px] font-semibold text-[#1566C0]">
                            {[p.prenom?.[0], p.nom?.[0]].filter(Boolean).join('').toUpperCase()}
                          </span>
                          <span>
                            <Link to={`/patients/${p.id}`} className="block text-[13px] font-medium text-[#0F2233] hover:text-[#1566C0]">
                              {p.prenom} {p.nom}
                            </Link>
                            <span className="mt-0.5 block max-w-[240px] truncate text-[10px] text-[#71869A]">{p.adresse || 'Adresse non renseignée'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 text-[12px] text-[#54687A]">
                        {p.sexe === 'M' ? 'Homme' : p.sexe === 'F' ? 'Femme' : 'Autre'}
                        <span className="ml-1 text-xs text-slate-500">({age} ans)</span>
                      </td>
                      <td className="whitespace-nowrap px-4 font-mono text-[11px] text-[#54687A]">
                        {p.telephone || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 text-right">
                        <Link
                          to={`/patients/${p.id}`}
                          title="Historique des examens"
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[#1566C0] hover:bg-[#E6F0FB]"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Examens
                        </Link>

                        {canManagePatients && (
                          <Link
                            to={`/exams/new?patient_id=${p.id}`}
                            title="Prescrire un examen pour ce patient"
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Prescrire
                          </Link>
                        )}

                        {canManagePatients && (
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Modifier"
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {canManagePatients && (
                          <button
                            onClick={() => handleDelete(p.id, `${p.nom} ${p.prenom}`)}
                            title="Archiver"
                            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F2233]/20 backdrop-blur-[2px]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModalOpen(false);
        }}>
          <aside className="ml-auto flex h-full w-full max-w-[420px] flex-col border-l border-[#DCE6EF] bg-white shadow-[-12px_0_40px_rgba(21,102,192,0.12)]">
            <div className="flex items-center justify-between border-b border-[#DCE6EF] px-5 py-4">
              <h3 className="text-[15px] font-semibold text-[#0F2233]">
                {editingPatient ? 'Modifier le dossier patient' : 'Créer un nouveau dossier patient'}
              </h3>
              <button onClick={() => setModalOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-[#71869A] hover:bg-[#F3F8FC] hover:text-[#0F2233]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-5 mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">Nom *</label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
                    placeholder="Mercier"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
                    placeholder="Camille"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">Date de naissance *</label>
                  <input
                    type="date"
                    required
                    value={formData.date_naissance}
                    onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-2 text-[12px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">Sexe biologique *</label>
                  <select
                    value={formData.sexe}
                    onChange={(e) => setFormData({ ...formData, sexe: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-2 text-[12px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
                  >
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                    <option value="O">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">Téléphone</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="06 12 34 56 78"
                  className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">Adresse postale</label>
                <textarea
                  rows="2"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  placeholder="Adresse complète du patient..."
                  className="w-full rounded-lg border border-[#DCE6EF] bg-white px-3 py-2 text-[12px] text-[#0F2233] focus:border-[#1566C0] focus:outline-none"
                />
              </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#DCE6EF] p-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="app-button-secondary h-9 px-3 text-[11px] font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="app-button-primary h-9 px-3 text-[11px] font-medium text-white"
                >
                  {editingPatient ? 'Enregistrer les modifications' : 'Créer le patient'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}

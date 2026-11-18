import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight, CheckCircle2, Clock3, FilePlus, RefreshCw, Search, Siren, ClipboardList
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import PageHeader from '../components/PageHeader';

const statItems = [
  { label: 'Examens affichés', key: 'all', icon: ClipboardList, tone: 'text-[#1566C0] bg-[#E6F0FB]' },
  { label: 'À planifier', key: 'toSchedule', icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
  { label: 'Priorité élevée', key: 'urgent', icon: Siren, tone: 'text-rose-700 bg-rose-50' },
  { label: 'Terminés', key: 'done', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [exams, setExams] = useState([]);
  const [unfilteredExams, setUnfilteredExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState(urlSearch);

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  const fetchExams = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('statut', statusFilter);
      if (modalityFilter) params.append('modalite', modalityFilter);
      if (priorityFilter) params.append('priorite', priorityFilter);
      if (search) params.append('search', search);
      const response = await api.get(`/exams/?${params.toString()}`);
      const data = response.data.results || response.data;
      if (!Array.isArray(data)) throw new Error('Format de réponse invalide pour la liste des examens.');
      setExams(data);
      if (!statusFilter && !modalityFilter && !priorityFilter && !search) setUnfilteredExams(data);
    } catch (requestError) {
      console.error(requestError);
      setError('Impossible de charger les examens. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchExams, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, modalityFilter, priorityFilter, search]);

  const stats = {
    all: exams.length,
    toSchedule: exams.filter((exam) => exam.statut === 'DEMANDE').length,
    urgent: exams.filter((exam) => ['URGENT', 'TRES_URGENT'].includes(exam.priorite)).length,
    done: exams.filter((exam) => exam.statut === 'TERMINE').length,
  };
  const statusCountsFrom = unfilteredExams.length ? unfilteredExams : exams;
  const statusChips = [
    { label: 'Tous', value: '', count: statusCountsFrom.length },
    { label: 'Demandé', value: 'DEMANDE', count: statusCountsFrom.filter((exam) => exam.statut === 'DEMANDE').length },
    { label: 'Planifié', value: 'PLANIFIE', count: statusCountsFrom.filter((exam) => exam.statut === 'PLANIFIE').length },
    { label: 'Réalisé', value: 'REALISE', count: statusCountsFrom.filter((exam) => exam.statut === 'REALISE').length },
    { label: 'Terminé', value: 'TERMINE', count: statusCountsFrom.filter((exam) => exam.statut === 'TERMINE').length },
    { label: 'Annulé', value: 'ANNULE', count: statusCountsFrom.filter((exam) => exam.statut === 'ANNULE').length },
  ];

  return (
    <section className="w-full">
      <PageHeader
        eyebrow="Activité clinique"
        title="Tableau de bord"
        description="Vue opérationnelle des demandes et examens radiologiques."
        icon={ClipboardList}
        actions={(
          <>
          <button
            type="button"
            onClick={fetchExams}
            title="Actualiser"
            className="app-button-secondary inline-flex h-10 w-10 items-center justify-center text-[#536B7D]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {(user?.role === 'MEDECIN_DEMANDEUR' || user?.role === 'ADMIN') && (
            <Link
              to="/exams/new"
              className="app-button-primary inline-flex h-10 items-center gap-2 px-4 text-[13px] font-medium text-white"
            >
              <FilePlus className="h-4 w-4" />
              Nouvelle prescription
            </Link>
          )}
          </>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statItems.map(({ label, key, icon: Icon, tone }) => (
          <div key={key} className="app-panel app-stat-card flex min-w-0 items-center gap-3 px-3.5 py-4 sm:px-4 lg:px-5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-[17px] w-[17px]" />
            </span>
            <div className="min-w-0">
              <div className="text-[20px] font-semibold leading-none tracking-tight text-[#0F2233]">{stats[key]}</div>
              <div className="mt-1.5 truncate text-[11px] text-[#54687A]">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par statut">
        {statusChips.map((chip) => (
          <button
            type="button"
            key={chip.value || 'all'}
            aria-pressed={statusFilter === chip.value}
            onClick={() => setStatusFilter(chip.value)}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-medium transition ${
              statusFilter === chip.value
                ? 'border-[#B8D3EC] bg-[#E6F0FB] text-[#1566C0]'
                : 'border-[#DCE6EF] bg-white text-[#54687A] hover:border-[#B8D3EC] hover:text-[#1566C0]'
            }`}
          >
            {chip.label}<span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] text-[#71869A]">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un patient, IPP ou accession"
            className="h-9 w-full rounded-lg border border-[#DCE6EF] bg-white pl-9 pr-3 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-[#1566C0] focus:outline-none"
          />
        </label>
        <select
          value={modalityFilter}
          onChange={(event) => setModalityFilter(event.target.value)}
          className="h-9 min-w-36 rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] text-slate-700 focus:border-[#1566C0] focus:outline-none"
        >
          <option value="">Toutes les modalités</option>
          <option value="CT">Scanner (CT)</option>
          <option value="MR">IRM (MR)</option>
          <option value="CR">Radiographie (CR)</option>
          <option value="US">Échographie (US)</option>
          <option value="DX">Radiographie numérique (DX)</option>
          <option value="NM">Médecine nucléaire (NM)</option>
          <option value="MG">Mammographie (MG)</option>
          <option value="PT">Tomographie par émission de positons (PT)</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="h-9 min-w-36 rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] text-slate-700 focus:border-[#1566C0] focus:outline-none"
        >
          <option value="">Toutes les priorités</option>
          <option value="ROUTINE">Routine</option>
          <option value="URGENT">Urgent</option>
          <option value="TRES_URGENT">Très urgent</option>
        </select>
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#DCE6EF] px-4 py-3.5 lg:px-5">
          <div>
            <h2 className="text-[13px] font-semibold text-[#0F2233]">Examens récents</h2>
            <p className="mt-0.5 text-[11px] text-[#71869A]">{loading ? 'Mise à jour…' : `${exams.length} résultat${exams.length === 1 ? '' : 's'}`}</p>
          </div>
          <span className="rounded-md bg-[#F3F8FC] px-2.5 py-1 text-[11px] font-medium text-[#54687A]">Mise à jour en temps réel</span>
        </div>
        <div className="overflow-x-auto">
          <table className="app-data-table min-w-full border-collapse text-[13px]">
            <thead className="bg-[#EEF4FA] text-left text-[12px] font-medium text-[#54687A]">
              <tr className="h-10">
                <th className="px-4">Accession</th>
                <th className="px-4">Patient</th>
                <th className="px-4">Examen</th>
                <th className="px-4">Priorité</th>
                <th className="px-4">Statut</th>
                <th className="px-4 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan="6" className="h-20 px-4 text-center text-[13px] text-rose-700">{error}</td></tr>
              ) : loading ? (
                <tr><td colSpan="6" className="h-20 px-4 text-center text-[13px] text-slate-500">Chargement des examens…</td></tr>
              ) : exams.length === 0 ? (
                <tr><td colSpan="6" className="h-20 px-4 text-center text-[13px] text-slate-500">Aucun examen ne correspond à ces filtres.</td></tr>
              ) : exams.map((exam) => (
                <tr key={exam.id} className="h-10 border-t border-[#DCE6EF] transition-colors hover:bg-[#F3F8FC]">
                  <td className="whitespace-nowrap px-4 font-mono text-[12px] font-medium text-[#54687A]">{exam.accession_number}</td>
                  <td className="whitespace-nowrap px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E6F0FB] text-[10px] font-semibold text-[#1566C0]">
                        {[exam.patient_prenom?.[0], exam.patient_nom?.[0]].filter(Boolean).join('').toUpperCase()}
                      </span>
                      <span>
                        <span className="block text-[13px] font-medium text-[#0F2233]">{exam.patient_nom} {exam.patient_prenom}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-[#71869A]">{exam.patient_ipp}</span>
                      </span>
                    </div>
                  </td>
                  <td className="min-w-[220px] px-4">
                    <span className="block text-[13px] font-medium text-[#0F2233]">{exam.type_examen}</span>
                    <span className="mt-0.5 block text-[10px] text-[#71869A]">{exam.modalite_display || exam.modalite}</span>
                  </td>
                  <td className="whitespace-nowrap px-4"><PriorityBadge priority={exam.priorite} /></td>
                  <td className="whitespace-nowrap px-4"><StatusBadge status={exam.statut} /></td>
                  <td className="whitespace-nowrap px-4 text-right">
                    <Link
                      to={`/exams/${exam.id}`}
                      aria-label={`Ouvrir l'examen ${exam.accession_number}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-[#E6F0FB] hover:text-[#1566C0]"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

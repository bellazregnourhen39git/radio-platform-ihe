import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Search, RefreshCw, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (actionFilter) params.append('action', actionFilter);

      const res = await api.get(`/audit/?${params.toString()}`);
      setLogs(res.data.results || res.data);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger le journal d’audit. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 250);
    return () => clearTimeout(timer);
  }, [actionFilter, search]);

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="Traçabilité système"
        title="Journal d’audit"
        description="Historique immuable des actions sensibles et des échanges système."
        icon={ShieldCheck}
        actions={(
        <button
          onClick={fetchLogs}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] font-medium text-[#54687A] transition hover:bg-[#EEF4FA]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
        )}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher dans le journal"
            className="h-9 w-full rounded-lg border border-[#DCE6EF] bg-white pl-9 pr-3 text-[12px] focus:border-[#1566C0] focus:outline-none"
          />
        </label>
        <label className="relative min-w-[200px]">
          <input
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            placeholder="Filtrer par action"
            className="h-9 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] focus:border-[#1566C0] focus:outline-none"
          />
        </label>
      </div>

      <div className="app-panel overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[13px] text-slate-500">Chargement des traces d’audit…</div>
        ) : error ? (
          <div role="alert" className="p-10 text-center text-[13px] text-rose-700">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-[13px] text-slate-500">Aucun événement d’audit enregistré.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-data-table min-w-full border-collapse text-[12px]">
              <thead className="bg-[#EEF4FA] text-left text-[10px] font-semibold tracking-wide text-[#71869A]">
                <tr className="h-11">
                  <th className="px-4">Horodatage</th>
                  <th className="px-4">Acteur</th>
                  <th className="px-4">Action</th>
                  <th className="px-4">Ressource</th>
                  <th className="px-4">Résultat</th>
                  <th className="px-4">Détails</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="h-12 border-t border-[#DCE6EF] transition-colors hover:bg-[#F3F8FC]">
                    <td className="whitespace-nowrap px-4 font-mono text-[10px] text-[#71869A]">
                      {new Date(log.date_creation).toLocaleString('fr-FR')}
                    </td>
                    <td className="whitespace-nowrap px-4 text-[11px] font-medium text-[#0F2233]">
                      {log.acteur_username}
                    </td>
                    <td className="whitespace-nowrap px-4 font-mono text-[10px] font-medium text-[#1566C0]">
                      {log.action}
                    </td>
                    <td className="whitespace-nowrap px-4 text-[11px] text-[#54687A]">
                      {log.type_ressource} : {log.id_ressource?.slice(0, 15)}...
                    </td>
                    <td className="whitespace-nowrap px-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium ${
                        log.resultat === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${log.resultat === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {log.resultat}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 text-[10px] text-[#71869A]">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

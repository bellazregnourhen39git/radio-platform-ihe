import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import PageHeader from '../components/PageHeader';
import { 
  CheckCircle, Clock, FileEdit, CheckCircle2, AlertCircle, Activity,
  X, Play, Eye, Calendar, RefreshCw
} from 'lucide-react';

export default function RisConsole() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('planifier');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [scheduleModal, setScheduleModal] = useState({ open: false, exam: null, date: '' });
  const [performModal, setPerformModal] = useState({ open: false, exam: null, uid: '', notes: '' });
  const [reportModal, setReportModal] = useState({ open: false, exam: null, text: '' });

  const fetchTabExams = async () => {
    setLoading(true);
    setLoadError('');
    try {
      let statusQuery = 'DEMANDE';
      if (activeTab === 'worklist') statusQuery = 'PLANIFIE';
      if (activeTab === 'rediger') statusQuery = 'REALISE';

      const res = await api.get(`/exams/?statut=${statusQuery}`);
      const data = res.data.results || res.data;
      if (!Array.isArray(data)) throw new Error('Format de réponse invalide pour la liste RIS.');
      setExams(data);
    } catch (err) {
      console.error('Impossible de charger les examens de la console RIS.', err);
      setExams([]);
      setLoadError(
        err.response?.data?.detail
          || err.response?.data?.error
          || 'Impossible de charger les examens de cette étape. Vérifiez la connexion et réessayez.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabExams();
  }, [activeTab]);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await api.post(`/exams/${scheduleModal.exam.id}/schedule/`, {
        date_planifiee: scheduleModal.date,
        radiologue_assigne_id: user?.id
      });
      setSuccessMsg(`Examen ${scheduleModal.exam.accession_number} planifié avec succès.`);
      setScheduleModal({ open: false, exam: null, date: '' });
      fetchTabExams();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.error || 'Erreur lors de la planification.');
    }
  };

  const handlePerformSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const uid = performModal.uid.trim() || `1.2.826.0.1.3680043.8.498.${Date.now()}`;
      await api.post(`/exams/${performModal.exam.id}/mark-performed/`, {
        study_instance_uid: uid,
        notes: performModal.notes
      });
      setSuccessMsg(`Acquisition enregistrée. StudyInstanceUID: ${uid}`);
      setPerformModal({ open: false, exam: null, uid: '', notes: '' });
      fetchTabExams();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.error || 'Erreur lors de la notification de fin d\'acquisition.');
    }
  };

  const handleReportSave = async (isFinal) => {
    setErrorMsg('');
    try {
      const endpoint = isFinal ? 'validate-report' : 'save-report';
      await api.post(`/exams/${reportModal.exam.id}/${endpoint}/`, {
        report_text: reportModal.text
      });
      setSuccessMsg(
        isFinal 
          ? `Compte rendu validé et signé ! Message HL7 ORU^R01 émis vers le SIH.` 
          : `Brouillon de compte rendu sauvegardé.`
      );
      if (isFinal) {
        setReportModal({ open: false, exam: null, text: '' });
        fetchTabExams();
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.error || 'Erreur lors de l\'enregistrement du compte rendu.');
    }
  };

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="Espace de coordination"
        title="Console RIS"
        description="Coordonnez la planification, l’acquisition et les comptes rendus radiologiques."
        icon={Activity}
        actions={(
        <button
          type="button"
          onClick={fetchTabExams}
          disabled={loading}
          className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-lg border border-[#DCE6EF] bg-white px-3 text-[11px] font-medium text-[#54687A] transition hover:border-[#B9D2EA] hover:bg-[#F3F8FC] hover:text-[#1566C0] disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
        )}
      />

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          {errorMsg}
        </div>
      )}

      <div className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-[#DCE6EF] bg-white p-1.5 shadow-[0_6px_24px_rgba(21,102,192,0.05)]" role="tablist" aria-label="Étapes du parcours RIS">
        <button
          type="button"
          onClick={() => setActiveTab('planifier')}
          role="tab"
          aria-selected={activeTab === 'planifier'}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'planifier'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC] hover:text-[#0F2233]'
          }`}
        >
          <Clock className="w-4 h-4" />
          À planifier
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('worklist')}
          role="tab"
          aria-selected={activeTab === 'worklist'}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'worklist'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC] hover:text-[#0F2233]'
          }`}
        >
          <Play className="w-4 h-4" />
          Worklist & acquisition
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rediger')}
          role="tab"
          aria-selected={activeTab === 'rediger'}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'rediger'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC] hover:text-[#0F2233]'
          }`}
        >
          <FileEdit className="w-4 h-4" />
          À interpréter
        </button>
      </div>

      <div className="app-panel overflow-hidden">
        {loading ? (
          <div className="p-14 text-center text-[12px] text-[#71869A]">
            <span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-[#DCE6EF] border-t-[#1566C0]" />
            Chargement des examens…
          </div>
        ) : loadError ? (
          <div role="alert" className="p-12 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-semibold text-[#0F2233]">La liste RIS est indisponible</p>
            <p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-[#54687A]">{loadError}</p>
            <button type="button" onClick={fetchTabExams} className="app-button-primary mt-4 inline-flex h-9 items-center px-4 text-[11px] font-medium text-white">
              Réessayer
            </button>
          </div>
        ) : exams.length === 0 ? (
          <div className="p-14 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E6F0FB] text-[#1566C0]">
              <CheckCircle className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-semibold text-[#0F2233]">Aucun examen à traiter à cette étape</p>
            <p className="mt-1 text-[11px] text-[#71869A]">Les nouveaux dossiers apparaîtront ici dès leur transmission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-data-table min-w-full border-collapse text-[12px]">
              <thead className="bg-[#EEF4FA] text-left text-[11px] font-medium text-[#54687A]">
                <tr className="h-10">
                  <th className="px-4">Accession</th>
                  <th className="px-4">Patient</th>
                  <th className="px-4">Examen / modalité</th>
                  <th className="px-4">Priorité</th>
                  <th className="px-4">Demandeur</th>
                  <th className="px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id} className="h-12 border-t border-[#DCE6EF] transition-colors hover:bg-[#F3F8FC]">
                    <td className="whitespace-nowrap px-4 font-mono text-[11px] font-medium text-[#54687A]">
                      {exam.accession_number}
                    </td>

                    <td className="whitespace-nowrap px-4">
                      <div className="text-[12px] font-medium text-[#0F2233]">{exam.patient_nom} {exam.patient_prenom}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[#71869A]">{exam.patient_ipp}</div>
                    </td>

                    <td className="px-4">
                      <div className="text-[12px] font-medium text-[#0F2233]">{exam.type_examen}</div>
                      <div className="mt-0.5 text-[10px] text-[#71869A]">
                        {exam.modalite_display || exam.modalite} · {exam.region_anatomique}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4">
                      <PriorityBadge priority={exam.priorite} />
                    </td>

                    <td className="whitespace-nowrap px-4 text-[11px] text-[#54687A]">
                      {exam.medecin_demandeur_name || 'Prescripteur SIH'}
                    </td>

                    <td className="whitespace-nowrap px-4 text-right">
                      <Link
                        to={`/exams/${exam.id}`}
                        className="mr-1 inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCE6EF] px-2.5 text-[10px] font-medium text-[#54687A] transition hover:bg-[#F3F8FC] hover:text-[#1566C0]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Détails
                      </Link>

                      {/* Action selon l'onglet actif */}
                      {activeTab === 'planifier' && (
                        <button
                          onClick={() => {
                            const nowPlus2 = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16);
                            setScheduleModal({ open: true, exam, date: nowPlus2 });
                          }}
                          className="app-button-primary inline-flex h-8 items-center gap-1 px-3 text-[11px] font-medium text-white"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Planifier
                        </button>
                      )}

                      {activeTab === 'worklist' && (
                        <button
                          onClick={() => {
                            setPerformModal({
                              open: true,
                              exam,
                              uid: `1.2.826.0.1.3680043.8.498.${Math.floor(Math.random() * 1000000000)}`,
                              notes: 'Acquisition réalisée selon protocole standard'
                            });
                          }}
                          className="app-button-primary inline-flex h-8 items-center gap-1 px-3 text-[11px] font-medium text-white"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Marquer réalisé
                        </button>
                      )}

                      {activeTab === 'rediger' && (
                        <button
                          onClick={() => {
                            setReportModal({
                              open: true,
                              exam,
                              text: exam.report_text || `INDICATION :\n${exam.indication_clinique || ''}\n\nRÉSULTATS :\nExamen réalisé sans anomalie décelable.\n\nCONCLUSION :\nExamen radiologique dans les limites de la normale.`
                            });
                          }}
                          className="app-button-primary inline-flex h-8 items-center gap-1 px-3 text-[11px] font-medium text-white"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                          Rédiger le compte rendu
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PLANIFICATION */}
      {scheduleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[#DCE6EF] bg-white p-6">
            <h3 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#0F2233]">
              <Calendar className="h-4 w-4 text-[#1566C0]" />
              Planifier l'examen ({scheduleModal.exam.accession_number})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Patient : {scheduleModal.exam.patient_nom} {scheduleModal.exam.patient_prenom} — {scheduleModal.exam.type_examen}
            </p>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
                  Date et heure prévues *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleModal.date}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, date: e.target.value })}
                  className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] focus:border-[#1566C0] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setScheduleModal({ open: false, exam: null, date: '' })}
                  className="app-button-secondary h-9 px-3 text-[11px] font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="app-button-primary h-9 px-3 text-[11px] font-medium text-white"
                >
                  Confirmer la planification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MARQUER RÉALISÉ */}
      {performModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[#DCE6EF] bg-white p-6">
            <h3 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#0F2233]">
              <Play className="h-4 w-4 text-[#1566C0]" />
              Simulation Fin d'Acquisition (Module 2)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enregistre l'UID DICOM et bascule le statut de l'examen à RÉALISÉ.
            </p>

            <form onSubmit={handlePerformSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
                  StudyInstanceUID (Généré par la modalité/PACS) *
                </label>
                <input
                  type="text"
                  required
                  value={performModal.uid}
                  onChange={(e) => setPerformModal({ ...performModal, uid: e.target.value })}
                  className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 font-mono text-[11px] focus:border-[#1566C0] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
                  Notes manip / acquisition
                </label>
                <input
                  type="text"
                  value={performModal.notes}
                  onChange={(e) => setPerformModal({ ...performModal, notes: e.target.value })}
                  placeholder="Incidents éventuels, produit de contraste injecté..."
                  className="h-10 w-full rounded-lg border border-[#DCE6EF] bg-white px-3 text-[12px] focus:border-[#1566C0] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPerformModal({ open: false, exam: null, uid: '', notes: '' })}
                  className="app-button-secondary h-9 px-3 text-[11px] font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="app-button-primary h-9 px-3 text-[11px] font-medium text-white"
                >
                  Valider l'acquisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RÉDACTION ET VALIDATION COMPTE RENDU */}
      {reportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[10px] border border-[#DCE6EF] bg-white p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#0F2233]">
                <FileEdit className="w-5 h-5 text-emerald-600" />
                Compte Rendu Radiologique — {reportModal.exam.accession_number}
              </h3>
              <button 
                onClick={() => setReportModal({ open: false, exam: null, text: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3 rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] p-3 text-[11px] text-[#54687A]">
              Patient : <span className="font-semibold text-slate-800">{reportModal.exam.patient_nom} {reportModal.exam.patient_prenom}</span> | Acte : <span className="font-semibold text-slate-800">{reportModal.exam.type_examen}</span>
            </div>

            <div className="flex-1 flex flex-col mb-4">
              <label className="mb-1.5 block text-[11px] font-medium text-[#54687A]">
                Texte du Compte Rendu (Protocole, Résultats, Conclusion) *
              </label>
              <textarea
                rows="10"
                value={reportModal.text}
                onChange={(e) => setReportModal({ ...reportModal, text: e.target.value })}
                className="w-full flex-1 rounded-lg border border-[#DCE6EF] bg-white px-3 py-2.5 font-mono text-[12px] focus:border-[#1566C0] focus:outline-none"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => handleReportSave(false)}
                className="h-9 rounded-lg border border-[#DCE6EF] px-3 text-[11px] font-medium text-[#54687A] hover:bg-[#EEF4FA]"
              >
                Sauvegarder Brouillon
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReportModal({ open: false, exam: null, text: '' })}
                  className="app-button-secondary h-9 px-3 text-[11px] font-medium"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => handleReportSave(true)}
                  className="app-button-primary inline-flex h-9 items-center gap-1.5 px-4 text-[11px] font-medium text-white"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider, Signer et Clôturer (ORU^R01)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

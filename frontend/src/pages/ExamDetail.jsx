import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { 
  Activity, Clock, User, FileText, CheckCircle2, AlertCircle, Send, Image,
  Share2, Copy, Check, X, AlertTriangle, Stethoscope
} from 'lucide-react';

export default function ExamDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedHl7, setCopiedHl7] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'hl7' | 'fhir' | 'pacs' | 'teleexpertise'

  // Modal d'annulation
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [motifAnnulation, setMotifAnnulation] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchExam = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/exams/${id}/`);
      setExam(res.data);
    } catch (err) {
      setError("Impossible de charger les détails de cet examen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id]);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedHl7(idx);
    setTimeout(() => setCopiedHl7(null), 2000);
  };

  const handleCancel = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      await api.post(`/exams/${id}/cancel/`, { motif_annulation: motifAnnulation });
      setCancelModalOpen(false);
      setMotifAnnulation('');
      fetchExam();
    } catch (err) {
      setActionError(err.response?.data?.detail || err.response?.data?.motif_annulation?.[0] || "Erreur lors de l'annulation.");
    }
  };

  if (loading) {
    return (
      <div className="w-full animate-pulse space-y-4">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-200" />
        <div className="mt-8 h-40 rounded-xl border border-[#DCE6EF] bg-white" />
        <div className="h-56 rounded-xl border border-[#DCE6EF] bg-white" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="w-full py-8">
        <div className="max-w-xl rounded-xl border border-rose-200 bg-white p-6 text-rose-700">
          <AlertCircle className="mb-3 h-5 w-5" />
          <h2 className="text-[16px] font-semibold text-[#0F2233]">Examen indisponible</h2>
          <p className="mt-1 text-[13px] text-slate-600">{error || "Examen introuvable."}</p>
          <Link to="/dashboard" className="mt-4 inline-flex text-[12px] font-medium text-[#1566C0] hover:underline">
            Retourner au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  const patient = exam.patient || {};
  const canCancel = ['DEMANDE', 'PLANIFIE'].includes(exam.statut);

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-medium text-[#1566C0]">Dossier d’imagerie</div>
          <p className="text-[12px] text-[#54687A]">Suivi, données cliniques et interopérabilité.</p>
        </div>
        {canCancel && (
          <button
            onClick={() => setCancelModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50"
          >
            <X className="w-4 h-4" />
            Annuler la demande
          </button>
        )}
      </div>

      {searchParams.get('created') && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Demande créée avec succès ! Message HL7 ORM^O01 généré et transmis au RIS.</span>
          </div>
          <span className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-mono text-[10px] font-medium">
            {exam.accession_number}
          </span>
        </div>
      )}

      {/* Carte d'identité de l'examen */}
      <div className="app-panel mb-5 overflow-hidden">
        <div className="flex flex-col justify-between gap-5 border-b border-[#DCE6EF] p-5 lg:flex-row lg:items-center lg:p-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#F3F8FC] px-2.5 py-1 font-mono text-[11px] font-medium text-[#54687A]">
                {exam.accession_number}
              </span>
              <StatusBadge status={exam.statut} />
              <PriorityBadge priority={exam.priorite} />
            </div>
            <h1 className="flex flex-wrap items-center gap-2 text-[20px] font-semibold tracking-[-0.02em] text-[#0F2233]">
              <span className="rounded-md bg-[#E6F0FB] px-2 py-1 font-mono text-[10px] font-medium text-[#1566C0]">
                {exam.modalite}
              </span>
              {exam.type_examen}
            </h1>
            <p className="mt-1.5 text-[11px] text-[#71869A]">Région anatomique : {exam.region_anatomique}</p>
          </div>

          <div className="grid gap-3 rounded-lg bg-[#EEF4FA] p-4 text-[11px] text-[#54687A] sm:grid-cols-3 lg:min-w-[460px]">
            <div className="min-w-0">
              <div className="text-[10px] text-[#71869A]">Prescripteur</div>
              <div className="mt-1 truncate font-medium text-[#0F2233]">
                {exam.medecin_demandeur ? `${exam.medecin_demandeur.first_name} ${exam.medecin_demandeur.last_name}` : '—'}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-[#71869A]">Radiologue</div>
              <div className="mt-1 truncate font-medium text-[#0F2233]">
                {exam.radiologue_assigne ? `${exam.radiologue_assigne.first_name} ${exam.radiologue_assigne.last_name}` : 'En attente d\'attribution'}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-[#71869A]">Date de demande</div>
              <div className="mt-1 truncate font-medium text-[#0F2233]">
                {new Date(exam.date_demande).toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        </div>

        {/* Détails Patient & Indication Clinique */}
        <div className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.8fr)] lg:p-6">
          <div className="rounded-lg border border-[#DCE6EF] bg-[#F3F8FC] p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-[#71869A]">
              <User className="h-3.5 w-3.5 text-[#1566C0]" />
              Patient associé
            </h3>
            <Link to={`/patients/${patient.id}`} className="block text-[13px] font-semibold text-[#0F2233] hover:text-[#1566C0]">
              {patient.nom} {patient.prenom}
            </Link>
            <div className="mt-1.5 font-mono text-[10px] text-[#71869A]">IPP : {patient.ipp}</div>
            <div className="mt-1 text-[10px] text-[#71869A]">
              Né(e) le : {patient.date_naissance} ({patient.sexe === 'M' ? 'Homme' : patient.sexe === 'F' ? 'Femme' : 'Autre'})
            </div>
            <div className="mt-1 font-mono text-[10px] text-[#71869A]">Tél : {patient.telephone || '—'}</div>
          </div>

          <div className="rounded-lg border border-[#DCE6EF] bg-white p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium text-[#71869A]">
              <FileText className="h-3.5 w-3.5 text-[#1566C0]" />
              Indication clinique
            </h3>
            <p className="whitespace-pre-wrap text-[12px] leading-5 text-[#54687A]">
              {exam.indication_clinique || 'Aucune indication renseignée.'}
            </p>

            {exam.motif_annulation && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                <span className="font-bold">Motif d'annulation : </span>
                {exam.motif_annulation}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compte Rendu (si rédigé) */}
      {exam.report_text && (
        <div className="app-panel mb-5 p-5 lg:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#0F2233]">
              <FileText className="h-4 w-4 text-emerald-600" />
              Compte rendu radiologique
              <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                exam.report_status === 'VALIDE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {exam.report_status_display}
              </span>
            </h2>
            {exam.radiologue_assigne && (
              <span className="text-xs text-slate-500 font-medium">
                Signé par : Dr. {exam.radiologue_assigne.first_name} {exam.radiologue_assigne.last_name}
              </span>
            )}
          </div>
          <div className="whitespace-pre-wrap rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] p-4 font-mono text-[11px] leading-5 text-[#54687A]">
            {exam.report_text}
          </div>
        </div>
      )}

      {/* Onglets d'Interopérabilité et d'Intégration */}
      <div className="app-panel mb-5 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#DCE6EF] px-4 pt-2 sm:px-5">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-2 text-[11px] font-medium transition-colors ${
              activeTab === 'timeline' ? 'border-[#1566C0] text-[#1566C0]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Timeline du Workflow ({exam.status_history?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('hl7')}
            className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-2 text-[11px] font-medium transition-colors ${
              activeTab === 'hl7' ? 'border-[#1566C0] text-[#1566C0]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4 text-[#1566C0]" />
            Messages HL7 v2 ({exam.hl7_messages?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('fhir')}
            className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-2 text-[11px] font-medium transition-colors ${
              activeTab === 'fhir' ? 'border-[#1566C0] text-[#1566C0]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            Export FHIR R4
          </button>

          <button
            onClick={() => setActiveTab('pacs')}
            className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-2 text-[11px] font-medium transition-colors ${
              activeTab === 'pacs' ? 'border-[#1566C0] text-[#1566C0]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Image className="w-4 h-4 text-[#1566C0]" />
            Images PACS (Module 2)
          </button>

          <button
            onClick={() => setActiveTab('teleexpertise')}
            className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-2 text-[11px] font-medium transition-colors ${
              activeTab === 'teleexpertise' ? 'border-[#1566C0] text-[#1566C0]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-[#1566C0]" />
            Téléexpertise (Module 3)
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {/* TAB 1: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="flow-root">
              <ul className="-mb-8">
                {exam.status_history?.map((step, idx) => (
                  <li key={step.id}>
                    <div className="relative pb-8">
                      {idx !== exam.status_history.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3 items-start">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E6F0FB] text-xs font-semibold text-[#1566C0] ring-4 ring-white">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                              <span>Statut passé à :</span>
                              <StatusBadge status={step.nouveau_statut} />
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{step.commentaire}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Par : {step.change_par_name}</p>
                          </div>
                          <div className="text-right text-xs whitespace-nowrap text-slate-500">
                            {new Date(step.date).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* TAB 2: HL7 MESSAGES */}
          {activeTab === 'hl7' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-[#B8D3EC] bg-[#E6F0FB] p-3 text-[11px] text-[#54687A]">
                <strong>Format Standard HL7 v2.5 (ER7) :</strong> Les messages ci-dessous sont générés automatiquement par le Module 1 et enregistrés dans la table <code className="font-mono text-[#1566C0]">Hl7Message</code>.
              </div>

              {exam.hl7_messages?.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">Aucun message HL7 pour le moment.</div>
              ) : (
                exam.hl7_messages?.map((hl7, idx) => (
                  <div key={hl7.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-white text-slate-800 px-2.5 py-0.5 rounded border border-slate-300">
                          {hl7.type_message}
                        </span>
                        <span className="text-xs text-slate-600">{hl7.direction_display}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-500">
                          {new Date(hl7.date_creation).toLocaleString('fr-FR')}
                        </span>
                        <button
                          onClick={() => handleCopy(hl7.contenu_brut, idx)}
                          className="inline-flex items-center gap-1 rounded border border-[#DCE6EF] bg-white px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                        >
                          {copiedHl7 === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedHl7 === idx ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                    </div>
                    <pre className="overflow-x-auto border-t border-[#DCE6EF] bg-[#EAF2F9] p-4 font-mono text-xs leading-relaxed text-[#234D73]">
                      {hl7.contenu_brut}
                    </pre>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: EXPORT FHIR R4 */}
          {activeTab === 'fhir' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <strong>Endpoints FHIR R4 Exposés en direct :</strong> Ces ressources sont consommables directement par le Module 3 (Téléexpertise) et le Module 4 (Interopérabilité).
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <a
                  href={`/fhir/Patient/${patient.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] p-3 text-[11px] font-medium text-[#1566C0] transition hover:border-[#B8D3EC] hover:bg-[#E6F0FB]"
                >
                  <span>GET /fhir/Patient/{patient.id?.slice(0, 8)}...</span>
                  <Share2 className="w-4 h-4" />
                </a>

                <a
                  href={`/fhir/ServiceRequest/${exam.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] p-3 text-[11px] font-medium text-[#1566C0] transition hover:border-[#B8D3EC] hover:bg-[#E6F0FB]"
                >
                  <span>GET /fhir/ServiceRequest/{exam.id?.slice(0, 8)}...</span>
                  <Share2 className="w-4 h-4" />
                </a>

                <a
                  href={`/fhir/DiagnosticReport/${exam.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] p-3 text-[11px] font-medium text-[#1566C0] transition hover:border-[#B8D3EC] hover:bg-[#E6F0FB]"
                >
                  <span>GET /fhir/DiagnosticReport/{exam.id?.slice(0, 8)}...</span>
                  <Share2 className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 4: PLACEHOLDER PACS / MODULE 2 */}
          {activeTab === 'pacs' && (
            <div className="rounded-xl border border-[#DCE6EF] bg-[#EEF4FA] p-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F0FB] text-[#1566C0]">
                <Image className="w-6 h-6" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#0F2233]">
                Point d'Intégration Module 2 — Visualiseur DICOM / PACS
              </h3>
              <p className="mx-auto mt-1 max-w-lg text-[11px] leading-5 text-[#54687A]">
                Le Module 2 consomme la worklist (<code className="rounded bg-[#E6F0FB] px-1 py-0.5 font-mono text-[#1566C0]">/api/v1/worklist/</code>) et notifie la fin d'acquisition via <code className="rounded bg-[#E6F0FB] px-1 py-0.5 font-mono text-[#1566C0]">POST /api/v1/exams/{exam.id}/mark-performed/</code>.
              </p>

              <div className="mx-auto mt-4 max-w-md space-y-2 rounded-lg border border-[#DCE6EF] bg-white p-4 text-left text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">StudyInstanceUID :</span>
                  <span className="font-mono font-bold text-slate-800">
                    {exam.study_instance_uid || 'En attente d\'acquisition DICOM'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Statut Imagerie :</span>
                  <span className={`font-semibold ${exam.study_instance_uid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {exam.study_instance_uid ? 'Série DICOM indexée' : 'Aucune image'}
                  </span>
                </div>
              </div>

              {exam.study_instance_uid && (
                <button
                  onClick={() => alert(`Lancement du visualiseur DICOM pour la série ${exam.study_instance_uid} (Module 2 Cornerstone3D / OHIF)`)}
                  className="app-button-primary mt-4 inline-flex h-9 items-center gap-2 px-4 text-[11px] font-medium text-white"
                >
                  <Eye className="w-4 h-4" />
                  Ouvrir l'examen dans le visualiseur DICOM
                </button>
              )}
            </div>
          )}

          {/* TAB 5: PLACEHOLDER TÉLÉEXPERTISE / MODULE 3 */}
          {activeTab === 'teleexpertise' && (
            <div className="rounded-xl border border-[#DCE6EF] bg-[#EEF4FA] p-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F0FB] text-[#1566C0]">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h3 className="text-[14px] font-semibold text-[#0F2233]">
                Point d'Intégration Module 3 — Téléexpertise (IHE MHD)
              </h3>
              <p className="mx-auto mt-1 max-w-lg text-[11px] leading-5 text-[#54687A]">
                Transmission d'un sous-ensemble ciblé du dossier patient et du compte rendu radiologique vers un spécialiste externe.
              </p>

              <div className="mx-auto mt-4 max-w-md space-y-2 rounded-lg border border-[#DCE6EF] bg-white p-4 text-left text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Compte rendu disponible :</span>
                  <span className={`font-semibold ${exam.report_status === 'VALIDE' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {exam.report_status === 'VALIDE' ? 'Validé & Signé' : 'Non validé'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ressource FHIR DiagnosticReport :</span>
                  <span className="font-mono text-[#1566C0]">/fhir/DiagnosticReport/{exam.id?.slice(0, 8)}...</span>
                </div>
              </div>

              <button
                disabled={exam.report_status !== 'VALIDE'}
                onClick={() => alert(`Dossier radiologique ${exam.accession_number} transmis à la plateforme de téléexpertise du Module 3 via profil IHE MHD.`)}
                className="app-button-primary mt-4 inline-flex h-9 items-center gap-2 px-4 text-[11px] font-medium text-white disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                Transmettre pour avis téléexpertise (Module 3)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal d'Annulation avec Motif Obligatoire */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[#DCE6EF] bg-white p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Confirmer l'Annulation de la Demande
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              L'annulation d'un examen médical doit être obligatoirement justifiée pour la traçabilité médico-légale.
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motif médical ou administratif de l'annulation *
                </label>
                <textarea
                  rows="3"
                  required
                  value={motifAnnulation}
                  onChange={(e) => setMotifAnnulation(e.target.value)}
                  placeholder="Ex: Patient sorti contre avis médical, amélioration spontanée, contre-indication découverte..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                >
                  Confirmer l'annulation (ANNULE)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

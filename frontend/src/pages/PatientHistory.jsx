import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { FileText, PlusCircle, Share2, ChevronRight } from 'lucide-react';

export default function PatientHistory() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [patRes, exRes] = await Promise.all([
          api.get(`/patients/${id}/`),
          api.get(`/patients/${id}/exams/`)
        ]);
        setPatient(patRes.data);
        setExams(exRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="w-full py-8 text-center text-slate-500">
        Chargement du dossier patient...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="w-full py-8 text-center">
        <p className="text-slate-600">Patient introuvable.</p>
        <Link to="/patients" className="mt-2 inline-block text-xs text-[#1566C0] underline">
          Retour à la liste des patients
        </Link>
      </div>
    );
  }

  const birth = new Date(patient.date_naissance);
  const age = new Date().getFullYear() - birth.getFullYear();

  return (
    <div className="w-full space-y-5">
      <div className="app-panel overflow-hidden">
        <div className="flex flex-col justify-between gap-5 border-b border-[#DCE6EF] p-5 sm:flex-row sm:items-center lg:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E6F0FB] text-lg font-semibold text-[#1566C0]">
              {[patient.prenom?.[0], patient.nom?.[0]].filter(Boolean).join('').toUpperCase()}
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-medium text-[#54687A]">{patient.ipp}</span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Dossier actif
                </span>
              </div>
              <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F2233]">
                {patient.prenom} {patient.nom}
              </h1>
              <p className="mt-1 text-[12px] text-[#54687A]">
                {patient.sexe === 'M' ? 'Homme' : patient.sexe === 'F' ? 'Femme' : 'Autre'} · {age} ans · Né(e) le {birth.toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/fhir/Patient/${patient.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DCE6EF] px-3 text-[11px] font-medium text-[#54687A] transition hover:bg-[#EEF4FA]"
            >
              <Share2 className="h-4 w-4 text-emerald-600" />
              FHIR R4 Patient
            </a>

            <Link
              to={`/exams/new?patient_id=${patient.id}`}
              className="app-button-primary inline-flex h-9 items-center gap-1.5 px-3 text-[11px] font-medium text-white"
            >
              <PlusCircle className="h-4 w-4" />
              Prescrire un examen
            </Link>
          </div>
        </div>

        <div className="grid gap-px bg-[#DCE6EF] sm:grid-cols-3">
          {[
            { label: 'Date de naissance', value: birth.toLocaleDateString('fr-FR') },
            { label: 'Téléphone', value: patient.telephone || 'Non renseigné' },
            { label: 'Adresse', value: patient.adresse || 'Non renseignée' },
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0 bg-white px-5 py-4">
              <div className="text-[10px] font-medium text-[#71869A]">{label}</div>
              <div className="mt-1 truncate text-[12px] font-medium text-[#0F2233]">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#DCE6EF] px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-[#0F2233]">Historique des examens</h2>
            <p className="mt-0.5 text-[11px] text-[#71869A]">
              Parcours de soins radiologiques · {exams.length} examen{exams.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {exams.length === 0 ? (
          <div className="p-14 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F0FB] text-[#1566C0]">
              <FileText className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-medium text-[#0F2233]">Aucun examen enregistré pour ce patient.</p>
            <p className="text-xs text-slate-400 mt-1">Créez une première demande de radiologie dès maintenant.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#DCE6EF]">
            {exams.map((exam) => (
              <div key={exam.id} className="flex flex-col justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#F3F8FC] sm:flex-row sm:items-center">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#F3F8FC] px-2 py-1 font-mono text-[10px] font-medium text-[#54687A]">
                      {exam.accession_number}
                    </span>
                    <span className="rounded-md bg-[#E6F0FB] px-2 py-1 text-[10px] font-medium text-[#1566C0]">
                      {exam.modalite_display || exam.modalite}
                    </span>
                    <StatusBadge status={exam.statut} />
                    <PriorityBadge priority={exam.priorite} />
                  </div>
                  <div className="text-[13px] font-medium text-[#0F2233]">{exam.type_examen}</div>
                  <div className="text-[11px] text-[#71869A]">
                    Demandé le {new Date(exam.date_demande).toLocaleDateString('fr-FR')} par {exam.medecin_demandeur_name || 'Prescripteur SIH'}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to={`/exams/${exam.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCE6EF] px-3 text-[11px] font-medium text-[#54687A] transition hover:border-[#B8D3EC] hover:bg-[#E6F0FB] hover:text-[#1566C0]"
                  >
                    Voir le dossier
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

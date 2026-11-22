import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import PriorityBadge from '../components/PriorityBadge';
import {
  HardDrive, RefreshCw, Eye, Upload, Database,
  AlertCircle, CheckCircle2, Image, ExternalLink
} from 'lucide-react';

export default function PacsConsole() {
  const [activeTab, setActiveTab] = useState('worklist');
  const [worklist, setWorklist] = useState([]);
  const [pacsInfo, setPacsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const fetchWorklist = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/worklist/?status=PLANIFIE');
      setWorklist(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError('Impossible de charger la worklist. Vérifiez la connexion au backend.');
      setWorklist([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPacsInfo = async () => {
    try {
      const res = await api.get('/pacs/info/');
      setPacsInfo(res.data);
    } catch {
      setPacsInfo(null);
    }
  };

  useEffect(() => {
    fetchWorklist();
    fetchPacsInfo();
  }, []);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadResult(null);
    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        await api.post('/pacs/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded++;
      } catch {
        failed++;
      }
    }

    setUploading(false);
    setUploadResult({ uploaded, failed });
    setSuccessMsg(`${uploaded} fichier(s) DICOM envoyé(s) au PACS.`);
    setTimeout(() => setSuccessMsg(''), 5000);
    fetchPacsInfo();
  };

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="Module 2 — Imagerie"
        title="Console PACS"
        description="Worklist DICOM, upload d'images et consultation du PACS Orthanc."
        icon={HardDrive}
        actions={
          <button
            type="button"
            onClick={() => { fetchWorklist(); fetchPacsInfo(); }}
            disabled={loading}
            className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-lg border border-[#DCE6EF] bg-white px-3 text-[11px] font-medium text-[#54687A] transition hover:border-[#B9D2EA] hover:bg-[#F3F8FC] hover:text-[#1566C0] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        }
      />

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Stats PACS */}
      {pacsInfo && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Patients', value: pacsInfo.CountPatients || 0, icon: '👤' },
            { label: 'Études', value: pacsInfo.CountStudies || 0, icon: '📋' },
            { label: 'Séries', value: pacsInfo.CountSeries || 0, icon: '🗂️' },
            { label: 'Instances', value: pacsInfo.CountInstances || 0, icon: '🖼️' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-[#DCE6EF] bg-white p-4 text-center">
              <div className="text-2xl">{stat.icon}</div>
              <div className="mt-1 text-[20px] font-bold text-[#0F2233]">{stat.value}</div>
              <div className="text-[10px] text-[#71869A]">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-[#DCE6EF] bg-white p-1.5 shadow-[0_6px_24px_rgba(21,102,192,0.05)]">
        <button
          type="button"
          onClick={() => setActiveTab('worklist')}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'worklist'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC]'
          }`}
        >
          <Database className="w-4 h-4" />
          Worklist DICOM
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex h-10 items-center gap-2 rounded-lg px-3.5 text-[11px] font-medium transition ${
            activeTab === 'upload'
              ? 'bg-[#E6F0FB] text-[#1566C0] shadow-sm'
              : 'text-[#54687A] hover:bg-[#F3F8FC]'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload DICOM
        </button>
      </div>

      {/* TAB: WORKLIST */}
      {activeTab === 'worklist' && (
        <div className="app-panel overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-[12px] text-[#71869A]">
              <span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-[#DCE6EF] border-t-[#1566C0]" />
              Chargement de la worklist…
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-400" />
              <p className="text-[13px] text-rose-700">{error}</p>
            </div>
          ) : worklist.length === 0 ? (
            <div className="p-14 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
              <p className="text-[13px] font-semibold text-[#0F2233]">Worklist vide</p>
              <p className="mt-1 text-[11px] text-[#71869A]">Aucun examen planifié en attente d'acquisition.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="app-data-table min-w-full border-collapse text-[12px]">
                <thead className="bg-[#EEF4FA] text-left text-[11px] font-medium text-[#54687A]">
                  <tr className="h-10">
                    <th className="px-4">Accession</th>
                    <th className="px-4">Patient (ID / Nom)</th>
                    <th className="px-4">Modalité</th>
                    <th className="px-4">Procédure</th>
                    <th className="px-4">Date prévue</th>
                    <th className="px-4">Priorité</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {worklist.map((item) => (
                    <tr key={item.AccessionNumber} className="h-12 border-t border-[#DCE6EF] hover:bg-[#F3F8FC]">
                      <td className="whitespace-nowrap px-4 font-mono text-[11px] font-medium text-[#54687A]">
                        {item.AccessionNumber}
                      </td>
                      <td className="px-4">
                        <div className="text-[12px] font-medium text-[#0F2233]">{item.PatientName?.replace('^', ' ')}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-[#71869A]">{item.PatientID}</div>
                      </td>
                      <td className="px-4">
                        <span className="rounded-md bg-[#E6F0FB] px-2 py-1 font-mono text-[10px] font-medium text-[#1566C0]">
                          {item.Modality}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-4 text-[11px] text-[#54687A]">
                        {item.ScheduledProcedureStepDescription}
                      </td>
                      <td className="whitespace-nowrap px-4 text-[11px] text-[#54687A]">
                        {item.ScheduledProcedureStepStartDate} {item.ScheduledProcedureStepStartTime}
                      </td>
                      <td className="px-4">
                        <PriorityBadge priority={item.Priority} />
                      </td>
                      <td className="whitespace-nowrap px-4 text-right">
                        <Link
                          to={`/exams/${item.ExamID}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCE6EF] px-2.5 text-[10px] font-medium text-[#54687A] hover:bg-[#F3F8FC] hover:text-[#1566C0]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Détails
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: UPLOAD */}
      {activeTab === 'upload' && (
        <div className="app-panel p-6">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F0FB] text-[#1566C0]">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="text-[14px] font-semibold text-[#0F2233]">
              Envoyer des images DICOM vers le PACS
            </h3>
            <p className="mt-1 text-[11px] text-[#54687A]">
              Sélectionnez un ou plusieurs fichiers DICOM (.dcm) à archiver dans Orthanc.
              Les images seront automatiquement indexées et associées selon leurs tags DICOM.
            </p>

            <label className="mt-5 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#B8D3EC] bg-[#F3F8FC] p-8 transition hover:border-[#1566C0] hover:bg-[#E6F0FB]">
              <Image className="h-8 w-8 text-[#71869A]" />
              <span className="text-[12px] font-medium text-[#54687A]">
                {uploading ? 'Upload en cours…' : 'Cliquez ou glissez vos fichiers DICOM ici'}
              </span>
              <input
                type="file"
                accept=".dcm,application/dicom"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {uploadResult && (
              <div className="mt-4 rounded-lg border border-[#DCE6EF] bg-white p-3 text-[11px] text-[#54687A]">
                ✅ {uploadResult.uploaded} fichier(s) uploadé(s)
                {uploadResult.failed > 0 && <span className="text-rose-600"> · ❌ {uploadResult.failed} échec(s)</span>}
              </div>
            )}

            <div className="mt-5 rounded-lg border border-[#DCE6EF] bg-[#EEF4FA] p-3 text-left text-[11px] text-[#54687A]">
              <strong className="text-[#0F2233]">💡 Conseil :</strong> Avant l'upload, utilisez le script{' '}
              <code className="rounded bg-white px-1 font-mono text-[#1566C0]">scripts/tag_dicom.py</code>{' '}
              pour aligner les tags PatientID et AccessionNumber avec les données du Module 1.
            </div>

            <div className="mt-3">
              <a
                href="http://localhost:8042"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#1566C0] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir l'interface web Orthanc
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

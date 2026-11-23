import React, { useState } from 'react';
import { Image, ExternalLink, RefreshCw, Maximize2, Minimize2, AlertCircle } from 'lucide-react';

export default function DicomViewer({ studyInstanceUID = null, title = null, height = '75vh', onClose = null }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // URL OHIF : si un StudyInstanceUID est fourni, ouvrir l'étude ciblée, sinon ouvrir la liste générale
  const ohifUrl = studyInstanceUID
    ? `http://localhost:3001/viewer?StudyInstanceUIDs=${studyInstanceUID}`
    : `http://localhost:3001`;

  const refreshIframe = () => setIframeKey((prev) => prev + 1);

  return (
    <div className={`space-y-2.5 transition-all duration-200 ${
      isFullscreen ? 'fixed inset-0 z-50 flex flex-col bg-slate-950 p-3' : ''
    }`}>
      {/* Barre d'en-tête du viewer */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#B8D3EC] bg-[#E6F0FB] px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2.5 text-[12px] text-[#54687A]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1566C0] text-white">
            <Image className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-[#0F2233]">
              {title || 'Visualiseur DICOM médical (OHIF Viewer)'}
            </span>
            {studyInstanceUID ? (
              <span className="ml-2 font-mono text-[10px] text-[#1566C0] bg-white px-2 py-0.5 rounded border border-[#B8D3EC]">
                UID : {studyInstanceUID}
              </span>
            ) : (
              <span className="ml-2 text-[11px] text-[#54687A]">
                — Navigateur d'études PACS
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshIframe}
            title="Recharger le visualiseur"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE6EF] bg-white text-[#54687A] transition hover:bg-[#F3F8FC] hover:text-[#1566C0]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Réduire" : "Plein écran"}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DCE6EF] bg-white px-2.5 text-[11px] font-medium text-[#54687A] transition hover:bg-[#F3F8FC] hover:text-[#1566C0]"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{isFullscreen ? "Quitter plein écran" : "Plein écran"}</span>
          </button>

          <a
            href={ohifUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1566C0] px-3 text-[11px] font-medium text-white transition hover:bg-[#0F4C81]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Nouvel onglet</span>
          </a>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Conteneur iframe OHIF */}
      <div className={`overflow-hidden rounded-xl border border-slate-800 bg-black shadow-lg ${
        isFullscreen ? 'flex-1' : ''
      }`}>
        <iframe
          key={iframeKey}
          src={ohifUrl}
          title="OHIF DICOM Medical Viewer"
          className="h-full w-full border-0"
          style={{ height: isFullscreen ? 'calc(100vh - 70px)' : height, minHeight: '520px' }}
          allow="fullscreen; cross-origin-isolated"
        />
      </div>
    </div>
  );
}

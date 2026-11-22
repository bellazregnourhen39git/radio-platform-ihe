import React from 'react';
import { Image, ExternalLink, AlertCircle } from 'lucide-react';

export default function DicomViewer({ studyInstanceUID }) {
  if (!studyInstanceUID) {
    return (
      <div className="rounded-xl border border-[#DCE6EF] bg-[#EEF4FA] p-8 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-[14px] font-semibold text-[#0F2233]">
          Aucune image DICOM disponible
        </h3>
        <p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-[#54687A]">
          L'acquisition n'a pas encore été réalisée ou les images n'ont pas encore
          été transférées depuis la modalité vers le PACS Orthanc.
        </p>
      </div>
    );
  }

  const ohifUrl = `http://localhost:3001/viewer?StudyInstanceUIDs=${studyInstanceUID}`;

  return (
    <div className="space-y-3">
      {/* Barre d'info */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#B8D3EC] bg-[#E6F0FB] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-[#54687A]">
          <Image className="h-4 w-4 text-[#1566C0]" />
          <span>
            <strong className="text-[#0F2233]">OHIF DICOM Viewer</strong> — StudyInstanceUID :
            <code className="ml-1 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#1566C0]">
              {studyInstanceUID}
            </code>
          </span>
        </div>
        <a
          href={ohifUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1566C0] hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir en plein écran
        </a>
      </div>

      {/* Iframe du viewer */}
      <div className="overflow-hidden rounded-xl border border-[#DCE6EF] shadow-sm">
        <iframe
          src={ohifUrl}
          title="OHIF DICOM Viewer"
          className="w-full border-0 bg-black"
          style={{ height: '70vh', minHeight: '500px' }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}

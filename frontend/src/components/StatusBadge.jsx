import React from 'react';

const statusConfig = {
  DEMANDE: {
    label: 'Demandé',
    bg: 'bg-[var(--status-demande-bg)] text-[var(--status-demande-text)]',
    dot: 'bg-[var(--status-demande-dot)]'
  },
  PLANIFIE: {
    label: 'Planifié',
    bg: 'bg-[var(--status-planifie-bg)] text-[var(--status-planifie-text)]',
    dot: 'bg-[var(--status-planifie-dot)]'
  },
  REALISE: {
    label: 'Réalisé',
    bg: 'bg-[var(--status-realise-bg)] text-[var(--status-realise-text)]',
    dot: 'bg-[var(--status-realise-dot)]'
  },
  TERMINE: {
    label: 'Terminé',
    bg: 'bg-[var(--status-termine-bg)] text-[var(--status-termine-text)]',
    dot: 'bg-[var(--status-termine-dot)]'
  },
  ANNULE: {
    label: 'Annulé',
    bg: 'bg-[var(--status-annule-bg)] text-[var(--status-annule-text)]',
    dot: 'bg-[var(--status-annule-dot)]'
  }
};

export default function StatusBadge({ status }) {
  const conf = statusConfig[status] || {
    label: status,
    bg: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5 text-xs font-medium ${conf.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
      {conf.label}
    </span>
  );
}

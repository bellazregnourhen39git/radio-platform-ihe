import React from 'react';

const priorityConfig = {
  ROUTINE: {
    label: 'Routine',
    bg: 'bg-[var(--priority-routine-bg)] text-[var(--priority-routine-text)]'
  },
  URGENT: {
    label: 'Urgent',
    bg: 'bg-[var(--priority-urgent-bg)] text-[var(--priority-urgent-text)]'
  },
  TRES_URGENT: {
    label: 'Très urgent',
    bg: 'bg-[var(--priority-vital-bg)] text-[var(--priority-vital-text)] font-medium'
  }
};

export default function PriorityBadge({ priority }) {
  const conf = priorityConfig[priority] || {
    label: priority,
    bg: 'bg-slate-100 text-slate-700'
  };

  return (
    <span className={`inline-block rounded-[6px] px-2 py-0.5 text-xs ${conf.bg}`}>
      {conf.label}
    </span>
  );
}

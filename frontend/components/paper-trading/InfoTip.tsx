'use client';

import { useId, useState } from 'react';

/**
 * Petite infobulle accessible (hover souris + focus clavier), thème DeFi cyan.
 * Rendue en position absolue au-dessus du déclencheur « ⓘ ».
 */
export function InfoTip({ label, className = '' }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="Aide"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted/50 text-[9px] font-semibold leading-none text-muted transition hover:border-info hover:text-info focus:outline-none focus:ring-2 focus:ring-info/50"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-border bg-elevated px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-white shadow-xl"
        >
          {label}
        </span>
      )}
    </span>
  );
}

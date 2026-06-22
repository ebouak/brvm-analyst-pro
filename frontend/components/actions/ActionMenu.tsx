'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

/** Menu « Plus d'actions » regroupant les actions secondaires de la fiche. */
export default function ActionMenu({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const items: { href: string; label: string }[] = [
    { href: '/portefeuille', label: '★ Watchlist' },
    { href: '/portefeuille', label: '🔔 Alertes' },
    { href: `/backtest?code=${code}`, label: '◈ Backtester' },
    { href: `/forum?code=${code}`, label: '💬 Discuter de cette valeur' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        className="inline-flex items-center gap-1 text-[11px] border border-border rounded-full px-3 py-1 text-muted hover:border-gold/40 hover:text-gold transition"
      >
        Plus d&apos;actions <span className={`text-[8px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-elevated shadow-modal"
        >
          {items.map((it) => (
            <Link
              key={it.label}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-xs text-muted hover:bg-white/[0.04] hover:text-white transition"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

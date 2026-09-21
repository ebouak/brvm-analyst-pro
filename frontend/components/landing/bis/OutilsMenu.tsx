'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Menu « Outils » de la barre de navigation : un bouton, une liste déroulante.
 * Chaque entrée pointe vers une route qui existe (vérifié). Accessible :
 * aria-expanded / aria-controls, fermeture à Échap et au clic extérieur,
 * flèches ↑/↓ entre les entrées, focus rendu au bouton à la fermeture.
 */
const OUTILS = [
  { t: 'SGI', d: 'Choisir sa SGI', href: '/comparateur-sgi' },
  { t: 'Simulateur', d: 'Et si vous aviez investi ?', href: '/simulateur' },
  { t: 'Simulateur budget', d: 'Construire un plan d’épargne', href: '/simulateur-budget' },
  { t: 'Paper trading', d: 'Capital virtuel, conditions réelles', href: '/premium/paper-trading' },
  { t: 'Backtesting', d: 'Rejouer une stratégie sur l’historique', href: '/backtest' },
  { t: 'Diagnostic IA', d: 'Un rapport par société, à partir des chiffres', href: '/premium/diagnostic' },
] as const;

export function OutilsMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(root.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLAnchorElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="outils" ref={root}>
      <button ref={btn} type="button" className="outils-btn" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        Outils <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div id={id} role="menu" aria-label="Outils" className="outils-menu">
          {OUTILS.map((o) => (
            <Link key={o.href} href={o.href} role="menuitem" className="outils-item" onClick={() => setOpen(false)}>
              <b>{o.t}</b><small>{o.d}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

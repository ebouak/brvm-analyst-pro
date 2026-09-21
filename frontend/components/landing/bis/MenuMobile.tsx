'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Menu des pages publiques sous 1 000 px : les cinq liens de la barre et les
 * six outils, dans un panneau dépliant — pas le tiroir de l'app
 * (components/MobileNav), dont les liens sont pour la plupart derrière le
 * login. Même mécanique que OutilsMenu : aria-expanded, Échap, clic
 * extérieur, focus rendu au bouton. Le CTA « Créer mon compte gratuit »
 * reste hors du menu, toujours visible dans la barre.
 */
const LIENS = [
  { t: 'Marchés', href: '/#marche' },
  { t: 'Sociétés', href: '/societes' },
  { t: 'Analyses', href: '/analyses' },
  { t: 'Formations', href: '/formations' },
  { t: 'À propos', href: '/methodologie' },
  { t: 'Se connecter', href: '/login' },
];
const OUTILS = [
  { t: 'Choisir sa SGI', href: '/comparateur-sgi' },
  { t: 'Simulateur', href: '/simulateur' },
  { t: 'Simulateur budget', href: '/simulateur-budget' },
  { t: 'Paper trading', href: '/premium/paper-trading' },
  { t: 'Backtesting', href: '/backtest' },
  { t: 'Diagnostic IA', href: '/premium/diagnostic' },
];

export function MenuMobile() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="mnav" ref={root}>
      <button ref={btn} type="button" className="mnav-btn" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setOpen((o) => !o)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
      </button>
      {open && (
        <nav id={id} className="mnav-panel" aria-label="Menu">
          {LIENS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.t}</Link>)}
          <p className="grp">Outils</p>
          {OUTILS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.t}</Link>)}
        </nav>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';

/**
 * Menu de navigation de la landing sous 1024 px.
 *
 * Il n'en existait AUCUN : les liens Sociétés / SGI / Simulateur / Brief sont
 * en `hidden lg:inline-flex`, et Connexion + bascule de thème en
 * `hidden sm:inline-flex`. Résultat mesuré sur les captures : à 834 px le
 * header ne proposait plus une seule destination produit, et à 390 px il ne
 * restait que le logo et un bouton. Un visiteur mobile — le premier contact
 * en Afrique de l'Ouest — ne pouvait ni se connecter ni explorer le site.
 *
 * Chaque `href` pointe vers une route vérifiée existante.
 */

const LIENS = [
  { href: '/societes', label: 'Sociétés' },
  { href: '/notations', label: 'Notes A–F' },
  { href: '/screener', label: 'Screener' },
  { href: '/signaux', label: 'Signaux' },
  { href: '/obligations', label: 'Obligations' },
  { href: '/comparateur-sgi', label: 'Comparateur SGI' },
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/brief', label: 'Brief quotidien' },
  { href: '/actualites', label: 'Actualités' },
  { href: '/premium/diagnostic', label: 'Diagnostic IA' },
  { href: '/pricing', label: 'Tarifs' },
];

export function TasteMobileNav() {
  const [ouvert, setOuvert] = useState(false);

  // Fermeture à l'Échap et blocage du défilement de fond : sans ça, le tiroir
  // ouvert laisse la page défiler derrière lui.
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [ouvert]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={ouvert}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-ivory transition-colors hover:border-accent/40 lg:hidden"
      >
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M3 6h14M3 10h14M3 14h14" />
        </svg>
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <nav
            aria-label="Navigation principale"
            className="absolute right-0 top-0 flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto border-l border-border bg-surface p-5 shadow-modal"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="overline text-gold-2">Menu</span>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-ivory transition-colors hover:border-accent/40"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <ul className="flex-1 space-y-0.5">
              {LIENS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOuvert(false)}
                    className="flex min-h-[44px] items-center rounded-lg px-3 text-[15px] text-ivory transition-colors hover:bg-elevated/70"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-2 border-t border-border pt-5">
              <Link
                href="/signup"
                onClick={() => setOuvert(false)}
                className="landing-hero-cta flex min-h-[48px] items-center justify-center rounded-full text-sm font-bold text-[#03222b] shadow-gold"
              >
                Créer mon compte gratuit
              </Link>
              <Link
                href="/login"
                onClick={() => setOuvert(false)}
                className="flex min-h-[48px] items-center justify-center rounded-full border border-border text-sm font-medium text-ivory transition-colors hover:border-accent/40"
              >
                Connexion
              </Link>
              <div className="flex justify-center pt-1">
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { estEnSeance } from '@/lib/freshness';

const cleDuJour = () => `ws-ouverture-vue-${new Date().toISOString().slice(0, 10)}`;
const dejaVu = () => {
  try { return localStorage.getItem(cleDuJour()) === '1'; } catch { return false; }
};
const marquerVu = () => {
  try { localStorage.setItem(cleDuJour(), '1'); } catch { /* stockage refusé : tant pis */ }
};

/**
 * « La séance est ouverte » : une fois par jour, à la première visite pendant
 * la séance, ou au moment même de l'ouverture si la page est déjà ouverte.
 * Rien hors séance. Le souvenir « déjà vu » est une commodité locale au
 * navigateur (localStorage), sans donnée personnelle.
 */
export default function BandeauOuverture() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let avant = estEnSeance(new Date());
    if (avant && !dejaVu()) { setVisible(true); marquerVu(); }
    const t = setInterval(() => {
      const maintenant = estEnSeance(new Date());
      if (maintenant && !avant && !dejaVu()) { setVisible(true); marquerVu(); }
      if (!maintenant) setVisible(false);
      avant = maintenant;
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!visible) return null;
  return (
    <div role="status" className="bandeau-ouverture relative mb-4 overflow-hidden rounded-xl border border-up/30 bg-up/[0.06] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ivory">La séance est ouverte</p>
          <p className="mt-0.5 text-xs text-muted">
            Les cours se mettent à jour à chaque relevé de la collecte, toutes les 15 minutes, jusqu’à la clôture.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Fermer l’annonce d’ouverture"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <span aria-hidden className="bandeau-trait absolute inset-x-0 bottom-0 h-0.5 bg-up" />
    </div>
  );
}

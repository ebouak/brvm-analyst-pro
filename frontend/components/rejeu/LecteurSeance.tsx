'use client';

import { History, Pause, Play, X } from 'lucide-react';
import { fmtDateCourte } from '@/lib/format';
import { useRejeu } from './RejeuProvider';

const heure = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/**
 * Commandes du rejeu de séance. Toujours étiqueté « rejeu » pendant la
 * lecture : rien ne doit laisser croire qu'il s'agit du direct.
 */
export function LecteurSeance({ className = '' }: { className?: string }) {
  const r = useRejeu();
  if (!r || !r.dateMarche) return null;
  const jour = fmtDateCourte(r.dateMarche);

  if (!r.actif || !r.image) {
    const charge = r.statut === 'chargement';
    return (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
        <button
          type="button"
          onClick={r.demarrer}
          disabled={charge}
          aria-busy={charge}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-accent-ink transition-colors hover:border-accent hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          <History size={14} strokeWidth={1.75} aria-hidden />
          {charge ? 'Chargement des relevés…' : `Rejouer la séance du ${jour}`}
        </button>
        <span className="text-xs text-faint">Les vrais relevés de la journée, en une vingtaine de secondes.</span>
        {r.statut === 'erreur' && r.erreur && <span role="alert" className="text-xs text-down">{r.erreur}</span>}
      </div>
    );
  }

  const fin = r.index >= r.images.length - 1;
  return (
    <div
      role="region"
      aria-label={`Rejeu de la séance du ${jour}`}
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/[0.06] px-3 py-2.5 ${className}`}
    >
      <button
        type="button"
        onClick={r.lecture ? r.pause : r.reprendre}
        aria-label={r.lecture ? 'Mettre le rejeu en pause' : fin ? 'Rejouer depuis le début' : 'Reprendre le rejeu'}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-bg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {r.lecture ? <Pause size={16} strokeWidth={2} aria-hidden /> : <Play size={16} strokeWidth={2} aria-hidden />}
      </button>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="text-ivory">Rejeu de la séance du {jour} <span className="text-muted">· relevés réels, pas le direct</span></span>
          <span className="tabular text-muted">
            {heure(r.image.t)} UTC · relevé {r.index + 1} / {r.images.length}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={r.images.length - 1}
          step={1}
          value={r.index}
          onChange={(e) => r.aller(Number(e.target.value))}
          aria-label="Moment de la séance"
          aria-valuetext={`${heure(r.image.t)} UTC`}
          className="mt-1.5 w-full accent-accent"
        />
      </div>
      <button
        type="button"
        onClick={r.quitter}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X size={14} strokeWidth={1.75} aria-hidden /> Quitter le rejeu
      </button>
      <p className="sr-only" aria-live="polite">{fin && !r.lecture ? 'Rejeu terminé.' : ''}</p>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import { scoreToRating } from '@/lib/rating';

export interface WelcomeAction {
  code: string;
  designation: string;
  secteur: string | null;
  cours: number | null;
  variation: number | null;
  scoreTotal: number | null;
  confiance: number | null;
}

const nf = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

/**
 * Sélecteur d'accueil : l'utilisateur cherche/choisit une action et voit
 * instantanément notre note A–F + son dernier cours réel. Aucun appel réseau
 * au clic (tout est pré-chargé) → effet « instantané ». Données réelles.
 */
export default function BienvenuePicker({ actions }: { actions: WelcomeAction[] }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<WelcomeAction | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions.slice(0, 8);
    return actions
      .filter((a) => a.designation.toLowerCase().includes(needle) || a.code.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, actions]);

  if (actions.length === 0) {
    return (
      <div className="rounded-panel border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Les cours ne sont pas encore disponibles. Rendez-vous sur votre tableau de bord.</p>
        <Link href="/dashboard" className="mt-4 inline-flex rounded-full border border-accent/40 px-5 py-2 text-sm font-semibold text-accent">
          Aller au tableau de bord →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recherche + suggestions */}
      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une société (ex. Sonatel, SNTS)…"
          aria-label="Rechercher une société"
          className="w-full rounded-xl border border-border bg-bg/40 px-4 py-3 text-sm text-ivory placeholder:text-faint focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {filtered.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => setSelected(a)}
              aria-pressed={selected?.code === a.code ? 'true' : 'false'}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                selected?.code === a.code
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:text-ivory'
              }`}
            >
              {a.designation}
            </button>
          ))}
          {filtered.length === 0 && <span className="text-xs text-faint">Aucune société ne correspond.</span>}
        </div>
      </div>

      {/* Carte résultat instantanée */}
      {selected ? (
        <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.06] to-transparent p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl text-ivory">{selected.designation}</p>
              <p className="mt-1 text-xs text-muted">
                {selected.code}
                {selected.secteur ? ` · ${selected.secteur}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <RatingBadge scoreTotal={selected.scoreTotal} confiance={selected.confiance} size="lg" showLabel />
              <span className="text-[11px] text-faint">Note WESTBOURSE</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-4 border-t border-white/10 pt-4">
            <div>
              <p className="text-[11px] text-muted">Dernier cours</p>
              <p className="tabular font-display text-2xl text-ivory">
                {selected.cours != null ? `${nf(selected.cours)} FCFA` : '—'}
              </p>
            </div>
            {selected.variation != null && (
              <p className={`tabular text-lg font-bold ${selected.variation >= 0 ? 'text-up' : 'text-down'}`}>
                {selected.variation >= 0 ? '+' : ''}{selected.variation.toFixed(2)} %
              </p>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            {scoreToRating(selected.scoreTotal, selected.confiance).note === 'NR'
              ? 'Titre non noté pour cette séance (données insuffisantes) — la fiche détaille pourquoi.'
              : 'Note dérivée de signaux quantitatifs explicables — jamais d’opinion inventée.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/societes/${selected.code}`}
              className="landing-hero-cta inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
            >
              Voir la fiche complète <span aria-hidden>→</span>
            </Link>
            <Link
              href={`/simulateur/${selected.code}`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-up/40 px-5 text-sm font-semibold text-up transition-colors hover:bg-up/10"
            >
              Simuler un investissement
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-faint">
          Choisissez une société ci-dessus pour voir sa note et son cours.
        </div>
      )}

      <div className="pt-2 text-center">
        <Link href="/dashboard" className="text-sm font-medium text-muted transition-colors hover:text-ivory">
          Passer et aller au tableau de bord →
        </Link>
      </div>
    </div>
  );
}

// frontend/components/landing/HeroDeviceMockup.tsx
import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import type { TickItem } from '@/components/landing/taste/types';

interface TopMover {
  code: string;
  score: number | null;
  confiance: number | null;
}

interface Props {
  dateLabel: string | null;
  ticks: TickItem[];
  brvmC: number | null;
  topMover: TopMover | null;
}

/**
 * Traitement Hero cible (Phase 10-13), en production depuis Phase 13,
 * remplace HeroSpotlight : le produit réel comme visuel principal plutôt
 * qu'une photo — un cadre d'appareil affichant BRVM-C, les cotations
 * réelles déjà calculées par getData()/getPreviewData(), aucune nouvelle
 * donnée.
 */
export function HeroDeviceMockup({ dateLabel, ticks, brvmC, topMover }: Props) {
  const top = ticks.slice(0, 4);
  return (
    <section className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="overline mb-3 text-gold-2">La plateforme de référence BRVM</p>
        <h1 className="font-display text-display-lg text-ivory">
          Décidez sur la BRVM avec des <span className="text-accent">données</span>, pas des rumeurs.
        </h1>
        <p className="mt-5 max-w-[52ch] text-base leading-[1.75] text-muted">
          Cours, fondamentaux, dividendes, valorisation, signaux quantitatifs et analyse IA réunis dans
          une seule plateforme dédiée à la BRVM.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="landing-hero-cta inline-flex min-h-[50px] items-center gap-1.5 rounded-full px-7 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
          >
            Créer mon compte gratuit <span aria-hidden>→</span>
          </Link>
          <Link
            href="/societes"
            className="inline-flex min-h-[50px] items-center rounded-full border border-white/15 px-6 text-sm font-medium text-ivory transition-colors hover:border-accent/40"
          >
            Explorer la BRVM
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-faint">Aucune carte bancaire · Compte en 1 minute · Sans engagement</p>
      </div>

      <div className="rounded-panel border border-white/10 bg-surface p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <p className="overline text-gold-2">BRVM-C</p>
          {dateLabel && <span className="text-[10px] text-faint">Séance du {dateLabel}</span>}
        </div>
        <p className="tabular font-display text-4xl text-ivory">{brvmC != null ? brvmC.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-4">
          {top.length > 0 ? (
            top.map((t) => (
              <div key={t.sym} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2">
                <span className="font-mono text-xs font-bold text-ivory">{t.sym}</span>
                <span className={`tabular text-xs font-bold ${t.dir === 'up' ? 'text-up' : 'text-down'}`}>{t.pct}</span>
              </div>
            ))
          ) : (
            <p className="col-span-2 py-4 text-center text-xs text-faint">Données de séance indisponibles.</p>
          )}
        </div>

        {topMover && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-accent/20 bg-accent/[0.05] px-3 py-2.5">
            <span className="font-mono text-[11px] font-bold text-muted">{topMover.code}</span>
            <RatingBadge scoreTotal={topMover.score} confiance={topMover.confiance} />
          </div>
        )}
      </div>
    </section>
  );
}

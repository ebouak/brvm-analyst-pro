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
 * Hero de la landing : le produit réel comme visuel principal (cadre
 * d'appareil affichant BRVM-C, les cotations du jour et une note réelle)
 * plutôt qu'une photo d'illustration.
 *
 * ⚠️ Couleurs de texte et de fond VOLONTAIREMENT FIXES (pas de tokens de
 * thème) dans toute cette section : le hero reste sombre quel que soit le
 * thème du site — c'est le contraste voulu par la charte, et un texte piloté
 * par token deviendrait illisible en mode clair (ivory clair → quasi noir sur
 * un fond qui, lui, ne change jamais). Même parti pris que le Footer et que
 * l'ancien HeroSpotlight qu'il remplace.
 */
export function HeroDeviceMockup({ dateLabel, ticks, brvmC, topMover }: Props) {
  const top = ticks.slice(0, 4);

  return (
    <section className="relative mt-6 overflow-hidden rounded-panel border border-[rgba(255,255,255,0.08)] bg-[#04070d]">
      {/* Halo cyan discret depuis le haut-gauche + grille financière ténue. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(70% 70% at 8% 0%, rgba(86,215,253,.13), transparent 62%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(86,215,253,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(86,215,253,.05) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />

      <div className="relative grid grid-cols-1 items-center gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
        <div>
          <span className="landing-hero-badge inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#8fe6ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3fe18b] animate-pulse" />
            La plateforme de référence BRVM
          </span>

          <h1 className="mt-4 font-display text-[clamp(30px,4.6vw,44px)] font-medium leading-[1.05] tracking-[-0.035em] text-[#fcfcfc]">
            Décidez sur la BRVM avec des <span className="text-[#56d7fd]">données</span>, pas des rumeurs.
          </h1>

          <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.7] text-[#b5b5b5]">
            Cours, fondamentaux, dividendes, valorisation, signaux quantitatifs et analyse IA réunis dans
            une seule plateforme dédiée à la BRVM.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="landing-hero-cta inline-flex min-h-[50px] items-center gap-1.5 rounded-full px-7 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56d7fd]/60"
            >
              Créer mon compte gratuit <span aria-hidden>→</span>
            </Link>
            <Link
              href="/societes"
              className="inline-flex min-h-[50px] items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.16)] px-6 text-sm font-medium text-[#fcfcfc] transition-colors hover:border-[#56d7fd]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56d7fd]/60"
            >
              Explorer la BRVM <span aria-hidden>→</span>
            </Link>
          </div>

          <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#7d8a90]">
            <li className="flex items-center gap-1.5"><Check /> Aucune carte bancaire</li>
            <li className="flex items-center gap-1.5"><Check /> Compte en 1 minute</li>
            <li className="flex items-center gap-1.5"><Check /> Sans engagement</li>
          </ul>
        </div>

        {/* Cadre « produit » — mêmes données que la page, présentées comme
            l'utilisateur les verra une fois connecté. */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-[2px] sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#8fe6ff]">BRVM-C</p>
            {dateLabel && <span className="text-[10px] text-[#7d8a90]">Séance du {dateLabel}</span>}
          </div>

          <p className="tabular font-display text-[clamp(30px,4vw,40px)] leading-none text-[#fcfcfc]">
            {brvmC != null ? brvmC.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}
          </p>

          <div className="mt-5 border-t border-[rgba(255,255,255,0.07)] pt-4">
            <p className="mb-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#7d8a90]">
              Top variations
            </p>
            {top.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {top.map((t) => (
                  <div
                    key={t.sym}
                    className="flex items-center justify-between rounded-lg bg-[rgba(255,255,255,0.04)] px-2.5 py-2"
                  >
                    <span className="font-mono text-xs font-bold text-[#fcfcfc]">{t.sym}</span>
                    <span
                      className={`tabular text-xs font-bold ${t.dir === 'up' ? 'text-[#3fe18b]' : 'text-[#ff6b6b]'}`}
                    >
                      {t.pct}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-[#7d8a90]">Données de séance indisponibles.</p>
            )}
          </div>

          {topMover && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-[rgba(86,215,253,0.22)] bg-[rgba(86,215,253,0.06)] px-3 py-2.5">
              <span className="font-mono text-[11px] font-bold text-[#b5b5b5]">{topMover.code}</span>
              <RatingBadge scoreTotal={topMover.score} confiance={topMover.confiance} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#3fe18b" strokeWidth="2" aria-hidden>
      <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

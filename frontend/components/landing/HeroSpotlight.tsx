import Link from 'next/link';
import Image from 'next/image';
import { HeroPulseCTA } from '@/components/landing/HeroPulseCTA';
import type { TickItem } from '@/components/landing/taste/types';

/**
 * Hero « photo immersive » — investisseur africain, courbe de bourse cyan,
 * cotations flottantes, carte d'Afrique en bout d'image avec le logo officiel
 * BRVM qui clignote sur la zone Côte d'Ivoire. Charte « DeFi cyan » respectée.
 * Composant serveur (animations CSS uniquement). Pas de logo WESTBOURSE ici.
 */
export function HeroSpotlight({ dateLabel, ticks }: { dateLabel: string | null; ticks: TickItem[] }) {
  // 4 cotations flottantes positionnées sur la photo (données réelles si dispo).
  const slots = ['top-[14%] right-[30%]', 'top-[30%] right-[20%]', 'top-[52%] right-[34%]', 'top-[68%] right-[23%]'];
  const floats = ticks.slice(0, 4);

  return (
    <section className="relative mt-6 h-[clamp(420px,56vw,480px)] overflow-hidden rounded-panel border border-white/10">
      {/* Photo + voiles — élément LCP : next/image optimisé (AVIF/WebP), preload
          via priority, dimensionné selon le viewport. */}
      <Image
        src="/landing/hero-investisseur.jpg"
        alt=""
        aria-hidden
        fill
        priority
        quality={70}
        sizes="100vw"
        className="object-cover object-[30%_30%] [filter:saturate(.92)_brightness(.55)_contrast(1.04)]"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(98deg,#030303 2%,#030303E6 32%,#03030399 58%,#03030366 100%)' }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(55% 60% at 14% 8%,rgba(86,215,253,.16),transparent 60%)' }}
        aria-hidden
      />

      {/* Courbe de bourse cyan + grille */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1100 420" preserveAspectRatio="none" aria-hidden>
        <line x1="0" y1="105" x2="1100" y2="105" stroke="rgba(86,215,253,.07)" strokeWidth="1" />
        <line x1="0" y1="210" x2="1100" y2="210" stroke="rgba(86,215,253,.07)" strokeWidth="1" />
        <line x1="0" y1="315" x2="1100" y2="315" stroke="rgba(86,215,253,.07)" strokeWidth="1" />
        <defs>
          <linearGradient id="hs-cv" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2a8aa8" stopOpacity="0" />
            <stop offset=".4" stopColor="#56d7fd" />
            <stop offset="1" stopColor="#8fe6ff" />
          </linearGradient>
          <linearGradient id="hs-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#56d7fd" stopOpacity=".22" />
            <stop offset="1" stopColor="#56d7fd" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M380,300 L460,270 L520,288 L600,230 L660,250 L740,180 L820,205 L900,120 L980,150 L1060,70 L1060,420 L380,420 Z" fill="url(#hs-fill)" />
        <path
          d="M380,300 L460,270 L520,288 L600,230 L660,250 L740,180 L820,205 L900,120 L980,150 L1060,70"
          fill="none"
          stroke="url(#hs-cv)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="1060" cy="70" r="4" fill="#8fe6ff" />
      </svg>

      {/* Cotations flottantes (réelles) */}
      {floats.map((t, i) => (
        <div key={t.sym} className={`pointer-events-none absolute hidden font-mono text-[11px] font-medium opacity-90 sm:block ${slots[i]}`}>
          <span className="text-ivory">{t.sym}</span>{' '}
          <span className={t.dir === 'up' ? 'text-up' : 'text-down'}>
            {t.val} {t.dir === 'up' ? '▲' : '▼'}
          </span>
        </div>
      ))}

      {/* Carte d'Afrique + logo BRVM clignotant sur la Côte d'Ivoire */}
      <div className="pointer-events-none absolute right-[-26px] top-1/2 hidden h-[360px] w-[300px] -translate-y-1/2 opacity-90 md:block">
        <svg viewBox="0 0 300 360" className="h-full w-full [filter:drop-shadow(0_0_22px_rgba(86,215,253,.35))]" aria-hidden>
          <path
            d="M78,46 C96,32 158,30 206,36 C218,46 212,66 228,86 C252,106 264,124 254,134 C242,146 224,140 220,156 C216,182 226,206 216,242 C206,282 186,312 168,336 C158,344 150,334 150,302 C150,266 140,236 128,214 C114,206 94,206 70,192 C44,176 30,160 38,140 C44,118 60,112 58,94 C57,72 64,56 78,46 Z"
            fill="rgba(86,215,253,.10)"
            stroke="#56d7fd"
            strokeWidth="1.6"
          />
          <ellipse cx="240" cy="280" rx="9" ry="26" transform="rotate(18 240 280)" fill="rgba(86,215,253,.10)" stroke="#56d7fd" strokeWidth="1.6" />
        </svg>
        <span className="absolute left-[20%] top-[49%] -translate-x-1/2 -translate-y-1/2">
          <img src="/brand/brvm-logo.png" alt="BRVM" className="brvm-blink block w-[62px] rounded-[7px] bg-white px-[5px] py-1" />
        </span>
      </div>

      {/* Contenu */}
      <div className="absolute inset-0 z-[3] flex max-w-[58%] flex-col justify-center p-6 sm:p-9">
        <span className="landing-hero-badge inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-gold-2">
          <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse" />
          {dateLabel ? `Séance du ${dateLabel}` : 'Bourse Régionale des Valeurs Mobilières'}
        </span>

        <h1 className="my-4 font-display text-[clamp(26px,4.4vw,34px)] font-medium leading-[1.02] tracking-[-0.035em] text-ivory">
          Décidez sur la BRVM avec des <span className="text-gold-shimmer">données</span>, pas des rumeurs.
        </h1>

        <p className="mb-2 font-display text-[clamp(15px,2.4vw,17px)] font-semibold leading-[1.3] tracking-[-0.01em] text-ivory">
          La seule plateforme qui <span className="text-accent">note chaque action BRVM</span> chaque jour.
        </p>
        <p className="mb-5 max-w-[42ch] text-[13px] leading-[1.6] text-muted">
          Données officielles. Zéro opinion inventée — tout est dérivé des chiffres.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <HeroPulseCTA />
          <Link
            href="/societes"
            className="inline-flex min-h-[44px] items-center px-2 text-[13px] font-medium text-muted underline-offset-4 transition-colors hover:text-ivory hover:underline"
          >
            Explorer sans compte →
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-faint">
          ✓ Aucune carte bancaire&nbsp;·&nbsp;✓ Compte en 1 minute&nbsp;·&nbsp;✓ Sans engagement
        </p>
      </div>
    </section>
  );
}

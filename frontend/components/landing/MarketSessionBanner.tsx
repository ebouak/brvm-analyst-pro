'use client';

import { useEffect, useState } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
   BRVM — Bandeau marché « terminal institutionnel »
   Calcul de phase de séance en temps réel depuis l'heure UTC du navigateur.
   Fuseau de référence : GMT (≈ UTC, pas de DST en zone UEMOA).

   Horaires BRVM (GMT) :
     09:00–09:45  Pré-ouverture
     09:45        Fixing d'ouverture
     09:45–14:00  Négociation en continu
     14:00–14:30  Pré-clôture
     14:30        Fixing de clôture
     14:30–15:00  Négociation au dernier cours
     15:00        Fermeture / officialisation
   ────────────────────────────────────────────────────────────────────────── */

/** Minutes depuis minuit GMT pour chaque borne de séance. */
const T = {
  PRE_OPEN: 9 * 60, //        09:00
  OPEN_FIX: 9 * 60 + 45, //   09:45
  PRE_CLOSE: 14 * 60, //      14:00
  CLOSE_FIX: 14 * 60 + 30, // 14:30
  CLOSE: 15 * 60, //          15:00
} as const;

/* ── Calendrier (extension future : jours fériés & veilles de fête) ────────
   Pour étendre : ajouter les dates 'YYYY-MM-DD' fériées dans BRVM_HOLIDAYS,
   ou une entrée dans SPECIAL_SESSIONS pour des horaires raccourcis. */
const BRVM_HOLIDAYS = new Set<string>([
  // '2026-01-01', '2026-05-01', '2026-08-07', '2026-12-25', …
]);

interface SpecialSession {
  /** Heure de fermeture en minutes GMT (séance écourtée, veille de fête). */
  closeMinutes: number;
}
const SPECIAL_SESSIONS: Record<string, SpecialSession> = {
  // '2026-12-24': { closeMinutes: 12 * 60 }, // veille de Noël : clôture 12:00
};

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Un jour est-il ouvré pour la BRVM ? (lun–ven, hors fériés). */
function isTradingDay(d: Date): boolean {
  const dow = d.getUTCDay(); // 0 dim … 6 sam
  if (dow === 0 || dow === 6) return false;
  return !BRVM_HOLIDAYS.has(ymd(d));
}

type PhaseKey =
  | 'closed-weekend'
  | 'closed-holiday'
  | 'pre-session' // jour ouvré, avant 09:00
  | 'pre-open'
  | 'continuous'
  | 'pre-close'
  | 'last-price'
  | 'post-session'; // jour ouvré, après clôture

export interface MarketPhase {
  key: PhaseKey;
  open: boolean;
  /** Libellé global « Ouvert » / « Fermé » / « Pré-ouverture ». */
  marketLabel: string;
  /** Phase de séance détaillée. */
  sessionLabel: string;
  /** Sous-ligne contextuelle. */
  sessionDetail: string;
  /** Prochaine ouverture (Date UTC) ou null si en séance. */
  nextOpen: Date | null;
}

/** Minute GMT de fermeture du jour donné (gère les séances écourtées). */
function closeMinuteFor(d: Date): number {
  return SPECIAL_SESSIONS[ymd(d)]?.closeMinutes ?? T.CLOSE;
}

/** Prochaine date d'ouverture (09:00 GMT) à partir d'un instant donné. */
function computeNextOpen(now: Date): Date {
  const probe = new Date(now);
  // Si on est aujourd'hui un jour ouvré et avant 09:00 → aujourd'hui 09:00.
  const minutesNow = probe.getUTCHours() * 60 + probe.getUTCMinutes();
  if (isTradingDay(probe) && minutesNow < T.PRE_OPEN) {
    const o = new Date(probe);
    o.setUTCHours(9, 0, 0, 0);
    return o;
  }
  // Sinon, prochain jour ouvré à 09:00.
  for (let i = 1; i <= 8; i++) {
    const cand = new Date(probe);
    cand.setUTCDate(probe.getUTCDate() + i);
    cand.setUTCHours(9, 0, 0, 0);
    if (isTradingDay(cand)) return cand;
  }
  // Sécurité (ne devrait jamais arriver) : +1 jour.
  const fb = new Date(probe);
  fb.setUTCDate(probe.getUTCDate() + 1);
  fb.setUTCHours(9, 0, 0, 0);
  return fb;
}

/** Cœur métier : calcule la phase de marché pour un instant donné. */
export function computeMarketPhase(now: Date): MarketPhase {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (now.getUTCDay() === 0 || now.getUTCDay() === 6) {
    return {
      key: 'closed-weekend',
      open: false,
      marketLabel: 'Fermé',
      sessionLabel: 'Week-end',
      sessionDetail: 'Marché fermé',
      nextOpen: computeNextOpen(now),
    };
  }
  if (BRVM_HOLIDAYS.has(ymd(now))) {
    return {
      key: 'closed-holiday',
      open: false,
      marketLabel: 'Fermé',
      sessionLabel: 'Jour férié',
      sessionDetail: 'Marché fermé',
      nextOpen: computeNextOpen(now),
    };
  }

  const close = closeMinuteFor(now);

  if (minutes < T.PRE_OPEN) {
    return {
      key: 'pre-session',
      open: false,
      marketLabel: 'Fermé',
      sessionLabel: 'Hors séance',
      sessionDetail: 'Ouverture à 09:00 GMT',
      nextOpen: computeNextOpen(now),
    };
  }
  if (minutes < T.OPEN_FIX) {
    return {
      key: 'pre-open',
      open: true,
      marketLabel: 'Pré-ouverture',
      sessionLabel: 'Pré-ouverture',
      sessionDetail: 'Fixing d’ouverture à 09:45',
      nextOpen: null,
    };
  }
  if (minutes < T.PRE_CLOSE) {
    return {
      key: 'continuous',
      open: true,
      marketLabel: 'Ouvert',
      sessionLabel: 'Négociation en continu',
      sessionDetail: 'Pré-clôture à 14:00 GMT',
      nextOpen: null,
    };
  }
  if (minutes < T.CLOSE_FIX) {
    return {
      key: 'pre-close',
      open: true,
      marketLabel: 'Ouvert',
      sessionLabel: 'Pré-clôture',
      sessionDetail: 'Fixing de clôture à 14:30',
      nextOpen: null,
    };
  }
  if (minutes < close) {
    return {
      key: 'last-price',
      open: true,
      marketLabel: 'Ouvert',
      sessionLabel: 'Dernier cours',
      sessionDetail: `Fermeture à ${String(Math.floor(close / 60)).padStart(2, '0')}:${String(close % 60).padStart(2, '0')} GMT`,
      nextOpen: null,
    };
  }
  return {
    key: 'post-session',
    open: false,
    marketLabel: 'Fermé',
    sessionLabel: 'Séance clôturée',
    sessionDetail: 'Marché officialisé',
    nextOpen: computeNextOpen(now),
  };
}

/* ── Formatage ─────────────────────────────────────────────────────────── */

const DOW = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function hhmm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** « Aujourd'hui · 09:00 GMT » / « Lundi · 09:00 GMT ». */
function formatNextOpen(next: Date | null, now: Date): { day: string; time: string } {
  if (!next) return { day: 'En séance', time: '—' };
  const sameDay = ymd(next) === ymd(now);
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(now.getUTCDate() + 1);
  const isTomorrow = ymd(next) === ymd(tomorrow);
  const day = sameDay ? 'Aujourd’hui' : isTomorrow ? 'Demain' : DOW[next.getUTCDay()];
  return { day, time: `${hhmm(next)} GMT` };
}

/* ── Icônes inline (zéro dépendance) ───────────────────────────────────── */

type IconProps = { className?: string };
const ICON = 'h-3.5 w-3.5';

function IconPulse({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${ICON} ${className}`} aria-hidden>
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  );
}
function IconClock({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${ICON} ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconCalendar({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${ICON} ${className}`} aria-hidden>
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}
function IconGlobe({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${ICON} ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}

/* ── Cellule ───────────────────────────────────────────────────────────── */

function Cell({
  icon,
  label,
  value,
  sub,
  valueClass = 'text-white',
  glow,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
  glow?: 'cyan' | 'emerald' | 'rose';
}) {
  return (
    <div className="relative flex items-center gap-3 px-4 py-3 sm:px-5">
      <span
        className={[
          'grid h-7 w-7 flex-none place-items-center rounded-full border text-[11px]',
          glow === 'emerald'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
            : glow === 'rose'
            ? 'border-rose-400/25 bg-rose-400/10 text-rose-300'
            : glow === 'cyan'
            ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
            : 'border-white/12 bg-white/[0.04] text-slate-300',
        ].join(' ')}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <span className={`truncate font-display text-base leading-tight tracking-tight ${valueClass}`}>{value}</span>
        <span className="truncate text-[10.5px] leading-tight text-slate-400">{sub}</span>
      </div>
    </div>
  );
}

/* ── Composant principal ───────────────────────────────────────────────── */

export default function MarketSessionBanner({ className = '' }: { className?: string }) {
  // Rendu déterministe au SSR (placeholder), puis hydratation côté client.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000); // rafraîchit deux fois par minute
    return () => clearInterval(id);
  }, []);

  const phase = now ? computeMarketPhase(now) : null;
  const next = phase ? formatNextOpen(phase.nextOpen, now!) : null;

  const marketGlow: 'emerald' | 'rose' = phase?.open ? 'emerald' : 'rose';
  const marketValueClass = phase?.open ? 'text-emerald-300' : 'text-white';

  const syncLabel = now
    ? `Synchronisé · ${DOW[now.getUTCDay()].toLowerCase()} ${now.getUTCDate()} ${now.toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })}, ${hhmm(now)} UTC`
    : 'Synchronisation…';

  return (
    <section
      aria-label="État de la séance BRVM en temps réel"
      className={`group/banner relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface ${className}`}
    >
      {/* Halo lumineux maîtrisé (cyan + emerald) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-64 w-72 rounded-full bg-emerald-400/[0.06] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-20%,rgba(86,215,253,0.06),transparent_55%)]" />
      </div>
      {/* Filet supérieur lumineux */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

      <div className="relative">
        {/* Grille 4 colonnes, séparateurs fins */}
        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] lg:grid-cols-4 lg:divide-y-0">
          <Cell
            icon={<IconPulse />}
            label="Marché"
            value={phase ? phase.marketLabel : '—'}
            sub={now ? `Aujourd’hui · ${hhmm(now)} GMT` : 'Chargement…'}
            valueClass={marketValueClass}
            glow={phase ? marketGlow : undefined}
          />
          <Cell
            icon={<IconClock />}
            label="Séance en cours"
            value={phase ? phase.sessionLabel : '—'}
            sub={phase ? phase.sessionDetail : 'Chargement…'}
          />
          <Cell
            icon={<IconCalendar />}
            label="Prochaine ouverture"
            value={next ? next.day : '—'}
            sub={next ? next.time : 'Chargement…'}
          />
          <Cell
            icon={<IconGlobe />}
            label="Fuseau horaire"
            value="GMT"
            sub={syncLabel}
            glow="cyan"
          />
        </div>

      </div>

      {/* Pastille live discrète (coin) */}
      <span
        aria-label="Marché BRVM synchronisé en direct"
        className="pointer-events-none absolute right-3 top-3 flex h-2 w-2"
      >
        <span className={`absolute inline-flex h-full w-full rounded-full ${phase?.open ? 'bg-emerald-400' : 'bg-cyan-400'} opacity-60 ${phase ? 'animate-ping' : ''}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${phase?.open ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
      </span>
    </section>
  );
}

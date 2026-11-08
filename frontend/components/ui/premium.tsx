import Link from 'next/link';
import { libelleSignal } from '@/lib/signalLabel';
import type { ReactNode } from 'react';
import { Hourglass, Inbox, Lock, Pause, Target, type LucideIcon } from 'lucide-react';

/**
 * Les états vides recevaient un glyphe Unicode (◈ ◇ ✦ ◎…) en guise d'icône —
 * tic des interfaces générées, retiré le 2026-11-05. Les appels passent encore
 * une chaîne : elle choisit désormais une icône dessinée (lucide), même trait
 * partout. Glyphe inconnu → boîte vide.
 */
const ICONE_ETAT: Record<string, LucideIcon> = {
  '✦': Lock,
  '◎': Target,
  '⏸': Pause,
  '⏳': Hourglass,
};

/* ════════════════════════════════════════════════════════════════════════
   Kit premium — « Maison de marché premium africaine »
   Primitives réutilisables : noir laqué · or rare · double-bezel · eyebrow.
   Tous server-compatibles (pas de hook client).
   ════════════════════════════════════════════════════════════════════════ */

const EASE = 'transition-[color,background-color,border-color,box-shadow,transform,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

/* ── Eyebrow : étiquette de section sobre ──────────────────────────────────── */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm font-medium text-muted ${className}`}>{children}</p>;
}

/* ── SectionHeader : titre de page/section (display) + actions ──────────────
   Ni surtitre au-dessus du titre, ni lueur floue derrière : deux tics des
   interfaces générées (retirés le 2026-11-05). Le titre porte seul la page. */
export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Ancienne teinte de lueur, sans effet depuis le retrait de la lueur. */
  accent?: 'cyan' | 'gold' | 'emerald' | 'none';
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-ivory">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ── PremiumPanel : conteneur double-bezel (coque + cœur) ────────────────── */
export function PremiumPanel({
  children,
  className = '',
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`rounded-panel border p-1.5 ${glow ? 'premium-topo border-gold/25 bg-gold/[0.04]' : 'border-border bg-border/40'}`}>
      <div
        className={`rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/* ── MetricCard : KPI premium (valeur mono + delta coloré) ───────────────── */
export function MetricCard({
  label,
  value,
  delta,
  deltaDir,
  unit,
  accent = 'neutral',
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: 'up' | 'down' | 'flat';
  unit?: string;
  accent?: 'gold' | 'emerald' | 'sapphire' | 'neutral';
}) {
  const accentRing = {
    gold: 'hover:border-gold/30',
    emerald: 'hover:border-up/30',
    sapphire: 'hover:border-sapphire/30',
    neutral: 'hover:border-border-strong',
  }[accent];
  const deltaColor = deltaDir === 'up' ? 'text-up' : deltaDir === 'down' ? 'text-down' : 'text-muted';
  const arrow = deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '';
  return (
    <div className={`group min-w-0 rounded-card border border-border bg-surface p-4 shadow-card ${EASE} ${accentRing}`}>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="tabular text-2xl font-semibold text-ivory">{value}</span>
        {unit && <span className="text-xs text-faint">{unit}</span>}
      </div>
      {delta && (
        <p className={`tabular mt-1 text-xs font-medium ${deltaColor}`}>
          {arrow} {delta}
        </p>
      )}
    </div>
  );
}

/* ── SignalBadge : pastille BUY/HOLD/SELL statutaire ─────────────────────── */
export function SignalBadge({ signal }: { signal: 'BUY' | 'HOLD' | 'SELL' | string }) {
  const map: Record<string, { cls: string; label: string }> = {
    BUY: { cls: 'border-up/30 bg-up/5 text-up', label: 'Achat' },
    SELL: { cls: 'border-down/30 bg-down/5 text-down', label: 'Vente' },
    HOLD: { cls: 'border-warn/30 bg-warn/10 text-warn', label: 'Attente' },
  };
  const m = map[signal] ?? { cls: 'border-border bg-elevated text-muted', label: libelleSignal(signal) };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

/* ── StatPill : micro-badge informatif ──────────────────────────────────── */
export function StatPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'gold' | 'emerald' | 'sapphire' | 'neutral';
}) {
  const cls = {
    gold: 'border-gold/30 bg-gold/10 text-accent-ink',
    emerald: 'border-up/30 bg-up/5 text-up',
    sapphire: 'border-sapphire/30 bg-sapphire/10 text-accent-ink',
    neutral: 'border-border bg-elevated text-muted',
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

/* ── EmptyStatePremium : état vide soigné ────────────────────────────────── */
export function EmptyStatePremium({
  title = 'Aucune donnée disponible',
  hint,
  icon = '◇',
  action,
}: {
  title?: string;
  hint?: string;
  icon?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-12 text-center shadow-card">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-gold/20 bg-gold/[0.06] text-accent-ink">
        {(() => {
          const Icone = ICONE_ETAT[icon] ?? Inbox;
          return <Icone size={20} strokeWidth={1.75} aria-hidden />;
        })()}
      </div>
      <p className="mt-4 font-display text-base text-ivory">{title}</p>
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      {action && (
        <Link
          href={action.href}
          className={`mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent-ink px-4 py-2 text-sm font-semibold text-obsidian ${EASE} hover:brightness-110 active:scale-95`}
        >
          {action.label} <span>→</span>
        </Link>
      )}
    </div>
  );
}

/* ── PremiumCTA : bouton signature magnétique (icône en pastille) ────────── */
export function PremiumCTA({
  href,
  children,
  variant = 'gold',
}: {
  href: string;
  children: ReactNode;
  variant?: 'gold' | 'ghost';
}) {
  if (variant === 'ghost') {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-xl border border-border-strong px-5 py-2.5 text-sm font-medium text-ivory ${EASE} hover:border-gold/40 hover:text-accent-ink`}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-xl bg-accent-ink px-5 py-2.5 text-sm font-semibold text-obsidian ${EASE} hover:brightness-110 active:scale-[0.98]`}
    >
      {children}
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

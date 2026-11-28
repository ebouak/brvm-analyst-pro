import Link from 'next/link';
import { Activity, BarChart3, BookOpen, GitCompare, Layers, Lock, ShieldCheck } from 'lucide-react';

interface OngletStress {
  id: string;
  label: string;
  href?: string;
  phase?: string;
  premium?: boolean;
}

const ONGLETS: OngletStress[] = [
  { id: 'overview', label: "Vue d'ensemble", href: '/stress-monitor' },
  { id: 'crises', label: 'Crises historiques', href: '/stress-monitor/crises' },
  { id: 'valeurs', label: 'Analyse des valeurs', href: '/stress-monitor/valeurs', premium: true },
  { id: 'rebonds', label: 'Statistiques de rebond', href: '/stress-monitor/rebonds', premium: true },
  { id: 'strategies', label: 'Scénarios et stratégies', href: '/stress-monitor/strategies', premium: true },
  { id: 'methodologie', label: 'Méthodologie et données', href: '/stress-monitor/methodologie' },
];

function iconeOnglet(id: string) {
  switch (id) {
    case 'overview':
      return Activity;
    case 'crises':
      return GitCompare;
    case 'valeurs':
      return ShieldCheck;
    case 'rebonds':
      return BarChart3;
    case 'strategies':
      return Layers;
    default:
      return BookOpen;
  }
}

export function StressSubNav({
  actif,
}: {
  actif: 'overview' | 'crises' | 'valeurs' | 'rebonds' | 'strategies' | 'methodologie';
}) {
  return (
    <nav aria-label="Sections du BRVM Market Stress Monitor" className="mt-6 border-b border-border/80">
      <div className="-mb-px flex items-center gap-1 overflow-x-auto pb-1">
        {ONGLETS.map((o) => {
          const Icone = iconeOnglet(o.id);
          const estActif = o.id === actif;
          if (!o.href) {
            return (
              <span
                key={o.id}
                aria-disabled="true"
                className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap px-3 py-2 text-xs text-faint md:min-h-0"
                title={`Disponible en ${o.phase}`}
              >
                <Icone className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>{o.label}</span>
                <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[11px] text-faint">
                  {o.phase}
                </span>
              </span>
            );
          }
          return (
            <Link
              key={o.id}
              href={o.href}
              aria-current={estActif ? 'page' : undefined}
              className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 ${
                estActif
                  ? 'border-accent-ink text-ivory'
                  : 'border-transparent text-muted hover:text-accent-ink'
              }`}
            >
              <Icone className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{o.label}</span>
              {o.premium && <Lock className="h-3 w-3 text-faint" strokeWidth={1.75} aria-label="Premium" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

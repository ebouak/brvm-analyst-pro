import Link from 'next/link';
import { BrvmPulseButton } from '@/components/BrvmPulseButton';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';

export const metadata = { title: 'Terminal de marché — BRVM Analyst Pro' };

const TOOLS: { href: string; label: string; desc: string }[] = [
  { href: '/dashboard', label: 'Tableau de bord', desc: 'État du marché, indices, portefeuille, signaux' },
  { href: '/signaux', label: 'Signaux', desc: 'Opportunités achat / vente / conservation' },
  { href: '/screener', label: 'Screener', desc: 'Filtres multi-critères (RSI, score, secteur…)' },
  { href: '/heatmap', label: 'Heatmap', desc: 'Cartographie des variations du jour' },
  { href: '/premium/valorisation', label: 'Valorisation', desc: 'Juste-valeur, P/E, P/B, F-Score, Altman Z' },
  { href: '/premium/comparateur', label: 'Comparateur', desc: 'Rendement vs risque des classes d’actifs' },
  { href: '/backtest', label: 'Backtest', desc: 'Tester une stratégie sur l’historique' },
  { href: '/premium/diagnostic', label: 'Diagnostic IA', desc: 'Analyse complète assistée par IA' },
];

export default function TerminalPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      <SectionHeader
        kicker="Accès rapide · Market data"
        title="Terminal de marché"
        subtitle="Votre point d’entrée vers toutes les analyses BRVM Analyst Pro."
      />

      {/* Pièce maîtresse : bouton PulseBeams */}
      <div className="flex justify-center">
        <BrvmPulseButton href="/dashboard" />
      </div>

      {/* Grille d'accès aux outils */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group">
            <PremiumPanel className="h-full p-4 transition-colors group-hover:border-info/40">
              <p className="text-sm font-semibold text-ivory">{t.label}</p>
              <p className="mt-1 text-xs text-muted leading-relaxed">{t.desc}</p>
            </PremiumPanel>
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { getOutilsData } from '@/lib/premium/outils';
import OutilsCharts from '@/components/premium/OutilsCharts';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  StatPill,
} from '@/components/ui/premium';

export const revalidate = 3600;

export default async function OutilsPage() {
  const { actionsProchesBas, saisonnalite, reactionsEtats } = await getOutilsData();

  const nbProcheBas = actionsProchesBas.filter((a) => a.distance_pct < 5).length;
  const moisMeilleur = saisonnalite.reduce(
    (best, m) => (m.perf_moyenne > best.perf_moyenne ? m : best),
    saisonnalite[0] ?? { nom_mois: '—', perf_moyenne: 0 },
  );
  const moisPire = saisonnalite.reduce(
    (worst, m) => (m.perf_moyenne < worst.perf_moyenne ? m : worst),
    saisonnalite[0] ?? { nom_mois: '—', perf_moyenne: 0 },
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <SectionHeader
        accent="gold"
        kicker="Boîte à outils"
        title="Outils Premium"
        subtitle="Saisonnalité, actions proches de leurs plus bas, réaction aux états financiers — signaux structurels de la BRVM."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      {/* ── Annuaire des outils (hub — refonte nav 2026-07-10) ──────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { href: '/premium/classements', label: 'Classements', desc: 'Tops du marché' },
          { href: '/premium/anomalies', label: 'Anomalies', desc: 'Mouvements atypiques' },
          { href: '/premium/correlations', label: 'Corrélations', desc: 'Titres liés' },
          { href: '/premium/comparateur', label: 'Comparateur', desc: 'Face-à-face titres' },
          { href: '/saisonnalite', label: 'Saisonnalité', desc: 'Mois forts / faibles' },
          { href: '/classement', label: 'Classement papier', desc: 'Leaderboard public' },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-xl border border-border bg-surface/40 px-3 py-2.5 transition-colors hover:border-gold/40 hover:bg-gold/5"
          >
            <span className="block text-sm font-medium text-ivory group-hover:text-gold">{t.label}</span>
            <span className="block text-[11px] text-faint">{t.desc}</span>
          </Link>
        ))}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Proches du plus bas 52s"
          value={String(nbProcheBas)}
          delta="actions à < 5 % de leur plancher"
          deltaDir="down"
          accent="neutral"
        />
        <MetricCard
          label="Meilleur mois historique"
          value={moisMeilleur.nom_mois}
          delta={`+${moisMeilleur.perf_moyenne.toFixed(2)} % en moyenne`}
          deltaDir="up"
          accent="emerald"
        />
        <MetricCard
          label="Pire mois historique"
          value={moisPire.nom_mois}
          delta={`${moisPire.perf_moyenne.toFixed(2)} % en moyenne`}
          deltaDir="down"
          accent="neutral"
        />
      </div>

      {/* ── Séparateur éditorial ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gold/50">
          Visualisations
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── Graphiques + tables (client component) ───────────────────────── */}
      <PremiumPanel glow className="p-5">
        <OutilsCharts
          actionsProchesBas={actionsProchesBas}
          saisonnalite={saisonnalite}
          reactionsEtats={reactionsEtats}
        />
      </PremiumPanel>

    </div>
  );
}

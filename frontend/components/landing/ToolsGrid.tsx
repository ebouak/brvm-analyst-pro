// frontend/components/landing/ToolsGrid.tsx
import Link from 'next/link';

interface Tool {
  label: string;
  href: string;
  desc: string;
}

const CATEGORIES: { title: string; tools: Tool[] }[] = [
  {
    title: 'Analyser',
    tools: [
      { label: 'Note A–F', href: '/notations', desc: 'Notation quantitative de chaque action' },
      { label: 'Screener', href: '/screener', desc: 'Filtres multi-critères sur toute la cote' },
      { label: 'Dividendes', href: '/dividendes', desc: 'Rendement et calendrier de versement' },
      { label: 'Fondamentaux', href: '/fondamentaux', desc: 'États financiers extraits des publications' },
    ],
  },
  {
    title: 'Comprendre',
    tools: [
      { label: 'Diagnostic IA', href: '/premium/diagnostic', desc: 'Analyse sell-side générée par IA' },
      { label: 'Brief quotidien', href: '/brief', desc: 'La séance résumée chaque soir' },
      { label: 'Actualités', href: '/actualites', desc: "Le fil d'actualité du marché" },
      { label: 'Analyses', href: '/analyses', desc: 'Décryptages et études de marché' },
    ],
  },
  {
    title: 'Simuler & suivre',
    tools: [
      { label: 'Simulateur', href: '/simulateur', desc: 'Et si vous aviez investi ?' },
      { label: 'Paper trading', href: '/premium/paper-trading', desc: 'Entraînez-vous avec un capital fictif' },
      { label: 'Alertes', href: '/parametres/alertes', desc: 'Suivi personnalisé en temps réel' },
      { label: 'Conseiller', href: '/conseiller', desc: 'Recommandations basées sur des signaux' },
    ],
  },
  {
    title: 'Comparer',
    tools: [
      { label: 'SGI', href: '/comparateur-sgi', desc: 'Comparateur de coûts réels' },
      { label: 'Obligations', href: '/obligations', desc: 'Marché obligataire UEMOA' },
      { label: 'Matières premières', href: '/weekly', desc: 'Cacao, or et valeurs sensibles' },
      { label: 'Liquidité', href: '/liquidite', desc: 'Score de liquidité par action' },
    ],
  },
];

export function ToolsGrid() {
  return (
    <section className="mt-10">
      <p className="overline mb-3 text-gold-2">Outils</p>
      <h2 className="mb-6 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
        Tout ce dont vous avez besoin pour investir intelligemment.
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">{cat.title}</p>
            <div className="space-y-1.5">
              {cat.tools.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="block rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-accent/30 hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-medium text-ivory">{t.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-faint">{t.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

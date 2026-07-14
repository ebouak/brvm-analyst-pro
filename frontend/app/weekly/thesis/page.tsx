import Link from 'next/link';

export const metadata = {
  title: 'Référentiel d\'exposition matières premières',
  description: 'Impact des cours mondiaux sur les actions BRVM exposées aux matières premières : cacao, caoutchouc, huile de palme, sucre, pétrole.',
};

// ── Données ──────────────────────────────────────────────────────────────────

const COMPANIES = [
  {
    ticker: 'SICC',
    name: 'Société Ivoirienne de Coco Râpé',
    alias: 'SICOR',
    pays: 'Côte d\'Ivoire',
    filiere: 'Coco / Coprah',
    photo: 'photo-1596546756213-c7f9b0abce51', // coconuts
    commodity: 'Huiles végétales',
    commodityColor: '#f59e0b',
    sensitivity: 4,
    benchmark: 'Panier huiles végétales (CPO, CBOT)',
    thesis: [
      'Hausse généralisée des huiles végétales → pricing power sur produits coprah',
      'Spécialisation mono-produit = pureté thématique mais risque concentré',
    ],
    risks: ['Sécheresse cocoteraies locales', 'Concurrence palme / soja meilleur marché'],
    conviction: 'medium',
    note: 'Valeur de niche — marché et liquidité limités',
  },
  {
    ticker: 'SIFCA',
    name: 'SIFCA',
    alias: 'Groupe agro-industriel',
    pays: 'Côte d\'Ivoire',
    filiere: 'Palmier · Hévéa · Sucre',
    photo: 'photo-1625246333195-78d9c38ad449', // green plantation
    commodity: 'Multi-filières',
    commodityColor: '#10b981',
    sensitivity: 3,
    benchmark: 'CPO Bursa + SICOM + ICE SB=F',
    thesis: [
      'Diversification naturelle — bénéfice sur plusieurs cycles simultanément',
      'Cœur de valeur : huile de palme, hévéa et sucre (via Sucrivoire)',
    ],
    risks: ['Cacao = exposition mineure/indirecte uniquement', 'Dépendance politiques agricoles CI'],
    conviction: 'medium',
    note: 'Cacao ● faible — ne pas surpondérer',
  },
  {
    ticker: 'SAPH',
    name: 'SAPH Côte d\'Ivoire',
    alias: 'Plantation d\'hévéas',
    pays: 'Côte d\'Ivoire',
    filiere: 'Caoutchouc naturel',
    photo: 'photo-1508193638397-1c4234db14d8', // latex tapping
    commodity: 'Caoutchouc naturel',
    commodityColor: '#22c55e',
    sensitivity: 4,
    benchmark: 'SICOM Singapour / TOCOM Tokyo',
    thesis: [
      'Adossement Michelin → off-take industriel partiellement sécurisé',
      'Coûts locaux rigides : hausse SICOM → quasi-intégralement dans la marge',
    ],
    risks: ['Reflux ventes auto mondiales', 'Baisse SICOM avec coûts incompressibles'],
    conviction: 'high',
    note: 'Pur joueur caoutchouc — corrélation directe et claire',
  },
  {
    ticker: 'SOGB',
    name: 'SOGB Côte d\'Ivoire',
    alias: 'Caoutchoucs de Grand-Béréby',
    pays: 'Côte d\'Ivoire',
    filiere: 'Hévéa + Palmier à huile',
    photo: 'photo-1508193638397-1c4234db14d8', // latex tapping
    commodity: 'Caoutchouc + Huile palme',
    commodityColor: '#16a34a',
    sensitivity: 3,
    benchmark: 'SICOM + CPO Bursa Malaysia',
    thesis: [
      'Double exposition hévéa + palmier → diversification naturelle',
      'Volatilité plus forte que SAPH (exposition marché spot)',
    ],
    risks: ['Retournement demande pneumatiques', 'Corrélation négative cacao / caoutchouc'],
    conviction: 'medium',
    note: 'Plus volatile que SAPH — pas d\'off-take garanti',
  },
  {
    ticker: 'PALC',
    name: 'PALM CI (PALMCI)',
    alias: 'Huile de palme brute',
    pays: 'Côte d\'Ivoire',
    filiere: 'Huile de palme',
    photo: 'photo-1586769852836-bc069f19e1b6', // palm trees
    commodity: 'Huile de palme',
    commodityColor: '#f97316',
    sensitivity: 4,
    benchmark: 'FCPO Bursa Malaysia',
    thesis: [
      'Leader huile de palme CI — revenus quasi 100 % indexés CPO',
      'Marchés domestiques CI partiellement captifs (lissage résultats)',
    ],
    risks: ['Réglementation UE biocarburants / palme', 'Hausse taxes import Inde → CPO chute'],
    conviction: 'medium',
    note: 'Peu liquide — données CPO techniques à suivre sur Bursa Malaysia',
  },
  {
    ticker: 'SCRC',
    name: 'SUCRIVOIRE',
    alias: 'Producteur de sucre',
    pays: 'Côte d\'Ivoire',
    filiere: 'Sucre',
    photo: 'photo-1559181567-c3190ca9d5db', // sugarcane
    commodity: 'Sucre brut',
    commodityColor: '#e879f9',
    sensitivity: 3,
    benchmark: 'ICE SB=F (sucre brut n°11)',
    thesis: [
      'Marché domestique captif = socle de revenus récurrents stables',
      'Hausse SB=F → soutien marges export (transmission partielle)',
    ],
    risks: ['Prix administrés CI bloquent la transmission mondiale', 'Surproduction Brésil / Inde'],
    conviction: 'medium',
    note: 'Exposition asymétrique — prix administrés amortissent les hausses mondiales',
  },
  {
    ticker: 'TTLS',
    name: 'Total Sénégal',
    alias: 'Distribution carburant',
    pays: 'Sénégal',
    filiere: 'Distribution pétrolière',
    photo: 'photo-1611273426858-450d8e3c9fce', // oil refinery
    commodity: 'Pétrole Brent / WTI',
    commodityColor: '#64748b',
    sensitivity: 5,
    benchmark: 'ICE BZ=F (Brent) + NYMEX CL=F (WTI)',
    thesis: [
      'Position dominante réseau stations Sénégal',
      'Production Sangomar (2024+) → hausse structurelle volumes distribution',
    ],
    risks: ['Blocage prix pompe par l\'État → marges comprimées', 'Brent très bas prolongé'],
    conviction: 'high',
    note: 'Corrélation la plus mécanique et rapide de la BRVM — réaction souvent J+1',
  },
  {
    ticker: 'SVOC',
    name: 'Société Pétrolière CI',
    alias: 'Raffinage + Distribution',
    pays: 'Côte d\'Ivoire',
    filiere: 'Raffinage + Distribution',
    photo: 'photo-1614850523296-d8c1af93d400', // offshore oil rig
    commodity: 'Pétrole Brent / WTI',
    commodityColor: '#475569',
    sensitivity: 4,
    benchmark: 'ICE BZ=F + crack spread WTI→produits raffinés',
    thesis: [
      'Position clé chaîne énergie Côte d\'Ivoire',
      'Crack spread positif = création de valeur au raffinage (2 étages de marge)',
    ],
    risks: ['Surcapacité mondiale raffinage → crack spread comprimé', 'Arrêt technique / maintenance'],
    conviction: 'medium',
    note: 'Structure plus complexe que TTLS — profil exact à confirmer fiche BRVM',
  },
];

const MATRIX = [
  { ticker: 'SICC',  cacao: 0, caoutchouc: 0, palme: 2, sucre: 0, petrole: 0, coco: 4 },
  { ticker: 'SIFCA', cacao: 1, caoutchouc: 2, palme: 2, sucre: 2, petrole: 0, coco: 0 },
  { ticker: 'SAPH',  cacao: 0, caoutchouc: 4, palme: 0, sucre: 0, petrole: 1, coco: 0 },
  { ticker: 'SOGB',  cacao: 0, caoutchouc: 3, palme: 2, sucre: 0, petrole: 1, coco: 0 },
  { ticker: 'PALC',  cacao: 0, caoutchouc: 0, palme: 4, sucre: 0, petrole: 0, coco: 0 },
  { ticker: 'SCRC',  cacao: 0, caoutchouc: 0, palme: 0, sucre: 3, petrole: 0, coco: 0 },
  { ticker: 'TTLS',  cacao: 0, caoutchouc: 0, palme: 0, sucre: 0, petrole: 5, coco: 0 },
  { ticker: 'SVOC',  cacao: 0, caoutchouc: 0, palme: 0, sucre: 0, petrole: 4, coco: 0 },
];

const CATALYSTS = [
  { freq: 'Hebdo (mer.)', event: 'Rapport stocks EIA (pétrole US)', tickers: ['TTLS', 'SVOC'] },
  { freq: 'Mensuel', event: 'Ventes automobiles Chine (CAAM)', tickers: ['SAPH', 'SOGB'] },
  { freq: 'Mensuel', event: 'Production palm oil Malaisie (MPOB)', tickers: ['PALC', 'SIFCA', 'SOGB'] },
  { freq: 'Mensuel', event: 'Rapport ICCO stocks cacao (macro CI)', tickers: ['SIFCA'] },
  { freq: 'Mensuel', event: 'Décisions export sucre Inde', tickers: ['SCRC'] },
  { freq: 'Mensuel', event: 'Rapports huiles végétales (USDA, FAO)', tickers: ['SICC', 'PALC'] },
  { freq: 'Trimestriel', event: 'Résultats pneumatiquaires (Michelin, Bridgestone)', tickers: ['SAPH', 'SOGB'] },
  { freq: 'Semestriel', event: 'Résultats sociétés cotées', tickers: ['Toutes'] },
  { freq: 'Ponctuel', event: 'Réunions OPEP+ (quotas)', tickers: ['TTLS', 'SVOC'] },
  { freq: 'Ponctuel', event: 'Décisions Conseil Café-Cacao CI (prix bord-champ)', tickers: ['SIFCA'] },
  { freq: 'Ponctuel', event: 'Réglementation UE biocarburants / huile de palme', tickers: ['PALC', 'SIFCA'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function dots(n: number) {
  if (n === 0) return <span className="text-gray-700">—</span>;
  const colors = ['', 'text-muted', 'text-yellow-400', 'text-orange-400', 'text-emerald-400', 'text-accent'];
  return <span className={colors[n] ?? 'text-accent'} title={`${n}/5`}>{'●'.repeat(n)}</span>;
}

function ConvictionBadge({ level }: { level: string }) {
  if (level === 'high') return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">🟢 Haute</span>
  );
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">🟡 Moyenne</span>
  );
}

function photo(id: string, w = 600, h = 280) {
  return `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ThesisPage() {
  return (
    <div className="min-h-screen bg-bg text-ivory">

      {/* ── Header ── */}
      <div className="border-b border-border bg-[#030303]">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-5">
            <Link href="/weekly" className="text-sm text-faint hover:text-accent transition-colors">
              ← Analyses hebdo
            </Link>
            <span className="text-gray-700">·</span>
            <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">
              Référentiel stratégique
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ivory leading-tight mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Exposition BRVM aux matières premières
          </h1>
          <p className="text-muted text-lg max-w-2xl">
            Impact des cours mondiaux sur les actions BRVM : mécanismes de transmission, thesis par valeur, matrice de sensibilité et calendrier des catalyseurs.
          </p>
          <p className="mt-3 text-xs text-faint font-mono">
            <span className="text-cyan-500/60">#FACT</span> = donnée vérifiée (profil BRVM / rapport annuel) ·{' '}
            <span className="text-amber-500/60">#MODEL</span> = analyse interne / modèle de transmission économique
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-14">

        {/* ── Matrice de sensibilité ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent/60">Matrice de sensibilité</span>
            <span className="text-[10px] text-amber-500/60 font-mono">#MODEL</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left py-3 px-4 text-muted font-semibold w-24">Action</th>
                  <th className="text-center py-3 px-3 text-amber-600 font-semibold">Cacao</th>
                  <th className="text-center py-3 px-3 text-emerald-500 font-semibold">Caoutchouc</th>
                  <th className="text-center py-3 px-3 text-orange-400 font-semibold">Huile palme</th>
                  <th className="text-center py-3 px-3 text-pink-400 font-semibold">Sucre</th>
                  <th className="text-center py-3 px-3 text-slate-400 font-semibold">Pétrole</th>
                  <th className="text-center py-3 px-3 text-yellow-400 font-semibold">Coco</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row, i) => (
                  <tr key={row.ticker} className={`border-b border-[#0f1f24] ${i % 2 === 0 ? 'bg-[#030303]' : 'bg-[#060f12]'}`}>
                    <td className="py-3 px-4 font-mono font-bold text-accent text-sm">{row.ticker}</td>
                    <td className="py-3 px-3 text-center">{dots(row.cacao)}</td>
                    <td className="py-3 px-3 text-center">{dots(row.caoutchouc)}</td>
                    <td className="py-3 px-3 text-center">{dots(row.palme)}</td>
                    <td className="py-3 px-3 text-center">{dots(row.sucre)}</td>
                    <td className="py-3 px-3 text-center">{dots(row.petrole)}</td>
                    <td className="py-3 px-3 text-center">{dots(row.coco)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-faint border-t border-[#0f1f24]">
              ● faible · ●● modéré · ●●● fort · ●●●● très fort · ●●●●● maximum
            </p>
          </div>
        </section>

        {/* ── Fiches sociétés ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent/60">Fiches valeurs</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COMPANIES.map(c => (
              <div key={c.ticker} className="rounded-xl border border-border overflow-hidden bg-[#070f12]">
                {/* Photo */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={photo(c.photo)}
                    alt={c.filiere}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070f12] via-[#070f12]/60 to-transparent" />
                  {/* Conviction badge */}
                  <div className="absolute top-3 right-3">
                    <ConvictionBadge level={c.conviction} />
                  </div>
                  {/* Ticker + filière */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="font-mono text-xs text-muted">{c.pays}</span>
                        <h3 className="text-ivory font-bold text-lg leading-tight">{c.name}</h3>
                        <p className="text-muted text-xs">{c.alias}</p>
                      </div>
                      <span className="font-mono font-black text-2xl text-accent">{c.ticker}</span>
                    </div>
                  </div>
                </div>

                {/* Contenu */}
                <div className="p-4 space-y-3">
                  {/* Commodity badge + benchmark */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: c.commodityColor + '22', color: c.commodityColor, border: `1px solid ${c.commodityColor}44` }}
                    >
                      {c.commodity}
                    </span>
                    <span className="text-xs text-faint font-mono">{c.benchmark}</span>
                  </div>

                  {/* Filière */}
                  <p className="text-xs text-faint font-semibold uppercase tracking-wide">{c.filiere}</p>

                  {/* Thesis */}
                  <ul className="space-y-1">
                    {c.thesis.map((t, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted">
                        <span className="text-cyan-500 mt-0.5 shrink-0">✦</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Risks */}
                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] text-faint uppercase tracking-wider mb-1.5">Risques</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.risks.map((r, i) => (
                        <span key={i} className="text-[11px] bg-red-950/40 text-red-400 border border-red-800/30 px-2 py-0.5 rounded">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  {c.note && (
                    <p className="text-[11px] text-amber-500/70 italic border-l-2 border-amber-500/30 pl-2">
                      {c.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Note cacao ── */}
        <section className="bg-[#0a0f12] border border-amber-900/30 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-400 mb-1">Cacao — pas de pur joueur coté BRVM</p>
              <p className="text-sm text-muted">
                Il n'existe pas à ce jour de société cotée à la BRVM dont le modèle d'affaires
                repose exclusivement sur le cacao. Le cacao affecte l'économie ivoirienne
                (≈ 40 % de la production mondiale) et marginalement SIFCA, mais son impact
                est davantage <strong className="text-gray-200">macro</strong> (revenus d'export UEMOA, sentiment sur la place)
                que <strong className="text-gray-200">micro</strong> par titre coté.
              </p>
              <p className="text-xs text-faint mt-2 font-mono">
                ⚠️ SICC = Société Ivoirienne de Coco Râpé (coprah), pas cacao.
              </p>
            </div>
          </div>
        </section>

        {/* ── Facteurs transversaux ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent/60">Facteurs transversaux</span>
            <span className="text-[10px] text-amber-500/60 font-mono">#MODEL</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: '💱',
                title: 'Parité USD / FCFA',
                text: 'Toutes les matières sont cotées en USD. Le FCFA est arrimé à l\'euro (655 = 1 €). Un dollar fort augmente mécaniquement les revenus en FCFA des exportateurs sans mouvement du cours.',
              },
              {
                icon: '🏛️',
                title: 'Prix administrés',
                text: 'Carburants, sucre et parfois huile de palme sont régulés dans plusieurs pays UEMOA. Cela amortit les chocs mondiaux mais crée un risque de compression de marge en phase haussière.',
              },
              {
                icon: '🌧️',
                title: 'Récoltes locales',
                text: 'Pour les valeurs agro (SAPH, SOGB, PALC, SICC, SCRC, SIFCA), le volume de récolte locale peut neutraliser ou amplifier l\'impact d\'un mouvement mondial de prix.',
              },
            ].map(f => (
              <div key={f.title} className="bg-surface border border-border rounded-xl p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h4 className="font-semibold text-ivory mb-2 text-sm">{f.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Calendrier catalyseurs ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent/60">Calendrier des catalyseurs</span>
            <span className="text-[10px] text-amber-500/60 font-mono">#MODEL</span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left py-3 px-4 text-muted font-semibold w-36">Fréquence</th>
                  <th className="text-left py-3 px-4 text-muted font-semibold">Événement</th>
                  <th className="text-left py-3 px-4 text-muted font-semibold">Valeurs</th>
                </tr>
              </thead>
              <tbody>
                {CATALYSTS.map((c, i) => (
                  <tr key={i} className={`border-b border-[#0f1f24] ${i % 2 === 0 ? 'bg-[#030303]' : 'bg-[#060f12]'}`}>
                    <td className="py-2.5 px-4 text-xs font-mono text-accent/70">{c.freq}</td>
                    <td className="py-2.5 px-4 text-xs text-muted">{c.event}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {c.tickers.map(t => (
                          <span key={t} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/20 text-accent/80 bg-cyan-400/5">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── CTA vers rapport hebdo ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface border border-cyan-500/20 rounded-xl p-5">
          <div>
            <p className="font-semibold text-ivory">Voir le dernier rapport hebdomadaire</p>
            <p className="text-sm text-muted mt-0.5">Cours en direct, analyse DeepSeek, impact BRVM mis à jour chaque semaine</p>
          </div>
          <Link
            href="/weekly"
            className="shrink-0 px-5 py-2.5 rounded-lg bg-cyan-500/10 border border-accent/30 text-accent font-semibold text-sm hover:bg-cyan-500/20 transition-colors"
          >
            Analyses hebdo →
          </Link>
        </div>

      </div>
    </div>
  );
}

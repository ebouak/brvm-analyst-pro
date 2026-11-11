import { AlertTriangle } from 'lucide-react';
import { SectionHeader, PremiumPanel, StatPill } from '@/components/ui/premium';
import EtMaintenant from '@/components/navigation/EtMaintenant';

export const metadata = { title: 'Méthodologie' };

export default function MethodologiePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* En-tête */}
      <SectionHeader
        title="Méthodologie et sources"
        subtitle="Provenance des données, indicateurs techniques et calcul des signaux d'opportunité."
      />

      {/* 1. Sources de données */}
      <Section title="Sources de données" index="01">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SourceCard
            title="BDFIN / BRVM"
            badge="Quotidien"
            badgeTone="emerald"
            items={[
              'Cotations journalières officielles (cours, volume, transactions)',
              'Données scrappées depuis bfin.brvm.org après chaque séance (16h30 GMT)',
              'Couverture : séance courante uniquement',
              'Cours de clôture, volume, valeur échangée, nb transactions',
            ]}
            note="Source officielle : priorité maximale en cas de conflit."
          />
          <SourceCard
            title="GitHub brvm-data-public"
            badge="Depuis 2000"
            badgeTone="sapphire"
            items={[
              'Repo public Fredysessie/brvm-data-public (màj toutes les 15 min)',
              'Format OHLCV : Open, High, Low, Close, Volume',
              'Couverture : ~50 tickers, historique depuis 2000',
              'Utilisé pour backfill initial et backtesting',
            ]}
            note="Données non officielles : uniquement pour l'analyse technique historique."
          />
        </div>
      </Section>

      {/* 2. Indicateurs techniques */}
      <Section title="Indicateurs techniques" index="02">
        <PremiumPanel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-xs text-faint text-left px-5 py-3 font-normal">Indicateur</th>
                <th className="text-xs text-faint text-left px-5 py-3 font-normal hidden sm:table-cell">Paramètres</th>
                <th className="text-xs text-faint text-left px-5 py-3 font-normal">Données min.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[
                ['SMA 20 / 50 / 200', 'Fenêtre 20, 50, 200 séances', '≥ 200 séances'],
                ['EMA 12 / 26', 'Lissage exponentiel k=2/(n+1)', '≥ 26 séances'],
                ['MACD', 'EMA12 − EMA26 ; signal = EMA9(MACD)', '≥ 35 séances'],
                ['RSI 14 (Wilder)', 'Période 14, lissage Wilder', '≥ 15 séances'],
                ['Breakout 20j', 'Close > max des 20 séances précédentes', '≥ 21 séances'],
                ['Golden/Death Cross', 'Croisement SMA20 × SMA50', '≥ 51 séances'],
              ].map(([ind, params, req]) => (
                <tr key={ind} className="group transition-colors duration-150 hover:bg-elevated/40">
                  <td className="px-5 py-3">
                    <code className="text-xs text-ivory font-mono">{ind}</code>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted hidden sm:table-cell">{params}</td>
                  <td className="px-5 py-3 text-xs text-faint tabular">{req}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
        <p className="text-xs text-faint italic px-1">
          Tous les calculs utilisent les <span className="text-muted">séances de cotation réelles</span> (jours ouvrés BRVM), pas les jours calendaires.
        </p>
      </Section>

      {/* 3. Scoring */}
      <Section title="Calcul des signaux" index="03">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Le score composite est calculé à partir de 3 sous-scores pondérés, augmentés de bonus et pénalités contextuels.
          </p>

          {/* Sous-scores */}
          <PremiumPanel className="divide-y divide-border/30">
            {[
              { label: 'score_variation',      desc: 'Variation du cours normalisée (±5% = ±1.0)', weight: '40 %', tone: 'emerald' as const },
              { label: 'score_volume',          desc: 'Volume relatif à la moyenne 20j',            weight: '30 %', tone: 'sapphire' as const },
              { label: 'score_rsi',             desc: 'Position RSI (survente / surachat)',          weight: '30 %', tone: 'sapphire' as const },
              { label: 'bonus_tendance',        desc: 'Bonus si golden cross ou breakout',           weight: '+bonus', tone: 'gold' as const },
              { label: 'penalite_liquidite',    desc: 'Malus si volume < seuil minimum',             weight: '−malus', tone: 'neutral' as const },
            ].map(({ label, desc, weight, tone }) => (
              <div key={label} className="flex items-center gap-4 px-5 py-3">
                <code className="text-xs text-ivory font-mono shrink-0 w-44">{label}</code>
                <span className="text-xs text-muted flex-1 hidden sm:block">{desc}</span>
                <StatPill tone={tone}>{weight}</StatPill>
              </div>
            ))}
          </PremiumPanel>

          {/* Seuils de signal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SignalThreshold
              signal="Signal haussier"
              condition="score > +0,60"
              cls="border-up/25 bg-up/[0.05] text-up"
              dot="bg-up"
            />
            <SignalThreshold
              signal="Neutre"
              condition="−0,60 ≤ score ≤ +0,60"
              cls="border-border/60 bg-elevated/40 text-muted"
              dot="bg-muted"
            />
            <SignalThreshold
              signal="Signal baissier"
              condition="score < −0,60"
              cls="border-down/25 bg-down/[0.05] text-down"
              dot="bg-down"
            />
          </div>
        </div>
      </Section>

      {/* 4. Backtesting */}
      <Section title="Backtesting" index="04">
        <PremiumPanel className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted">
            Simulation <span className="text-ivory font-medium">long-only</span> sur l&apos;historique de cours :
          </p>
          <ul className="space-y-2">
            {[
              'Entrée en position à la clôture du jour du signal d’achat',
              'Sortie à la clôture du jour du signal de vente',
              'Frais appliqués à chaque transaction (achat + vente)',
              'Capital initial = 100 (normalisé)',
              'Une seule position à la fois (pas de levier)',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-muted">
                <span className="mt-1 shrink-0 h-1 w-1 rounded-full bg-border-strong" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint border-t border-border/40 pt-3 italic">
            Les frais de courtage BRVM sont typiquement de 0,6 % par transaction.
          </p>
        </PremiumPanel>
      </Section>

      {/* 5. Calendrier */}
      <Section title="Calendrier de cotation UEMOA" index="05">
        <PremiumPanel className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted">
            La BRVM est ouverte du lundi au vendredi, sauf jours fériés UEMOA. Les calculs d&apos;indicateurs utilisent{' '}
            <span className="text-ivory">uniquement les jours de séance réels</span> — jours fériés et week-ends sont
            automatiquement exclus car absents de la base de données.
          </p>
          <p className="text-sm text-muted">
            Le calendrier UEMOA est stocké dans la table{' '}
            <code className="font-mono text-xs text-ivory bg-elevated px-1.5 py-0.5 rounded-sm">market_calendar</code>{' '}
            (migrations 0008). Il couvre les jours fériés des 8 États membres&nbsp;:
            Bénin, Burkina Faso, Côte d&apos;Ivoire, Guinée-Bissau, Mali, Niger, Sénégal, Togo.
          </p>
        </PremiumPanel>
      </Section>

      {/* Avertissement légal */}
      <div className="rounded-panel border border-warn/20 bg-warn/[0.03] px-5 py-4 shadow-card space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-warn" />
          <h3 className="text-sm font-medium text-warn">Avertissement légal · COSUMAF</h3>
        </div>
        <p className="text-xs text-faint leading-relaxed">
          Les données, analyses, signaux et résultats de backtesting fournis par WESTBOURSE sont à titre{' '}
          <span className="text-muted font-medium">informatif uniquement</span> et ne constituent pas un conseil en
          investissement au sens de la réglementation COSUMAF (Commission de Surveillance du Marché Financier de
          l&apos;Afrique Centrale) ni de l&apos;UMOA. Les performances passées ne préjugent pas des performances
          futures. Tout investissement sur le marché financier comporte des risques, y compris la perte du capital
          investi. Consultez un conseiller en investissement agréé avant toute décision.
        </p>
      </div>

      <EtMaintenant suites={[
        { href: '/signaux', titre: 'Les signaux', detail: 'Voir la méthode à l’œuvre sur la séance.' },
        { href: '/formations', titre: 'Se former', detail: 'Les parcours pour comprendre les notions.' },
        { href: '/societes', titre: 'Les sociétés', detail: 'Les fiches des valeurs cotées.' },
      ]} />
    </div>
  );
}

/* ── Composant : Section ───────────────────────────────────────────────────── */
function Section({ title, index, children }: { title: string; index: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="tabular text-xs text-faint font-mono shrink-0">{index}</span>
        <h2 className="text-heading-sm text-ivory">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ── Composant : SourceCard ────────────────────────────────────────────────── */
function SourceCard({
  title, badge, badgeTone, items, note,
}: {
  title: string;
  badge: string;
  badgeTone: 'emerald' | 'sapphire';
  items: string[];
  note: string;
}) {
  const badgeCls = badgeTone === 'emerald'
    ? 'border-up/30 bg-up/[0.06] text-up'
    : 'border-sapphire/30 bg-sapphire/[0.06] text-sapphire';

  return (
    <PremiumPanel className="px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ivory">{title}</h3>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${badgeCls}`}>{badge}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted">
            <span className="mt-1.5 shrink-0 h-1 w-1 rounded-full bg-border-strong" />
            {item}
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint italic border-t border-border/40 pt-2.5">{note}</p>
    </PremiumPanel>
  );
}

/* ── Composant : SignalThreshold ───────────────────────────────────────────── */
function SignalThreshold({
  signal, condition, cls, dot,
}: {
  signal: string;
  condition: string;
  cls: string;
  dot: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-card border px-4 py-3 shadow-card ${cls}`}>
      <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dot}`} />
      <div>
        <p className="text-xs font-semibold">{signal}</p>
        <p className="tabular text-xs text-faint">{condition}</p>
      </div>
    </div>
  );
}

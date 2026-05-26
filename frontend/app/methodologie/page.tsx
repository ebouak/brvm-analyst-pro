export const metadata = { title: 'Méthodologie — BRVM Analyst Pro' };

export default function MethodologiePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">📖 Méthodologie & Sources de données</h1>
        <p className="text-sm text-muted mt-1">Transparence sur la provenance des données et les calculs effectués.</p>
      </div>

      {/* Section 1: Sources */}
      <Section title="1. Sources de données">
        <SourceCard
          title="BDFIN / BRVM (primaire)"
          badge="Quotidien"
          badgeCls="text-up border-up/30 bg-up/5"
          items={[
            "Cotations journalières officielles (cours, volume, transactions)",
            "Données scrappées depuis bfin.brvm.org après chaque séance (16h30 GMT)",
            "Couverture : séance courante uniquement",
            "Données : cours de clôture, volume, valeur échangée, nb transactions",
          ]}
          note="Source officielle — priorité maximale en cas de conflit."
        />
        <SourceCard
          title="GitHub brvm-data-public (historique)"
          badge="Depuis 2000"
          badgeCls="text-info border-info/30 bg-info/5"
          items={[
            "Repo public Fredysessie/brvm-data-public (mise à jour toutes les 15 min)",
            "Format OHLCV : Open, High, Low, Close, Volume",
            "Couverture : ~50 tickers, historique depuis 2000 pour les plus anciens",
            "Utilisé pour le backfill initial et le backtesting",
          ]}
          note="Données non officielles — utilisées uniquement pour l'analyse technique historique."
        />
      </Section>

      {/* Section 2: Indicateurs techniques */}
      <Section title="2. Indicateurs techniques">
        <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
          <thead className="bg-bg/40 text-xs text-muted border-b border-border">
            <tr>
              <th className="px-4 py-2 text-left">Indicateur</th>
              <th className="px-4 py-2 text-left">Paramètres</th>
              <th className="px-4 py-2 text-left">Données requises</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {[
              ['SMA 20 / 50 / 200', 'Fenêtre 20, 50, 200 séances', '≥ 200 séances'],
              ['EMA 12 / 26', 'Lissage exponentiel k=2/(n+1)', '≥ 26 séances'],
              ['MACD', 'EMA12 − EMA26 ; signal = EMA9(MACD)', '≥ 35 séances'],
              ['RSI 14 (Wilder)', 'Période 14, lissage Wilder', '≥ 15 séances'],
              ['Breakout 20j', 'Close > max des 20 séances précédentes', '≥ 21 séances'],
              ['Golden/Death Cross', 'Croisement SMA20 × SMA50', '≥ 51 séances'],
            ].map(([ind, params, req]) => (
              <tr key={ind} className="hover:bg-bg/30">
                <td className="px-4 py-2 font-mono text-xs text-up">{ind}</td>
                <td className="px-4 py-2 text-xs text-muted">{params}</td>
                <td className="px-4 py-2 text-xs text-muted">{req}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted italic">Tous les calculs utilisent les <strong>séances de cotation réelles</strong> (jours ouvrés BRVM), pas les jours calendaires.</p>
      </Section>

      {/* Section 3: Scoring */}
      <Section title="3. Calcul des signaux (Scoring)">
        <div className="space-y-3 text-sm">
          <p className="text-muted">Le score composite est calculé à partir de 3 sous-scores + bonus/pénalités :</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: 'score_variation', desc: 'Variation du cours normalisée (±5% = ±1.0)', weight: '40%' },
              { label: 'score_volume',    desc: 'Volume relatif à la moyenne 20j', weight: '30%' },
              { label: 'score_rsi',       desc: 'Position RSI (survente/surachat)', weight: '30%' },
              { label: 'bonus_tendance',  desc: 'Bonus si golden cross ou breakout', weight: '+bonus' },
              { label: 'penalite_liquidite', desc: 'Malus si volume < seuil minimum', weight: '−malus' },
            ].map(({ label, desc, weight }) => (
              <div key={label} className="flex items-start gap-3 bg-bg/40 border border-border/50 rounded-lg px-3 py-2">
                <code className="text-xs text-up font-mono shrink-0 w-36">{label}</code>
                <span className="text-xs text-muted flex-1">{desc}</span>
                <span className="text-xs tabular text-muted shrink-0">{weight}</span>
              </div>
            ))}
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-xs space-y-1">
            <p><span className="text-up font-medium">🟢 BUY</span> — score_total &gt; +0.60</p>
            <p><span className="text-muted font-medium">⚪ HOLD</span> — −0.60 ≤ score ≤ +0.60</p>
            <p><span className="text-down font-medium">🔴 SELL</span> — score_total &lt; −0.60</p>
          </div>
        </div>
      </Section>

      {/* Section 4: Backtesting */}
      <Section title="4. Backtesting">
        <div className="text-sm text-muted space-y-2">
          <p>Le backtesting simule une stratégie <strong>long-only</strong> sur l&apos;historique de cours :</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Entrée en position à la clôture du jour du signal BUY</li>
            <li>Sortie à la clôture du jour du signal SELL</li>
            <li>Frais appliqués à chaque transaction (achat + vente)</li>
            <li>Capital initial = 100 (normalisé)</li>
            <li>Une seule position à la fois (pas de levier)</li>
          </ul>
          <p className="text-xs italic">Les frais de courtage BRVM sont typiquement de 0,6% par transaction.</p>
        </div>
      </Section>

      {/* Section 5: Calendrier UEMOA */}
      <Section title="5. Calendrier de cotation UEMOA">
        <div className="text-sm text-muted space-y-2">
          <p>La BRVM est ouverte du lundi au vendredi, sauf jours fériés UEMOA. Les calculs d&apos;indicateurs utilisent <strong>uniquement les jours de séance réels</strong> — les jours fériés et week-ends sont automatiquement exclus car absents de la base de données.</p>
          <p>Le calendrier UEMOA est stocké dans la table <code className="text-up bg-up/10 px-1 rounded">market_calendar</code> (migrations 0008). Il couvre les jours fériés des 8 États membres : Bénin, Burkina Faso, Côte d&apos;Ivoire, Guinée-Bissau, Mali, Niger, Sénégal, Togo.</p>
        </div>
      </Section>

      {/* Disclaimer */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-2">⚠️ Avertissement légal (COSUMAF)</h3>
        <p className="text-xs text-muted leading-relaxed">
          Les données, analyses, signaux et résultats de backtesting fournis par BRVM Analyst Pro sont à titre
          <strong> informatif uniquement</strong> et ne constituent pas un conseil en investissement au sens de la
          réglementation COSUMAF (Commission de Surveillance du Marché Financier de l&apos;Afrique Centrale) ni de l&apos;UMOA.
          Les performances passées ne préjugent pas des performances futures. Tout investissement sur le marché
          financier comporte des risques, y compris la perte du capital investi. Consultez un conseiller en
          investissement agréé avant toute décision.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold border-b border-border/50 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function SourceCard({ title, badge, badgeCls, items, note }: {
  title: string; badge: string; badgeCls: string;
  items: string[]; note: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${badgeCls}`}>{badge}</span>
      </div>
      <ul className="text-xs text-muted space-y-1 list-disc list-inside pl-1">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      <p className="text-[11px] text-muted italic border-t border-border/40 pt-2">{note}</p>
    </div>
  );
}

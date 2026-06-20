/**
 * Moteur de recommandation unifié (« bot conseiller ») — fonction PURE et testable.
 *
 * Combine les signaux DÉJÀ produits par WESTBOURSE en UNE décision claire :
 * Acheter / Conserver / Vendre, avec une conviction (0-100) et des raisons
 * lisibles. N'INVENTE RIEN : chaque facteur dont l'entrée est `null` est ignoré
 * (jamais de valeur fabriquée), et chaque contribution est explicitée.
 *
 * ⚠️ Conseil, pas exécution : la BRVM n'a pas d'API d'ordres ; l'utilisateur
 * agit ensuite via sa SGI.
 */

export type Action = 'acheter' | 'conserver' | 'vendre';

export interface AdvisorInputs {
  signal: 'BUY' | 'SELL' | 'HOLD' | null; // signal quantitatif (scoring §9)
  confiance: number | null; // 0-1
  dcfUpside: number | null; // (juste-valeur − cours)/cours, ex. 0.2 = +20 %
  rsi: number | null; // 0-100
  dividendYield: number | null; // en %
}

export interface FactorContribution {
  label: string; // ex. « Signal quantitatif »
  points: number; // contribution au score composite (±)
  detail: string; // explication lisible
}

export interface AdvisorResult {
  action: Action;
  conviction: number; // 0-100
  score: number; // composite interne [-100, +100]
  reasons: string[];
  factors: number; // nombre de facteurs réellement disponibles
  breakdown: FactorContribution[]; // décomposition par facteur (pour le dos de carte / graphe)
  narrative: string; // explication pédagogique débutant (technique + fondamental)
}

/**
 * Explication en clair pour un débutant : couple l'analyse technique (comportement
 * du cours) et fondamentale (valeur de l'entreprise), en langage simple. Honnête :
 * uniquement à partir des facteurs réellement disponibles.
 */
function narrate(inp: AdvisorInputs, action: Action): string {
  const tech: string[] = [];
  if (inp.signal === 'BUY') tech.push('les indicateurs de tendance et de momentum sont bien orientés');
  else if (inp.signal === 'SELL') tech.push('les indicateurs de tendance et de momentum sont mal orientés');
  else if (inp.signal === 'HOLD') tech.push('les indicateurs de tendance sont neutres');
  if (inp.rsi != null) {
    if (inp.rsi < 30) tech.push(`le cours a beaucoup reculé récemment (RSI ${inp.rsi.toFixed(0)} = « survente »), ce qui précède parfois un rebond`);
    else if (inp.rsi > 70) tech.push(`le cours a beaucoup monté (RSI ${inp.rsi.toFixed(0)} = « surachat »), ce qui appelle à la prudence`);
  }

  const fonda: string[] = [];
  if (inp.dcfUpside != null) {
    if (inp.dcfUpside > 0.15) fonda.push(`l'action se paie MOINS cher que sa valeur estimée (par ses bénéfices/flux futurs), soit ≈ +${Math.round(inp.dcfUpside * 100)} % de potentiel : elle paraît bon marché`);
    else if (inp.dcfUpside < -0.15) fonda.push(`l'action se paie PLUS cher que sa valeur estimée (${Math.round(inp.dcfUpside * 100)} %) : elle paraît chère`);
    else fonda.push('le cours est proche de sa valeur estimée (ni cher, ni bon marché)');
  }
  if (inp.dividendYield != null && inp.dividendYield >= 3) {
    fonda.push(`elle verse un dividende intéressant (${inp.dividendYield.toFixed(1)} % par an), qui rémunère la patience`);
  }

  const verdict =
    action === 'acheter' ? 'Le profil penche vers l’achat'
    : action === 'vendre' ? 'La prudence s’impose : alléger ou vendre peut se justifier'
    : 'Rien d’assez marqué pour agir : conserver et surveiller';

  const techStr = tech.length ? ` Côté technique (le comportement du cours en bourse), ${tech.join(', et ')}.` : '';
  const fondaStr = fonda.length ? ` Côté fondamental (la solidité et la valeur de l’entreprise), ${fonda.join(', et ')}.` : '';
  const tail = tech.length && fonda.length
    ? ' Quand le technique et le fondamental vont dans le même sens, le signal est plus fiable.'
    : '';

  return `${verdict}.${techStr}${fondaStr}${tail}`.trim();
}

const BUY_THRESHOLD = 22;
const SELL_THRESHOLD = -22;

export function recommend(inp: AdvisorInputs): AdvisorResult {
  const breakdown: FactorContribution[] = [];
  let score = 0;
  let factors = 0;
  const add = (label: string, points: number, detail: string) => {
    breakdown.push({ label, points: Math.round(points), detail });
    score += points;
  };

  // 1. Signal quantitatif (driver principal), pondéré par la confiance.
  if (inp.signal != null) {
    factors++;
    const conf = inp.confiance != null ? Math.max(0.3, Math.min(1, inp.confiance)) : 0.6;
    const c = `confiance ${Math.round(conf * 100)} %`;
    if (inp.signal === 'BUY') add('Signal quantitatif', 40 * conf, `Favorable (${c}).`);
    else if (inp.signal === 'SELL') add('Signal quantitatif', -40 * conf, `Défavorable (${c}).`);
    else add('Signal quantitatif', 0, 'Neutre.');
  }

  // 2. Valorisation DCF (décote = haussier, surcote = baissier).
  if (inp.dcfUpside != null) {
    factors++;
    const u = inp.dcfUpside;
    const contrib = Math.max(-30, Math.min(30, u * 100));
    const detail = u > 0.15 ? `Décote estimée (+${Math.round(u * 100)} % de potentiel).`
      : u < -0.15 ? `Surcote estimée (${Math.round(u * 100)} %).`
      : `Proche de la juste-valeur (${u >= 0 ? '+' : ''}${Math.round(u * 100)} %).`;
    add('Valorisation DCF', contrib, detail);
  }

  // 3. RSI (timing) : survente = opportunité, surachat = prudence.
  if (inp.rsi != null) {
    factors++;
    if (inp.rsi < 30) add('RSI (timing)', 10, `Survente (${inp.rsi.toFixed(0)}) — rebond possible.`);
    else if (inp.rsi > 70) add('RSI (timing)', -10, `Surachat (${inp.rsi.toFixed(0)}) — prudence.`);
    else add('RSI (timing)', 0, `Neutre (${inp.rsi.toFixed(0)}).`);
  }

  // 4. Dividende (soutien au portage).
  if (inp.dividendYield != null && inp.dividendYield > 0) {
    factors++;
    if (inp.dividendYield >= 6) add('Dividende', 8, `Rendement élevé (${inp.dividendYield.toFixed(1)} %).`);
    else if (inp.dividendYield >= 3) add('Dividende', 4, `Rendement correct (${inp.dividendYield.toFixed(1)} %).`);
    else add('Dividende', 0, `Rendement faible (${inp.dividendYield.toFixed(1)} %).`);
  }

  const action: Action = score >= BUY_THRESHOLD ? 'acheter' : score <= SELL_THRESHOLD ? 'vendre' : 'conserver';
  const conviction = Math.min(100, Math.round(Math.abs(score) * 1.6));

  // Raisons = détails des facteurs qui pèsent (≠ 0), sinon message explicite.
  const reasons = breakdown.filter((b) => b.points !== 0).map((b) => `${b.label} : ${b.detail}`);
  if (reasons.length === 0) reasons.push('Données insuffisantes pour une recommandation argumentée.');

  const narrative = factors > 0
    ? narrate(inp, action)
    : 'Pas assez de données (signaux, valorisation) pour expliquer une suggestion sur cette valeur.';

  return { action, conviction, score: Math.round(score), reasons, factors, breakdown, narrative };
}

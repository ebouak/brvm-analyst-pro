/**
 * Détection de « value trap » (piège de valeur) liée au PER.
 *
 * ── Le principe ──
 * Le PER seul ment. Un PER bas n'est bon marché que si le bénéfice tient ;
 * un PER élevé n'est pas cher s'il résulte d'un bénéfice effondré. On croise
 * donc le PER avec la TRAJECTOIRE du résultat net pour distinguer :
 *
 *  - décote RÉELLE  : PER bas + bénéfices stables/croissants → opportunité.
 *  - décote PIÈGE   : PER modéré + bénéfices en déclin → le « E » va baisser.
 *  - bénéfice EFFONDRÉ : PER gonflé mécaniquement (E ≈ 0), pas une valorisation.
 *  - PERTE          : résultat net négatif, PER non calculable.
 *
 * Fonctions PURES, testées (valueTrap.test.mjs). Aucune I/O.
 */

export type TrapVerdict =
  | 'trap-decote-piege'
  | 'trap-benefice-effondre'
  | 'perte'
  | 'decote-reelle'
  | 'cher-croissance'
  | 'sain'
  | 'indetermine';

export interface ValueTrapInput {
  /** PER = cours / BPA (ou capitalisation / résultat net). Null si non calculable. */
  per: number | null;
  /**
   * Résultat net par exercice, en ordre CHRONOLOGIQUE (ancien → récent).
   * Les valeurs manquantes (null) sont ignorées, jamais traitées comme des zéros.
   */
  netIncomeSeries: (number | null)[];
}

export interface ValueTrapResult {
  verdict: TrapVerdict;
  /** Libellé court affichable (badge). */
  label: string;
  /** Gravité pour le style : danger (piège), warn (à surveiller), good, neutral. */
  severity: 'danger' | 'warn' | 'good' | 'neutral';
  /** Le titre est-il un piège de valeur (l'un des deux types de trappe). */
  isTrap: boolean;
  /** Explication en une phrase, dérivée des métriques (jamais inventée). */
  raison: string;
  metrics: {
    cagr: number | null;        // croissance annualisée du résultat net, %
    yoy: number | null;         // variation dernière année, %
    baissesConsec: number;      // années de baisse consécutives (depuis la fin)
  };
}

const LABELS: Record<TrapVerdict, string> = {
  'trap-decote-piege': 'Value trap — décote piège',
  'trap-benefice-effondre': 'Value trap — bénéfice effondré',
  'perte': 'Perte — PER non calculable',
  'decote-reelle': 'Décote réelle',
  'cher-croissance': 'Cher — croissance à confirmer',
  'sain': 'Valorisation saine',
  'indetermine': 'Données insuffisantes',
};

function cagr(first: number, last: number, years: number): number | null {
  if (years < 1 || first <= 0 || last <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

/**
 * Évalue le risque de value trap. Renvoie un verdict `indetermine` plutôt qu'un
 * faux positif quand les données manquent.
 */
export function assessValueTrap(input: ValueTrapInput): ValueTrapResult {
  const nets = input.netIncomeSeries.filter((v): v is number => v != null);
  const per = input.per;

  let cagrPct: number | null = null;
  let yoy: number | null = null;
  let baissesConsec = 0;

  if (nets.length >= 2) {
    cagrPct = cagr(nets[0]!, nets[nets.length - 1]!, nets.length - 1);
    const prev = nets[nets.length - 2]!;
    if (prev !== 0) yoy = ((nets[nets.length - 1]! - prev) / Math.abs(prev)) * 100;
    for (let i = nets.length - 1; i > 0; i--) {
      if (nets[i]! < nets[i - 1]!) baissesConsec++;
      else break;
    }
  }

  const metrics = { cagr: cagrPct, yoy, baissesConsec };
  const declin =
    (cagrPct != null && cagrPct < -8) || baissesConsec >= 2 || (yoy != null && yoy < -25);
  const netDernier = nets.length ? nets[nets.length - 1]! : null;

  const mk = (verdict: TrapVerdict, severity: ValueTrapResult['severity'], raison: string): ValueTrapResult => ({
    verdict, label: LABELS[verdict], severity, isTrap: verdict.startsWith('trap-'), raison, metrics,
  });

  // Perte : le PER n'a pas de sens.
  if (netDernier != null && netDernier < 0) {
    return mk('perte', 'danger', 'Résultat net négatif sur le dernier exercice : le PER n’est pas calculable et la valeur détruit du capital.');
  }
  if (per == null || per <= 0) {
    return mk('indetermine', 'neutral', 'PER non calculable (bénéfice ou cours manquant) — pas de conclusion.');
  }

  // Type B : bénéfice effondré, PER mécaniquement gonflé.
  if (per > 40 && declin) {
    return mk(
      'trap-benefice-effondre', 'danger',
      `PER de ${per.toFixed(0)} gonflé par un bénéfice effondré (${describeDeclin(metrics)}). Ce n’est pas une valorisation de croissance : le dénominateur a fondu.`,
    );
  }
  // Type A : décote piège — semble bon marché, mais bénéfices en déclin.
  if (per < 14 && declin) {
    return mk(
      'trap-decote-piege', 'danger',
      `PER bas de ${per.toFixed(1)} qui semble bon marché, mais le résultat net décline (${describeDeclin(metrics)}). Le « bon marché » risque d’être justifié.`,
    );
  }
  // Décote réelle : PER bas + pas de déclin.
  if (per < 10 && !declin) {
    return mk(
      'decote-reelle', 'good',
      `PER bas de ${per.toFixed(1)} avec des bénéfices ${cagrPct != null && cagrPct > 0 ? `en hausse (${cagrPct.toFixed(0)} %/an)` : 'stables'} : décote potentiellement réelle.`,
    );
  }
  // Cher.
  if (per > 25) {
    return declin
      ? mk('cher-croissance', 'warn', `PER élevé de ${per.toFixed(0)} ET bénéfices en repli : valorisation difficile à justifier.`)
      : mk('cher-croissance', 'warn', `PER élevé de ${per.toFixed(0)} : la croissance future doit le justifier.`);
  }
  return mk('sain', 'neutral', `PER de ${per.toFixed(1)} cohérent avec la trajectoire des bénéfices.`);
}

function describeDeclin(m: ValueTrapResult['metrics']): string {
  const parts: string[] = [];
  if (m.baissesConsec >= 2) parts.push(`${m.baissesConsec} ans de baisse consécutifs`);
  if (m.cagr != null && m.cagr < -8) parts.push(`${m.cagr.toFixed(0)} %/an`);
  if (m.yoy != null && m.yoy < -25) parts.push(`${m.yoy.toFixed(0)} % sur un an`);
  return parts.join(', ') || 'bénéfices en repli';
}

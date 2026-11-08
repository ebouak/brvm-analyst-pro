import { fmtFcfa } from '@/lib/format';

/**
 * EXERCICE RETENU, source unique des comptes derrière les ratios publics.
 *
 * Un émetteur peut publier deux jeux de comptes (SYSCOHADA et IFRS) et la
 * table `fundamentals` en mélange les chiffres (SCRC 2025 : résultat net
 * SYSCOHADA, capitaux propres IFRS). Les tables `income_statements` et
 * `balance_sheets` sont SYSCOHADA et cohérentes entre elles : les ratios
 * publics se calculent donc dessus. `fundamentals` ne sert qu'en repli quand
 * ces tables manquent, et signale un second jeu de comptes quand ses capitaux
 * propres s'écartent de plus de 2 % de ceux du bilan.
 *
 * Fonction pure ; le chargeur serveur est dans `exerciceRetenuServeur.ts`.
 */

export interface LigneResultatRetenu { periode: string | number; resultat_net: number | null; revenu_total: number | null }
export interface LigneBilanRetenu {
  periode: string | number;
  total_capitaux_propres: number | null;
  dette_court_terme: number | null;
  dette_long_terme: number | null;
}
export interface LigneFondamentaux {
  year: number | null;
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt: number | null;
}

export interface ExerciceRetenu {
  exercice: number | null;
  source: 'syscohada' | 'fundamentals' | null;
  resultatNet: number | null;
  chiffreAffaires: number | null;
  capitauxPropres: number | null;
  detteFinanciere: number | null;
  /** Capitaux propres d'un autre jeu de comptes publié (écart > 2 % avec le bilan), sinon null. */
  secondJeu: { capitauxPropres: number } | null;
}

/**
 * Le bilan et les fondamentaux relèvent-ils des MÊMES comptes ? Tolérance 2 %.
 * Sans point de comparaison, rien ne prouve un écart.
 */
export function memesComptes(capitauxBilan: number | null, capitauxFondamentaux: number | null): boolean {
  if (capitauxBilan == null || capitauxFondamentaux == null || capitauxFondamentaux === 0) return true;
  return Math.abs(capitauxBilan - capitauxFondamentaux) / Math.abs(capitauxFondamentaux) <= 0.02;
}

const annee = (p: string | number): number => Number(String(p).slice(0, 4));

export function exerciceRetenu(p: {
  income: LigneResultatRetenu[];
  balance: LigneBilanRetenu[];
  fundamentals: LigneFondamentaux[];
}): ExerciceRetenu {
  const vide: ExerciceRetenu = { exercice: null, source: null, resultatNet: null, chiffreAffaires: null, capitauxPropres: null, detteFinanciere: null, secondJeu: null };
  const inc = p.income.filter((r) => Number.isFinite(annee(r.periode))).sort((a, b) => annee(b.periode) - annee(a.periode));
  const bil = p.balance.filter((r) => Number.isFinite(annee(r.periode))).sort((a, b) => annee(b.periode) - annee(a.periode));
  const fon = p.fundamentals.filter((r) => r.year != null).sort((a, b) => (b.year as number) - (a.year as number));

  if (inc.length === 0 && bil.length === 0) {
    const f = fon[0];
    if (!f) return vide;
    return {
      exercice: f.year, source: 'fundamentals',
      resultatNet: f.net_income, chiffreAffaires: f.revenue, capitauxPropres: f.equity, detteFinanciere: f.debt, secondJeu: null,
    };
  }

  const exercice = annee((inc[0] ?? bil[0])!.periode);
  const i = inc.find((r) => annee(r.periode) === exercice) ?? null;
  const b = bil.find((r) => annee(r.periode) === exercice) ?? null;
  const f = fon.find((r) => r.year === exercice) ?? null;

  const detteBilan = b && b.dette_court_terme != null && b.dette_long_terme != null ? b.dette_court_terme + b.dette_long_terme : null;
  const cpBilan = b?.total_capitaux_propres ?? null;
  const memes = memesComptes(cpBilan, f?.equity ?? null);

  return {
    exercice,
    source: 'syscohada',
    resultatNet: i ? i.resultat_net : f?.net_income ?? null,
    chiffreAffaires: i ? i.revenu_total : f?.revenue ?? null,
    capitauxPropres: cpBilan ?? f?.equity ?? null,
    // La dette déclarée de `fundamentals` n'est reprise que si elle relève des mêmes comptes que le bilan.
    detteFinanciere: detteBilan ?? (memes ? f?.debt ?? null : null),
    secondJeu: cpBilan != null && f?.equity != null && !memes ? { capitauxPropres: f.equity } : null,
  };
}

/**
 * Mention du second jeu de comptes. Elle ne cite que ce qui est en base (les
 * capitaux propres) : le résultat de l'autre jeu n'y figure pas, on ne
 * l'invente pas.
 */
export function mentionSecondJeu(s: ExerciceRetenu['secondJeu']): string | null {
  if (!s) return null;
  return `La société publie aussi un second jeu de comptes (IFRS) : capitaux propres ${fmtFcfa(s.capitauxPropres)} FCFA. Les ratios sont calculés sur les comptes SYSCOHADA.`;
}

/**
 * Lecture de la séance — PUR.
 *
 * Repris du tableau de bord v2 (supprimé le 2026-11-11, redirigé vers
 * /dashboard) : la même séance pondérée de plusieurs façons, un verdict qui
 * affiche SA règle, et toute la cote sur un axe de variation unique.
 *
 * Tout dérive des lignes de la séance. Aucun chiffre n'est écrit en dur, rien
 * n'est inventé : une donnée absente est déclarée (capitaux estimés,
 * pondération par transactions retirée), jamais remplacée par un zéro.
 */

export interface LigneSeanceBrute {
  code: string;
  designation: string | null;
  variation_pct: number | null;
  valeur_echangee: number | null;
  cours_jour: number | null;
  volume: number | null;
  nb_transactions: number | null;
}

/** Une pondération de la même séance (forme attendue par la bascule). */
export interface Ponderation {
  cle: string;
  libelle: string;
  unite: string;
  qualificatif: string;
  baisse: number;
  stable: number;
  hausse: number;
  etiqBaisse: string;
  etiqHausse: string;
}

/** Une valeur sur l'axe unique (forme attendue par le peigne). */
export interface LigneCote {
  code: string;
  nom: string | null;
  variation: number;
  valeurEchangee: number;
  /** null = non publiée par la source ce jour-là (jamais remplacée par 0). */
  transactions: number | null;
  volume: number;
}

export type CodeVerdict = 'a_surveiller' | 'contraste' | 'sans_alerte';

/** Seuils fixés à l'avance, affichés tels quels à l'écran. */
export const SEUIL_COMPOSITE = -1;
export const SEUIL_PART_BAISSIERE = 60;

export interface LectureSeance {
  total: number;
  nbHausses: number;
  nbBaisses: number;
  capitauxEstimes: boolean;
  mesures: Ponderation[];
  /** Part des capitaux (estimés le cas échéant) traités sur des titres en repli, en %. */
  partBaissiere: number;
  verdict: {
    code: CodeVerdict;
    libelle: string;
    compositeVar: number | null;
    testComposite: boolean;
    testCapitaux: boolean;
  };
  plusLourde: { code: string; nom: string | null; partMontant: number; variation: number } | null;
  lignes: LigneCote[];
}

const nf = new Intl.NumberFormat('fr-FR');
const pct1 = (x: number) => x.toFixed(1).replace('.', ',').replace('-', '−');
const part = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

/**
 * La valeur échangée n'est pas publiée par la source intraday certains jours :
 * elle est alors estimée par cours × titres, et la lecture le dit.
 */
function capitaux(a: LigneSeanceBrute): number {
  return a.valeur_echangee ?? (a.cours_jour != null && a.volume != null ? a.cours_jour * a.volume : 0);
}

export function lectureSeance(
  actions: LigneSeanceBrute[],
  compositeVar: number | null,
): LectureSeance | null {
  if (actions.length === 0) return null;

  const hausses = actions.filter((a) => (a.variation_pct ?? 0) > 0);
  const baisses = actions.filter((a) => (a.variation_pct ?? 0) < 0);
  const stables = actions.filter((a) => (a.variation_pct ?? 0) === 0);
  const total = actions.length;

  const capitauxEstimes = actions.every((a) => a.valeur_echangee == null);
  const transactionsConnues = actions.some((a) => a.nb_transactions != null);
  const sommeCapitaux = (rows: LigneSeanceBrute[]) => rows.reduce((s, a) => s + capitaux(a), 0);
  const sommeTransactions = (rows: LigneSeanceBrute[]) => rows.reduce((s, a) => s + (a.nb_transactions ?? 0), 0);
  const veTotal = sommeCapitaux(actions);
  const ntTotal = sommeTransactions(actions);

  const mesures: Ponderation[] = [
    {
      cle: 'valeurs',
      libelle: 'Valeurs',
      unite: 'Une valeur pèse une unité',
      qualificatif: 'le décompte brut',
      baisse: part(baisses.length, total),
      stable: part(stables.length, total),
      hausse: part(hausses.length, total),
      etiqBaisse: String(baisses.length),
      etiqHausse: String(hausses.length),
    },
    // Sans transactions publiées, cette pondération n'est PAS calculable :
    // retirée plutôt qu'affichée à zéro.
    ...(transactionsConnues
      ? [
          {
            cle: 'transactions',
            libelle: 'Transactions',
            unite: 'Une valeur pèse ses transactions',
            qualificatif: 'pondéré par l’activité',
            baisse: part(sommeTransactions(baisses), ntTotal),
            stable: part(sommeTransactions(stables), ntTotal),
            hausse: part(sommeTransactions(hausses), ntTotal),
            etiqBaisse: nf.format(sommeTransactions(baisses)),
            etiqHausse: nf.format(sommeTransactions(hausses)),
          },
        ]
      : []),
    {
      cle: 'capitaux',
      libelle: 'Capitaux',
      unite: capitauxEstimes ? 'Une valeur pèse ses capitaux (estimés)' : 'Une valeur pèse ses capitaux',
      qualificatif: capitauxEstimes ? 'cours × titres échangés' : 'pondéré par l’argent engagé',
      baisse: part(sommeCapitaux(baisses), veTotal),
      stable: part(sommeCapitaux(stables), veTotal),
      hausse: part(sommeCapitaux(hausses), veTotal),
      etiqBaisse: `${pct1(part(sommeCapitaux(baisses), veTotal))} %`,
      etiqHausse: `${pct1(part(sommeCapitaux(hausses), veTotal))} %`,
    },
  ];

  // Toujours la DERNIÈRE pondération (l'entrée « transactions » est facultative).
  const partBaissiere = mesures[mesures.length - 1].baisse;

  const testComposite = compositeVar != null && compositeVar < SEUIL_COMPOSITE;
  const testCapitaux = partBaissiere > SEUIL_PART_BAISSIERE;
  const code: CodeVerdict = testComposite && testCapitaux ? 'a_surveiller' : testComposite || testCapitaux ? 'contraste' : 'sans_alerte';
  const libelle = code === 'a_surveiller' ? 'À surveiller' : code === 'contraste' ? 'Contrasté' : 'Sans alerte';

  const lourde = actions.reduce<LigneSeanceBrute | null>((m, a) => (m == null || capitaux(a) > capitaux(m) ? a : m), null);
  const plusLourde =
    lourde && veTotal > 0
      ? { code: lourde.code, nom: lourde.designation, partMontant: part(capitaux(lourde), veTotal), variation: lourde.variation_pct ?? 0 }
      : null;

  const lignes: LigneCote[] = actions
    .filter((a) => a.variation_pct != null)
    .map((a) => ({
      code: a.code,
      nom: a.designation,
      variation: a.variation_pct as number,
      valeurEchangee: capitaux(a),
      transactions: a.nb_transactions,
      volume: a.volume ?? 0,
    }));

  return {
    total,
    nbHausses: hausses.length,
    nbBaisses: baisses.length,
    capitauxEstimes,
    mesures,
    partBaissiere,
    verdict: { code, libelle, compositeVar, testComposite, testCapitaux },
    plusLourde,
    lignes,
  };
}

/**
 * « Un million de FCFA investi » — module PUR et testé (placement.test.ts).
 *
 * Ce qu'aurait valu aujourd'hui une somme placée sur le titre à la séance
 * d'il y a N ans : valeur du titre seul, puis dividendes nets d'impôt reçus
 * entre-temps, face à la variation de l'indice sur la même période.
 *
 * RÈGLES, TOUTES DITES AU LECTEUR (le panneau les écrit sous le chiffre) :
 *  - achat à la clôture de la séance de départ, sans frais de courtage ;
 *  - nombre de titres fractionnaire (pas d'arrondi à l'unité) ;
 *  - dividendes perçus en numéraire et NON réinvestis ;
 *  - dividendes NETS d'impôt. `dividends.montant` est SOUVENT DÉJÀ NET
 *    (`base_fiscale = 'net'`, migration 0130) : on n'ôte l'impôt que d'un
 *    montant BRUT, au taux du pays (même règle que `rendementNetSelonBase`,
 *    lib/tax/compute.ts). Une base inconnue n'est PAS supposée : le dividende
 *    est écarté et compté, jamais deviné ;
 *  - un dividende sans date de détachement n'est rattaché à une année (celle qui
 *    suit son exercice) que si cette année est ENTIÈREMENT à l'intérieur de la
 *    période : à cette condition seulement il est certain d'avoir été versé
 *    après l'achat et avant aujourd'hui, quelle que soit sa date exacte ;
 *  - si l'historique ne remonte pas jusqu'à N ans, on prend la plus longue
 *    période disponible et le résultat le dit (`periode_reduite`).
 *
 * Les cours de la base sont ajustés des opérations sur titres (fractionnement
 * de SNTS, octobre 2026) : une variation de cours sur plusieurs années reste donc
 * lisible. Aucune estimation : une donnée qui manque devient `null` ou un
 * compteur d'exclusions.
 */

export interface PointSerie { date: string; close: number }

export interface DividendePlacement {
  exercice: number | null;
  montant: number | null;
  ex_date: string | null;
  payment_date: string | null;
  base_fiscale: 'brut' | 'net' | 'inconnu' | null;
}

export interface EntreePlacement {
  investi: number;
  /** Clôtures du titre, de la plus ancienne à la plus récente (clôtures nulles déjà écartées). */
  serie: PointSerie[];
  /** Valeurs de l'indice de cours (BRVM Composite), de la plus ancienne à la plus récente. */
  serieIndice: PointSerie[];
  dividendes: DividendePlacement[];
  /** Taux de l'impôt sur le revenu des valeurs mobilières du pays ; null si non vérifié. */
  tauxIrvm: number | null;
  /** Durée visée, en années. */
  annees?: number;
}

export interface ResultatPlacement {
  investi: number;
  date_depart: string;
  date_fin: string;
  cours_depart: number;
  cours_fin: number;
  duree_jours: number;
  /** Vrai si l'historique est plus court que la durée visée. */
  periode_reduite: boolean;
  annees_visees: number;
  titres: number;
  /** Valeur du titre seul, dividendes exclus. */
  valeur_cours: number;
  /** Fraction (0,35 = +35 %). */
  variation_cours: number;
  dividendes_nets: number;
  nb_dividendes: number;
  /** Dividendes dans la période dont la base fiscale n'est pas établie : non comptés. */
  dividendes_exclus_base: number;
  /** Dividendes sans date exploitable dans la période : non comptés. */
  dividendes_non_dates: number;
  valeur_totale: number;
  rendement_total: number;
  /** Variation de l'indice sur la même période, ou null (voir `indice_raison`). */
  variation_indice: number | null;
  indice_raison: string | null;
}

/** Sous cette durée, un « placement » ne dit plus rien d'un rendement. */
export const DUREE_MIN_JOURS = 180;
/** Tolérance entre le début de la période et le premier point de l'indice. */
const TOLERANCE_INDICE_JOURS = 7;

const jours = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

function moinsAnnees(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
}

const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

/** Un dividende par exercice : la ligne datée l'emporte sur une ligne sans date. */
function uniques(divs: DividendePlacement[]): DividendePlacement[] {
  const parExercice = new Map<string, DividendePlacement>();
  let rang = 0;
  for (const d of divs) {
    if (d.montant == null || !(d.montant > 0)) continue;
    rang += 1;
    const cle = d.exercice != null ? `e${d.exercice}` : `d${d.ex_date ?? d.payment_date ?? `?${rang}`}`;
    const existant = parExercice.get(cle);
    const date = d.ex_date ?? d.payment_date;
    if (!existant || (date != null && (existant.ex_date ?? existant.payment_date) == null)) parExercice.set(cle, d);
  }
  return [...parExercice.values()];
}

export function placement(e: EntreePlacement): ResultatPlacement | null {
  const annees = e.annees ?? 5;
  const s = e.serie.filter((p) => Number.isFinite(p.close) && p.close > 0);
  if (s.length < 2 || !(e.investi > 0)) return null;
  const fin = s[s.length - 1]!;
  const cible = moinsAnnees(fin.date, annees);
  const reduite = s[0]!.date > cible;
  const depart = reduite ? s[0]! : s.find((p) => p.date >= cible)!;
  const duree = jours(depart.date, fin.date);
  if (duree < DUREE_MIN_JOURS) return null;

  const titres = e.investi / depart.close;
  const valeurCours = titres * fin.close;

  const anneeDepart = Number(depart.date.slice(0, 4));
  const anneeFin = Number(fin.date.slice(0, 4));
  let net = 0;
  let compte = 0;
  let exclusBase = 0;
  let nonDates = 0;
  for (const d of uniques(e.dividendes)) {
    const date = d.ex_date ?? d.payment_date;
    let dansPeriode: boolean;
    if (date != null) {
      dansPeriode = date > depart.date && date <= fin.date;
    } else if (d.exercice != null) {
      const a = d.exercice + 1;
      if (a > anneeDepart && a < anneeFin) dansPeriode = true;
      else {
        // Année de bord : peut-être dans la période, peut-être non. Déclaré, pas deviné.
        if (a === anneeDepart || a === anneeFin) nonDates += 1;
        continue;
      }
    } else {
      continue;
    }
    if (!dansPeriode) continue;
    let montantNet: number | null = null;
    if (d.base_fiscale === 'net') montantNet = d.montant!;
    else if (d.base_fiscale === 'brut' && e.tauxIrvm != null) montantNet = d.montant! * (1 - e.tauxIrvm);
    if (montantNet == null) {
      exclusBase += 1;
      continue;
    }
    net += montantNet * titres;
    compte += 1;
  }

  const valeurTotale = valeurCours + net;

  let variationIndice: number | null = null;
  let raison: string | null = null;
  const idx = e.serieIndice.filter((p) => Number.isFinite(p.close) && p.close > 0);
  if (idx.length === 0) {
    raison = 'Aucune valeur de l’indice BRVM Composite en base.';
  } else if (jours(idx[0]!.date, depart.date) < -TOLERANCE_INDICE_JOURS) {
    raison = `L’historique de l’indice BRVM Composite en base ne commence que le ${fmtDate(idx[0]!.date)} : la comparaison sur la période (depuis le ${fmtDate(depart.date)}) n’est pas possible.`;
  } else {
    const avant = [...idx].reverse().find((p) => p.date <= depart.date) ?? idx[0]!;
    const apres = [...idx].reverse().find((p) => p.date <= fin.date);
    if (apres && apres.date > avant.date) variationIndice = apres.close / avant.close - 1;
    else raison = 'Historique de l’indice trop court pour la période.';
  }

  return {
    investi: e.investi,
    date_depart: depart.date,
    date_fin: fin.date,
    cours_depart: depart.close,
    cours_fin: fin.close,
    duree_jours: duree,
    periode_reduite: reduite,
    annees_visees: annees,
    titres,
    valeur_cours: valeurCours,
    variation_cours: fin.close / depart.close - 1,
    dividendes_nets: net,
    nb_dividendes: compte,
    dividendes_exclus_base: exclusBase,
    dividendes_non_dates: nonDates,
    valeur_totale: valeurTotale,
    rendement_total: valeurTotale / e.investi - 1,
    variation_indice: variationIndice,
    indice_raison: raison,
  };
}

/** « 4 ans et 11 mois », « 8 mois », « 5 ans » — durée arrondie au mois, en français. */
export function dureeFr(jours: number): string {
  const mois = Math.max(0, Math.round(jours / 30.4375));
  const a = Math.floor(mois / 12);
  const m = mois % 12;
  const ans = a > 0 ? `${a} an${a > 1 ? 's' : ''}` : '';
  const mm = m > 0 ? `${m} mois` : '';
  return [ans, mm].filter(Boolean).join(' et ') || 'moins d’un mois';
}

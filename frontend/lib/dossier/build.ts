import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeRatios,
  pickBestFundamental,
  fusionnerExercices,
  qualiteResultat,
  croissanceCA,
  expliqueDetachement,
  type FundamentalRow,
  type LigneResultat,
  type Ratios,
  type QualiteResultat,
  type Detachement,
} from '@/lib/fundamentals';
import { computeLevels, type Levels } from '@/lib/hebdo/levels';

/**
 * Dossier valeur — la matière d'un rapport illustré, panneau par panneau.
 *
 * POURQUOI CE MODULE. Le pipeline d'export existant est piloté par la PROSE :
 * l'IA rédige, `parseReponseIA` découpe le texte, `pdfTemplate` met en page.
 * La qualité du document dépend donc entièrement de ce que le modèle a bien
 * voulu écrire — et lorsqu'il se trompe d'un facteur, rien ne le rattrape.
 *
 * Ici c'est l'inverse : chaque chiffre est LU ou CALCULÉ, jamais rédigé. Le
 * modèle n'intervient que sur les panneaux d'appréciation (forces, risques,
 * scénarios, conclusion), et seulement à partir des valeurs ci-dessous.
 *
 * RÈGLE : un champ absent vaut `null` et se dit. Aucune estimation, jamais.
 *
 * Complète `lib/reports.ts` (`buildInstrumentReport`), qui couvre la série de
 * cours, les indicateurs canoniques et les événements, mais ni les
 * fondamentaux, ni les ratios, ni le dividende, ni la qualité du résultat.
 */

// ── Panneaux ────────────────────────────────────────────────────────────────

/** Panneau « l'entreprise en bref ». */
export interface Identite {
  code: string;
  designation: string | null;
  secteur: string | null;
  pays: string | null;
  actions: number | null;
  flottant: number | null;
  notation: {
    note: string | null;
    agence: string | null;
    long_terme: string | null;
    court_terme: string | null;
    perspective: string | null;
    date_notation: string | null;
    /** Années consécutives à note identique, la plus récente comprise. */
    annees_stables: number | null;
  } | null;
}

/** Panneau « chiffres clés » de l'exercice le plus récent. */
export interface ChiffresCles {
  exercice: string | null;
  cours: number | null;
  date_cours: string | null;
  variation_veille_pct: number | null;
  capitalisation: number | null;
  chiffre_affaires: number | null;
  resultat_net: number | null;
  capitaux_propres: number | null;
  dette: number | null;
  croissance_ca_1an: number | null;
  croissance_ca_2ans: number | null;
  variation_capitaux_propres_1an: number | null;
}

/** Panneau « évolution des principaux indicateurs ». */
export interface PointAnnuel {
  exercice: string;
  chiffre_affaires: number | null;
  resultat_net: number | null;
}

/** Panneau « focus dividende ». */
export interface FocusDividende {
  /**
   * Montant tel que stocké dans `dividends`. On ne le qualifie NI de brut NI
   * de net : la table ne le précise pas, et trancher changerait le rendement
   * affiché. Le rapport présente ce champ sans étiquette fiscale tant que la
   * source n'est pas établie.
   *
   * ÉTAT DE LA VÉRIFICATION AU 2026-09-14 — à ne pas trancher sans preuve.
   * Les deux sources ne sont PAS sur la même base, et le désaccord n'est pas
   * systématique :
   *   - richbourse.com/common/dividende/index affirme en toutes lettres
   *     « Les montants affichés sont-ils bruts ou nets ? Ils sont nets :
   *     l'IRVM est déjà retenu à la source » ;
   *   - pour NEIC, sikafinance publie 159,54 quand richbourse publie 140,40,
   *     soit exactement le rapport 0,88 de l'IRVM à 12 % ;
   *   - mais pour TRACTAFRIC, les deux publient 183,92, à l'identique.
   * Un écart de 12 % sur une valeur et zéro sur une autre interdit de conclure.
   * Le champ reste donc SANS étiquette fiscale, et le rapport doit le
   * présenter tel quel.
   *
   * Conséquence à ne pas oublier : `payout` mélange potentiellement un
   * dividende net et un BPA brut. Sur NEIC il vaut 88 % ; si 159,54 est bien
   * le brut, le vrai taux de distribution est de 100 %.
   *
   * Garde-fou distinct, celui-là certain : ne JAMAIS reprendre
   * `income_statements.dividende_par_action`. Sur NEIC ce champ vaut 3 989 sur
   * la ligne détaillée — le parseur y a recopié le bénéfice par action calculé
   * sur l'ancien comptage d'actions.
   */
  montant: number | null;
  /**
   * `net` (IRVM retenu à la source), `brut`, ou `inconnu` si la source ne le
   * précise pas. Renseigné en base par la migration 0130 et son déclencheur.
   * Le rapport DOIT afficher cette qualité à côté du montant : « 140,40 net »
   * et « 140,40 » ne disent pas la même chose à 12 % près.
   */
  base_fiscale: 'brut' | 'net' | 'inconnu' | null;
  source: string | null;
  exercice: number | null;
  ex_date: string | null;
  payment_date: string | null;
  rendement: number | null;
  payout: number | null;
  /** Historique par exercice, zéros compris — l'irrégularité est une information. */
  historique: { exercice: number | null; montant: number | null }[];
  exercices_sans_dividende: number;
}

/** Panneau « analyse technique » — repris du moteur, jamais recalculé. */
export interface Technique {
  date_signal: string | null;
  signal: string | null;
  score_total: number | null;
  confiance: number | null;
  explication: string | null;
  rsi: number | null;
  ma20: number | null;
  ma50: number | null;
  /**
   * Le champ stocké s'appelle `macd_line`, pas `macd` — lire `inputs.macd`
   * rendait silencieusement `null`. Vérifié sur NEIC : la clé existante est
   * bien `macd_line`, accompagnée de `macd_signal`.
   */
  macd_line: number | null;
  macd_signal: number | null;
  /** Clôtures pour le graphique, du plus ancien au plus récent. */
  serie: { date: string; cours: number | null; volume: number | null }[];
}

export interface DossierValeur {
  genere_le: string;
  identite: Identite;
  chiffres_cles: ChiffresCles;
  trajectoire: PointAnnuel[];
  dividende: FocusDividende;
  detachement: Detachement | null;
  technique: Technique;
  ratios: Ratios | null;
  qualite_resultat: QualiteResultat | null;
  /**
   * Support, résistance et extensions du canal 20 séances. Réutilise le module
   * PUR ET TESTÉ de l'analyse hebdomadaire plutôt que d'en écrire un second :
   * deux jeux de niveaux pour la même valeur se contrediraient tôt ou tard.
   * `null` sous 22 séances — un canal tiré de moins ne décrit rien.
   */
  niveaux: Levels | null;
  /**
   * Ce que le dossier NE PEUT PAS dire, et pourquoi. Rendu tel quel dans le
   * document : une case vide sans explication ressemble à un oubli, une case
   * vide expliquée est une information.
   */
  lacunes: string[];
}

// ── Construction ────────────────────────────────────────────────────────────

interface RowNotation {
  note?: string | null;
  agence?: string | null;
  long_terme?: string | null;
  court_terme?: string | null;
  perspective?: string | null;
  date_notation?: string | null;
  history?: { note?: string | null; date_notation?: string | null }[];
}

function litNotation(brut: unknown): Identite['notation'] {
  if (!brut || typeof brut !== 'object') return null;
  const n = brut as RowNotation;
  const hist = Array.isArray(n.history) ? n.history : [];
  /* `history` CONTIENT la notation courante en tête (vérifié sur NEIC : même
     date 2025-12-01 au niveau racine et en history[0]). Compter « 1 + les
     entrées » annonçait 4 exercices stables là où il y en a 3. La notation
     courante n'est ajoutée que si elle est absente de l'historique. */
  let stables = 0;
  for (const h of hist) {
    if (h?.note && n.note && h.note === n.note) stables += 1;
    else break;
  }
  const couranteDansHistorique = hist[0]?.date_notation != null && hist[0].date_notation === n.date_notation;
  if (n.note && !couranteDansHistorique) stables += 1;
  return {
    note: n.note ?? null,
    agence: n.agence ?? null,
    long_terme: n.long_terme ?? null,
    court_terme: n.court_terme ?? null,
    perspective: n.perspective ?? null,
    date_notation: n.date_notation ?? null,
    annees_stables: stables > 0 ? stables : null,
  };
}

export async function buildDossier(
  sb: SupabaseClient,
  code: string,
  options: { seances?: number } = {},
): Promise<DossierValeur | null> {
  const seances = Math.min(options.seances ?? 90, 400);
  const CODE = code.toUpperCase();

  const [
    { data: instr },
    { data: hist },
    { data: sig },
    { data: divs },
    { data: fundsRows },
    { data: isRows },
  ] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur, pays, shares, flottant, notation_json').eq('code', CODE).maybeSingle(),
    sb.from('brvm_actions_daily').select('date_marche, cours_jour, variation_pct, volume').eq('code', CODE).order('date_marche', { ascending: false }).limit(seances),
    sb.from('signals_daily').select('date_marche, signal, score_total, confiance, explication, inputs').eq('code', CODE).order('date_marche', { ascending: false }).limit(1).maybeSingle(),
    // `nullsFirst: false` : sans lui, les lignes datées passent DERRIÈRE les
    // NULL et sortent de la fenêtre. Même piège que dans briefTools.ts.
    sb.from('dividends').select('exercice, montant, ex_date, payment_date, base_fiscale, source').eq('code', CODE).order('ex_date', { ascending: false, nullsFirst: false }).limit(12),
    sb.from('fundamentals').select('year, revenue, net_income, equity, debt').eq('code', CODE).order('year', { ascending: false }).limit(6),
    sb.from('income_statements').select('periode, revenu_total, resultat_exploitation, resultat_avant_impots, resultat_net').eq('code', CODE).order('periode', { ascending: false }).limit(14),
  ]);

  if (!instr) return null;

  const lacunes: string[] = [];
  const lignes = (hist ?? []) as { date_marche: string; cours_jour: number | null; variation_pct: number | null; volume: number | null }[];
  const serie = lignes.slice().reverse();
  const derniere = lignes[0] ?? null;
  const cours = derniere?.cours_jour ?? null;
  const actions = (instr as { shares?: number | null }).shares ?? null;

  if (cours == null) lacunes.push('Aucune cotation récente : les ratios de valorisation ne sont pas calculables.');
  if (actions == null) lacunes.push("Nombre d'actions inconnu : capitalisation, bénéfice par action et PER indisponibles.");

  const exercices = fusionnerExercices((isRows ?? []) as LigneResultat[]);
  const fondaRows = (fundsRows ?? []) as FundamentalRow[];
  const fonda = pickBestFundamental(fondaRows);
  if (!fonda) lacunes.push('Aucun état financier exploitable en base pour cette société.');

  /* Le dividende retenu est le plus récent STRICTEMENT POSITIF. Un zéro est
     une information pour l'historique, jamais une base de rendement. */
  const dividendes = (divs ?? []) as {
    exercice: number | null;
    montant: number | null;
    ex_date: string | null;
    payment_date: string | null;
    base_fiscale: 'brut' | 'net' | 'inconnu' | null;
    source: string | null;
  }[];
  const divRetenu = dividendes.find((d) => Number(d.montant) > 0) ?? null;
  if (!divRetenu) lacunes.push('Aucun dividende positif enregistré : rendement et taux de distribution non calculables.');

  /* Une base fiscale inconnue vaut 12 % d'incertitude sur le rendement : c'est
     l'écart de l'IRVM. Le taire reviendrait à publier un pourcentage dont on
     ne sait pas s'il est net ou brut. */
  if (divRetenu && (divRetenu.base_fiscale == null || divRetenu.base_fiscale === 'inconnu')) {
    lacunes.push(
      `La source « ${divRetenu.source ?? 'inconnue'} » ne précise pas si le dividende est brut ou net : ` +
        `le rendement affiché est incertain à hauteur de l'IRVM (12 %).`,
    );
  }

  const ratios = fonda
    ? computeRatios({
        cours,
        shares: actions,
        revenue: fonda.revenue,
        net_income: fonda.net_income,
        equity: fonda.equity,
        debt: (fonda as { debt?: number | null }).debt ?? null,
        dividende: divRetenu?.montant ?? null,
      })
    : null;

  /* Rapporter un dividende NET à un bénéfice par action BRUT minore le taux de
     distribution. Sur NEIC : 88 % affichés, 100 % réels si le brut vaut bien
     159,54. Ce contrôle vient après `ratios`, qui porte le payout. */
  if (divRetenu?.base_fiscale === 'net' && ratios?.payout != null) {
    lacunes.push(
      'Le taux de distribution rapporte un dividende NET à un bénéfice par action brut : ' +
        "il est donc minoré d'environ 12 %.",
    );
  }

  const qualite = qualiteResultat(exercices[0]);
  if (qualite && qualite.part_non_operationnelle == null) {
    lacunes.push(
      "Le résultat d'exploitation n'est pas renseigné pour le dernier exercice : impossible de dire quelle part du bénéfice vient de l'activité.",
    );
  }

  /* Détachement : uniquement si l'ex-date tombe sur une séance connue ET que
     la veille existe. Sans les deux cours, la décomposition n'a aucun sens. */
  let detachement: Detachement | null = null;
  const divDate = dividendes.find((d) => d.ex_date != null && Number(d.montant) > 0);
  if (divDate?.ex_date) {
    const i = lignes.findIndex((h) => h.date_marche === divDate.ex_date);
    if (i >= 0 && lignes[i + 1]) {
      detachement = expliqueDetachement(
        String(divDate.ex_date),
        Number(divDate.montant),
        lignes[i + 1].cours_jour,
        lignes[i].cours_jour,
      );
    }
  }

  /* Les clôtures nulles sont ÉCARTÉES, pas remplacées : un zéro en base est un
     trou de collecte. Les inclure écraserait le support du canal à 0. */
  const closes = serie.map((r) => r.cours_jour).filter((c): c is number => c != null && c > 0);
  const niveaux = computeLevels(closes);
  if (!niveaux) {
    lacunes.push(
      `Moins de 22 séances cotées disponibles (${closes.length}) : support, résistance et objectifs ne sont pas établissables.`,
    );
  }

  const s = sig as { date_marche?: string; signal?: string; score_total?: number; confiance?: number; explication?: string; inputs?: Record<string, number | null> } | null;
  const inputs = s?.inputs ?? {};
  const cpPrecedent = fondaRows[1]?.equity ?? null;

  return {
    genere_le: new Date().toISOString().slice(0, 10),
    identite: {
      code: CODE,
      designation: (instr as { designation?: string | null }).designation ?? null,
      secteur: (instr as { secteur?: string | null }).secteur ?? null,
      pays: (instr as { pays?: string | null }).pays ?? null,
      actions,
      flottant: (instr as { flottant?: number | null }).flottant ?? null,
      notation: litNotation((instr as { notation_json?: unknown }).notation_json),
    },
    chiffres_cles: {
      exercice: exercices[0]?.periode ?? (fonda?.year != null ? String(fonda.year) : null),
      cours,
      date_cours: derniere?.date_marche ?? null,
      variation_veille_pct: derniere?.variation_pct ?? null,
      capitalisation: ratios?.capitalisation ?? null,
      chiffre_affaires: fonda?.revenue ?? null,
      resultat_net: fonda?.net_income ?? null,
      capitaux_propres: fonda?.equity ?? null,
      dette: (fonda as { debt?: number | null } | null)?.debt ?? null,
      croissance_ca_1an: croissanceCA(exercices, 1),
      croissance_ca_2ans: croissanceCA(exercices, 2),
      variation_capitaux_propres_1an:
        fonda?.equity != null && cpPrecedent != null && cpPrecedent !== 0
          ? (fonda.equity - cpPrecedent) / Math.abs(cpPrecedent)
          : null,
    },
    trajectoire: exercices
      .slice()
      .reverse()
      .map((e) => ({ exercice: e.periode, chiffre_affaires: e.revenu_total, resultat_net: e.resultat_net })),
    dividende: {
      montant: divRetenu?.montant ?? null,
      base_fiscale: divRetenu?.base_fiscale ?? null,
      source: divRetenu?.source ?? null,
      exercice: divRetenu?.exercice ?? null,
      ex_date: divRetenu?.ex_date ?? null,
      payment_date: divRetenu?.payment_date ?? null,
      rendement: ratios?.rendementDiv ?? null,
      payout: ratios?.payout ?? null,
      historique: dividendes
        .filter((d) => d.exercice != null)
        .slice()
        .sort((a, b) => (a.exercice ?? 0) - (b.exercice ?? 0))
        .map((d) => ({ exercice: d.exercice, montant: d.montant })),
      exercices_sans_dividende: dividendes.filter((d) => d.exercice != null && Number(d.montant) === 0).length,
    },
    detachement,
    technique: {
      date_signal: s?.date_marche ?? null,
      signal: s?.signal ?? null,
      score_total: s?.score_total ?? null,
      confiance: s?.confiance ?? null,
      explication: s?.explication ?? null,
      rsi: inputs.rsi ?? null,
      ma20: inputs.ma20 ?? null,
      ma50: inputs.ma50 ?? null,
      macd_line: inputs.macd_line ?? null,
      macd_signal: inputs.macd_signal ?? null,
      serie: serie.map((r) => ({ date: r.date_marche, cours: r.cours_jour, volume: r.volume })),
    },
    ratios,
    qualite_resultat: qualite,
    niveaux,
    lacunes,
  };
}

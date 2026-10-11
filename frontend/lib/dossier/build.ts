import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeRatios,
  pickBestFundamental,
  fusionnerExercices,
  exercicesAnnuels,
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
import { lectureIntermediaire, type LectureIntermediaire } from '@/lib/financials/interim';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import type { ComparaisonMedianes } from '@/lib/diagnostic/medianes';
import { performanceTitre, piliersThese, controleExDate, rentabiliteActif, fiscaliteDividende, notationDepassee, type PerformanceTitre, type Pilier } from './suivi';

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
  /** Nom du pays (« Sénégal »), jamais le code du référentiel. */
  pays: string | null;
  /** Taux de l'impôt sur le revenu des valeurs mobilières du pays, ou null s'il n'est pas vérifié. */
  taux_irvm: number | null;
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
    /** Date d'un communiqué de notation PLUS RÉCENT que la note : elle est alors à confirmer. */
    communique_plus_recent: string | null;
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
  /** `ex_date` = séance réellement comparée ; `ex_date_officielle` = date publiée
   *  (elle peut tomber un jour sans séance : Ascension, 14/05/2026 pour SNTS). */
  detachement: (Detachement & { ex_date_officielle: string }) | null;
  technique: Technique;
  ratios: Ratios | null;
  qualite_resultat: QualiteResultat | null;
  /** Sur l'actif total du bilan quand il existe ; sinon sur les capitaux investis, sous ce nom. */
  rentabilite_actif: { valeur: number; mesure: 'actif_total' | 'capitaux_investis' } | null;
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
  /** Feuille « Suivi » : tout est mesuré, rien n'est recommandé. */
  suivi: Suivi;
}

export interface Suivi {
  famille: 'banque' | 'assurance' | 'general';
  /** Dernière publication intermédiaire contre la même période un an plus tôt (lib/financials/interim). */
  intermediaire: LectureIntermediaire | null;
  performance: PerformanceTitre;
  liquidite: {
    date_marche: string;
    score: number | null;
    classe: string | null;
    spread_pct: number | null;
    spread_source: 'carnet' | 'roll' | null;
    valeur_moyenne_30j: number | null;
  } | null;
  /** Médianes des sociétés comparables (dernier calcul Combined Alpha), si fournies. */
  medianes: ComparaisonMedianes | null;
  piliers: Pilier[];
  /** Rendez-vous DATÉS et à venir connus en base — jamais une date estimée. */
  rendez_vous: { date: string; libelle: string }[];
  /** Le jour du détachement a-t-il vu une baisse cohérente avec le dividende ? */
  ex_date_controle: 'coherente' | 'a_verifier' | null;
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
    communique_plus_recent: null,
  };
}

export async function buildDossier(
  sb: SupabaseClient,
  code: string,
  /** `medianes` : chargées par l'appelant avec le client serveur (chargerContexteQuant). */
  options: { seances?: number; medianes?: ComparaisonMedianes | null } = {},
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
    sb.from('brvm_actions_daily').select('date_marche, cours_jour, variation_pct, volume, cours_haut_52s, cours_bas_52s').eq('code', CODE).order('date_marche', { ascending: false }).limit(seances),
    sb.from('signals_daily').select('date_marche, signal, score_total, confiance, explication, inputs').eq('code', CODE).order('date_marche', { ascending: false }).limit(1).maybeSingle(),
    // `nullsFirst: false` : sans lui, les lignes datées passent DERRIÈRE les
    // NULL et sortent de la fenêtre. Même piège que dans briefTools.ts.
    sb.from('dividends').select('exercice, montant, ex_date, payment_date, base_fiscale, source').eq('code', CODE).order('ex_date', { ascending: false, nullsFirst: false }).limit(12),
    sb.from('fundamentals').select('year, revenue, net_income, equity, debt').eq('code', CODE).order('year', { ascending: false }).limit(6),
    sb.from('income_statements').select('periode, revenu_total, resultat_exploitation, resultat_avant_impots, resultat_net').eq('code', CODE).order('periode', { ascending: false }).limit(14),
  ]);

  if (!instr) return null;

  const lacunes: string[] = [];
  const lignes = (hist ?? []) as {
    date_marche: string;
    cours_jour: number | null;
    variation_pct: number | null;
    volume: number | null;
    cours_haut_52s: number | null;
    cours_bas_52s: number | null;
  }[];
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

  /* UNE SEULE PÉRIODE DE RÉFÉRENCE : l'exercice ANNUEL des montants affichés.
     Libellé, croissance, qualité du résultat et trajectoire la lisent toutes.
     Avant le 2026-10-11, le libellé venait de la période la plus récente
     triée comme du texte (« 2026-T1 ») pendant que les montants venaient de
     l'annuel 2025 — et la croissance comparait un trimestre à un semestre. */
  const exerciceRef = fonda?.year != null ? String(fonda.year) : exercicesAnnuels(exercices)[0]?.periode ?? null;
  const annuels = exercicesAnnuels(exercices).filter((e) => exerciceRef == null || Number(e.periode) <= Number(exerciceRef));
  const annuelRef = annuels[0]?.periode === exerciceRef ? annuels : [];
  const { data: bilanRef } = exerciceRef
    ? await sb.from('balance_sheets').select('total_actifs').eq('code', CODE).eq('periode', exerciceRef).eq('type_periode', 'annuel').maybeSingle()
    : { data: null };
  const fisc = fiscaliteDividende((instr as { pays?: string | null }).pays ?? null);
  const notation = litNotation((instr as { notation_json?: unknown }).notation_json);
  if (notation) {
    const { data: communiques } = await sb.from('publications').select('date_publication')
      .eq('code', CODE).ilike('libelle', '%notation%').order('date_publication', { ascending: false }).limit(5);
    notation.communique_plus_recent = notationDepassee(
      notation.date_notation,
      ((communiques ?? []) as { date_publication: string | null }[]).map((c) => c.date_publication).filter((x): x is string => !!x),
    );
    if (notation.communique_plus_recent) {
      lacunes.push(
        `Un communiqué de notation publié le ${notation.communique_plus_recent.split('-').reverse().join('/')} est plus récent que la note enregistrée : celle-ci est à confirmer.`,
      );
    }
  }
  const tauxIrvm = fisc.taux != null ? `${Math.round(fisc.taux * 1000) / 10} %`.replace('.', ',') : null;

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

  /* Une base fiscale inconnue rend le rendement incertain du taux de l'impôt sur
     le revenu des valeurs mobilières, qui dépend du pays. Le taire reviendrait à publier un pourcentage dont on
     ne sait pas s'il est net ou brut. */
  if (divRetenu && (divRetenu.base_fiscale == null || divRetenu.base_fiscale === 'inconnu')) {
    lacunes.push(
      `La source « ${divRetenu.source ?? 'inconnue'} » ne précise pas si le dividende est brut ou net : ` +
        (tauxIrvm
          ? `le rendement affiché est incertain à hauteur de l'impôt sur le revenu des valeurs mobilières (${tauxIrvm} au ${fisc.pays}).`
          : "le rendement affiché est incertain à hauteur de l'impôt sur le revenu des valeurs mobilières, dont le taux dépend du pays de l'émetteur."),
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
        (tauxIrvm ? `il est donc minoré d'environ ${tauxIrvm}.` : "il est donc minoré du taux de l'impôt retenu à la source."),
    );
  }

  const qualite = qualiteResultat(annuelRef[0]);
  if (qualite && qualite.part_non_operationnelle == null) {
    lacunes.push(
      "Le résultat d'exploitation n'est pas renseigné pour le dernier exercice : impossible de dire quelle part du bénéfice vient de l'activité.",
    );
  }

  /* Détachement : la séance de détachement est la PREMIÈRE séance à partir de
     l'ex-date, la veille la dernière séance avant. Lues par une requête dédiée :
     la fenêtre des 90 dernières séances ne contient souvent pas l'ex-date
     (SNTS, détachement du 14/05/2026, fenêtre ouverte le 11/06), et l'ex-date
     publiée peut tomber un jour sans séance (le 14/05/2026, jour de
     l'Ascension). Sans les deux cours, pas de décomposition. */
  let detachement: (Detachement & { ex_date_officielle: string }) | null = null;
  const divDate = dividendes.find((d) => d.ex_date != null && Number(d.montant) > 0);
  if (divDate?.ex_date) {
    const decale = (iso: string, j: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + j * 86400000).toISOString().slice(0, 10);
    const { data: autour } = await sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', CODE)
      .gte('date_marche', decale(divDate.ex_date, -10))
      .lte('date_marche', decale(divDate.ex_date, 10))
      .gt('cours_jour', 0)
      .order('date_marche', { ascending: true });
    const seances = (autour ?? []) as { date_marche: string; cours_jour: number }[];
    const ex = seances.find((h) => h.date_marche >= divDate.ex_date!);
    const veille = [...seances].reverse().find((h) => h.date_marche < divDate.ex_date!);
    const base = ex && veille ? expliqueDetachement(ex.date_marche, Number(divDate.montant), veille.cours_jour, ex.cours_jour) : null;
    if (base) detachement = { ...base, ex_date_officielle: divDate.ex_date };
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

  /* ── Suivi : performance, liquidité, publication intermédiaire, piliers ── */
  const famille = (FAMILLE_PAR_CODE[CODE] ?? 'general') as Suivi['famille'];
  const debutAnnee = derniere?.date_marche ? `${derniere.date_marche.slice(0, 4)}-01-01` : null;
  /* Base « depuis le 1er janvier » = DERNIÈRE CLÔTURE DE L'ANNÉE PRÉCÉDENTE,
     convention du Bulletin officiel. La première séance de l'année (ancienne
     base) faisait dire +73,0 % au dossier SNTS là où la BRVM publie +72,21 %
     (44 980 / 26 120, clôture du 31/12/2025). */
  const [{ data: premierAn }, { data: liq }] = await Promise.all([
    debutAnnee
      ? sb.from('brvm_actions_daily').select('cours_jour').eq('code', CODE).lt('date_marche', debutAnnee)
          .gt('cours_jour', 0).order('date_marche', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from('liquidity_daily').select('date_marche, score, classe, spread_pct, spread_source, valeur_moyenne_30j')
      .eq('code', CODE).order('date_marche', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const performance = performanceTitre({
    closes,
    coursDebutAnnee: (premierAn as { cours_jour?: number | null } | null)?.cours_jour ?? null,
    haut52: derniere?.cours_haut_52s ?? null,
    bas52: derniere?.cours_bas_52s ?? null,
  });
  // Un dividende par exercice (le premier connu), du plus ancien au plus récent.
  const divParExercice = new Map<number, number>();
  for (const dv of [...dividendes].sort((a, b) => (a.exercice ?? 0) - (b.exercice ?? 0))) {
    if (dv.exercice != null && dv.montant != null && !divParExercice.has(dv.exercice)) divParExercice.set(dv.exercice, Number(dv.montant));
  }
  const medianes = options.medianes ?? null;
  const piliers = piliersThese({
    famille,
    croissanceCA: croissanceCA(annuelRef, 1),
    margeExp: qualite?.marge_exploitation ?? null,
    margeExpPrecedente: qualiteResultat(annuelRef[1])?.marge_exploitation ?? null,
    roe: ratios?.roe ?? null,
    endettement: ratios?.gearing ?? null,
    dividendes: [...divParExercice.values()],
    per: ratios?.per ?? null,
    perMediane: medianes?.lignes.find((l) => l.libelle === 'PER')?.mediane ?? null,
  });
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const rendez_vous = dividendes
    .flatMap((dv) => [
      dv.ex_date && dv.ex_date >= aujourdhui ? { date: dv.ex_date, libelle: `Détachement du dividende de l’exercice ${dv.exercice ?? ''}`.trim() } : null,
      dv.payment_date && dv.payment_date >= aujourdhui ? { date: dv.payment_date, libelle: `Mise en paiement du dividende de l’exercice ${dv.exercice ?? ''}`.trim() } : null,
    ])
    .filter((x): x is { date: string; libelle: string } => x != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const ex_date_controle = detachement
    ? controleExDate({ dividende: detachement.dividende, baisse: detachement.baisse_fcfa })
    : null;
  if (ex_date_controle === 'a_verifier') {
    lacunes.push(
      'Le jour du détachement, la baisse du cours est très inférieure au dividende : la date de détachement enregistrée est à vérifier.',
    );
  }
  const liqRow = liq as Suivi['liquidite'];

  const s = sig as { date_marche?: string; signal?: string; score_total?: number; confiance?: number; explication?: string; inputs?: Record<string, number | null> } | null;
  const inputs = s?.inputs ?? {};
  const cpPrecedent = fondaRows[1]?.equity ?? null;

  return {
    genere_le: new Date().toISOString().slice(0, 10),
    identite: {
      code: CODE,
      designation: (instr as { designation?: string | null }).designation ?? null,
      secteur: (instr as { secteur?: string | null }).secteur ?? null,
      pays: fisc.pays,
      taux_irvm: fisc.taux,
      actions,
      flottant: (instr as { flottant?: number | null }).flottant ?? null,
      notation,
    },
    chiffres_cles: {
      exercice: exerciceRef,
      cours,
      date_cours: derniere?.date_marche ?? null,
      variation_veille_pct: derniere?.variation_pct ?? null,
      capitalisation: ratios?.capitalisation ?? null,
      chiffre_affaires: fonda?.revenue ?? null,
      resultat_net: fonda?.net_income ?? null,
      capitaux_propres: fonda?.equity ?? null,
      dette: (fonda as { debt?: number | null } | null)?.debt ?? null,
      croissance_ca_1an: croissanceCA(annuelRef, 1),
      croissance_ca_2ans: croissanceCA(annuelRef, 2),
      variation_capitaux_propres_1an:
        fonda?.equity != null && cpPrecedent != null && cpPrecedent !== 0
          ? (fonda.equity - cpPrecedent) / Math.abs(cpPrecedent)
          : null,
    },
    // Exercices ANNUELS seulement : un trimestre à côté d'une année sur le même
    // axe se lit comme un effondrement.
    trajectoire: annuels
      .slice(0, 6)
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
    rentabilite_actif: rentabiliteActif({
      resultatNet: fonda?.net_income ?? null,
      totalActif: (bilanRef as { total_actifs?: number | null } | null)?.total_actifs ?? null,
      capitauxPropres: fonda?.equity ?? null,
      dette: (fonda as { debt?: number | null } | null)?.debt ?? null,
    }),
    niveaux,
    lacunes,
    suivi: {
      famille,
      intermediaire: lectureIntermediaire(exercices),
      performance,
      liquidite: liqRow ?? null,
      medianes,
      piliers,
      rendez_vous,
      ex_date_controle,
    },
  };
}

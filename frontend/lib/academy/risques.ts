/**
 * Leçon 7 « Les risques » — calculs PURS et testés (risques.test.ts) des
 * simulateurs du parcours premium (components/academy/lecon/risques).
 *
 * Règles communes :
 *  - les simulations ne portent que sur les hypothèses saisies (jamais un chiffre
 *    de marché) ; les données réelles (dividendes, liquidité) ne sont que LUES,
 *    commentées à partir de ce qui est affiché, jamais complétées ;
 *  - chaque fonction valide ses entrées et renvoie une erreur lisible plutôt
 *    qu'un NaN à l'écran.
 */
import type { HistoriqueValeur } from './donneesReelles';
import type { NiveauCarnet, LimiteOrdre, ConditionOrdre } from './carnet';
import liquiditeSource from './contenus/niveau3/sources/liquidite-2026-11-23.json';

const nf = (max = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: max });
export const nombre = (n: number, max = 2) => nf(max).format(n);
export const fcfa = (n: number) => `${nombre(Math.round(n), 0)} FCFA`;
/** « +4,8 % », « −4,4 % » (vrai signe moins) ; zéro sans signe. */
export const pctSigne = (n: number, max = 1) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: max, signDisplay: 'exceptZero' }).format(n)} %`.replace('-', '−');
export const pct = (n: number, max = 1) => `${nombre(n, max)} %`;

/** Montant saisi (« 250 000 », « 250000 », « 250 000,5 ») → nombre, ou null si illisible. */
export function lireMontant(brut: string): number | null {
  const t = brut.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ── Hausse nécessaire après une perte ──────────────────────────────────────

/** Hausse (en %) qui ramène au point de départ après une baisse de `pertePct` %. */
export function hausseNecessaire(pertePct: number): number {
  if (!Number.isFinite(pertePct) || pertePct < 0 || pertePct >= 100) {
    throw new Error('hausse nécessaire : la perte doit être comprise entre 0 et 100 % (exclu)');
  }
  return (pertePct / (100 - pertePct)) * 100;
}

/** Pertes illustrées par le graphique de l'étape 6 (dont −20 %, l'exemple de la leçon). */
export const PERTES_ILLUSTREES = [10, 20, 25, 30, 40, 50] as const;

// ── Épargne de précaution ───────────────────────────────────────────────────

export type ResultatEpargne =
  | { ok: true; trois: number; six: number; repere: number; disponible: number | null; reste: number | null }
  | { ok: false; erreur: string };

/** Plafond de saisie : au-delà, une faute de frappe est plus probable qu'une dépense réelle. */
export const DEPENSES_MAX = 100_000_000;

/**
 * Trois et six mois de dépenses essentielles (fourchette de la leçon). Le
 * repère retenu est la borne haute, six mois — celle de l'exemple et du quiz
 * de la leçon : un repère pédagogique, pas une règle.
 */
export function epargnePrecaution(depensesBrut: string, disponibleBrut = ''): ResultatEpargne {
  if (depensesBrut.trim() === '') return { ok: false, erreur: 'Indiquez vos dépenses mensuelles essentielles.' };
  const d = lireMontant(depensesBrut);
  if (d == null) return { ok: false, erreur: 'Saisissez un montant en chiffres, sans lettres ni signe (ex. 250 000).' };
  if (d <= 0) return { ok: false, erreur: 'Le montant doit être supérieur à zéro.' };
  if (d > DEPENSES_MAX) return { ok: false, erreur: 'Montant inhabituellement élevé : vérifiez la saisie (dépenses d’un mois).' };
  let disponible: number | null = null;
  if (disponibleBrut.trim() !== '') {
    disponible = lireMontant(disponibleBrut);
    if (disponible == null) return { ok: false, erreur: 'L’épargne déjà disponible doit être un montant en chiffres (ou laissée vide).' };
  }
  const trois = Math.round(d * 3);
  const six = Math.round(d * 6);
  return { ok: true, trois, six, repere: six, disponible, reste: disponible == null ? null : Math.max(0, six - Math.round(disponible)) };
}

// ── Portefeuille : répartition, concentration, chocs ────────────────────────

export interface LignePortefeuille {
  nom: string;
  secteur: string;
  /** Part du capital, en %. */
  pct: number;
}

/** Repères PÉDAGOGIQUES de la leçon (ni règle BRVM, ni conseil). */
export const SEUIL_SOCIETE_PCT = 20;
export const SEUIL_SECTEUR_PCT = 35;

export interface AnalysePortefeuille {
  totalPct: number;
  reste: number;
  parSecteur: { secteur: string; pct: number }[];
  /** Somme des poids au carré (0 à 1) : indice de concentration de Herfindahl. */
  herfindahl: number;
  /** 1 ÷ Herfindahl : nombre de lignes de même poids qui donneraient la même concentration. */
  nombreEffectif: number;
  ligneMax: LignePortefeuille | null;
  secteurMax: { secteur: string; pct: number } | null;
  alertes: string[];
  dansLesReperes: boolean;
}

const arrondi = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function analyserPortefeuille(lignes: LignePortefeuille[]): AnalysePortefeuille {
  for (const l of lignes) {
    if (!Number.isFinite(l.pct) || l.pct < 0 || l.pct > 100) throw new Error(`portefeuille : part impossible pour ${l.nom}`);
  }
  const actives = lignes.filter((l) => l.pct > 0);
  const totalPct = arrondi(lignes.reduce((s, l) => s + l.pct, 0));
  const secteurs = new Map<string, number>();
  for (const l of actives) secteurs.set(l.secteur, (secteurs.get(l.secteur) ?? 0) + l.pct);
  const parSecteur = [...secteurs.entries()].map(([secteur, p]) => ({ secteur, pct: arrondi(p) })).sort((a, b) => b.pct - a.pct);
  const somme = actives.reduce((s, l) => s + l.pct, 0);
  const herfindahl = somme > 0 ? actives.reduce((s, l) => s + (l.pct / somme) ** 2, 0) : 0;
  const ligneMax = actives.length ? [...actives].sort((a, b) => b.pct - a.pct)[0]! : null;
  const secteurMax = parSecteur[0] ?? null;

  const alertes: string[] = [];
  for (const l of actives) {
    if (l.pct > SEUIL_SOCIETE_PCT) alertes.push(`${l.nom} pèse ${pct(l.pct)} : au-dessus du repère de ${SEUIL_SOCIETE_PCT} % par société.`);
  }
  for (const s of parSecteur) {
    if (s.pct > SEUIL_SECTEUR_PCT) alertes.push(`Le secteur ${s.secteur} pèse ${pct(s.pct)} : au-dessus du repère de ${SEUIL_SECTEUR_PCT} % par secteur.`);
  }
  return {
    totalPct,
    reste: arrondi(100 - totalPct),
    parSecteur,
    herfindahl,
    nombreEffectif: herfindahl > 0 ? 1 / herfindahl : 0,
    ligneMax,
    secteurMax,
    alertes,
    dansLesReperes: alertes.length === 0,
  };
}

export interface ChocsPortefeuille {
  /** Baisse de tous les cours, en % (0 = aucun choc). */
  marchePct: number;
  /** Baisse supplémentaire des cours d'un secteur. */
  secteur: { nom: string; baissePct: number } | null;
  /** Réduction du dividende d'une ligne, en % (100 = suppression). */
  dividende: { nom: string; reductionPct: number } | null;
}

export interface ResultatPortefeuille {
  lignes: { nom: string; secteur: string; capitalAvant: number; capitalApres: number; revenuAvant: number; revenuApres: number }[];
  capitalAvant: number;
  capitalApres: number;
  revenuAvant: number;
  revenuApres: number;
  variationCapitalPct: number;
  variationRevenuPct: number;
  hypotheses: string[];
}

const variation = (avant: number, apres: number) => (avant === 0 ? 0 : Math.round(((apres - avant) / avant) * 1000) / 10);

/**
 * Capital et revenu avant / après des chocs CUMULÉS. Hypothèses (rendues à
 * l'écran) : rendement identique pour toutes les lignes ; une baisse de cours
 * ne change pas le dividende par action ; une réduction de dividende ne change
 * pas le cours. Mêmes conventions que lib/academy/allocation.ts.
 */
export function simulerPortefeuille(
  p: { capital: number; rendementPct: number; lignes: LignePortefeuille[] },
  c: ChocsPortefeuille,
): ResultatPortefeuille {
  if (!(p.capital > 0)) throw new Error('portefeuille : capital impossible');
  if (!(p.rendementPct >= 0 && p.rendementPct <= 30)) throw new Error('portefeuille : rendement impossible');
  const a = analyserPortefeuille(p.lignes);
  if (Math.abs(a.totalPct - 100) > 0.01) throw new Error('portefeuille : la répartition doit totaliser 100 %');
  const borne = (x: number) => Number.isFinite(x) && x >= 0 && x <= 100;
  if (!borne(c.marchePct)) throw new Error('portefeuille : choc de marché impossible');
  if (c.secteur && !borne(c.secteur.baissePct)) throw new Error('portefeuille : choc sectoriel impossible');
  if (c.dividende && !borne(c.dividende.reductionPct)) throw new Error('portefeuille : réduction de dividende impossible');

  const r = p.rendementPct / 100;
  const lignes = p.lignes.map((l) => {
    const capitalAvant = (p.capital * l.pct) / 100;
    let capitalApres = capitalAvant * (1 - c.marchePct / 100);
    if (c.secteur && l.secteur === c.secteur.nom) capitalApres *= 1 - c.secteur.baissePct / 100;
    const revenuAvant = capitalAvant * r;
    const revenuApres = c.dividende && l.nom === c.dividende.nom ? revenuAvant * (1 - c.dividende.reductionPct / 100) : revenuAvant;
    return { nom: l.nom, secteur: l.secteur, capitalAvant, capitalApres, revenuAvant, revenuApres };
  });
  const somme = (k: 'capitalAvant' | 'capitalApres' | 'revenuAvant' | 'revenuApres') => Math.round(lignes.reduce((s, l) => s + l[k], 0));
  const capitalAvant = somme('capitalAvant');
  const capitalApres = somme('capitalApres');
  const revenuAvant = somme('revenuAvant');
  const revenuApres = somme('revenuApres');

  const hypotheses: string[] = [`Revenu annuel = capital × ${pct(p.rendementPct)} (rendement d’hypothèse, identique pour toutes les lignes).`];
  if (c.marchePct > 0) hypotheses.push(`Tous les cours baissent de ${pct(c.marchePct)} ; les dividendes par action ne changent pas.`);
  if (c.secteur && c.secteur.baissePct > 0) hypotheses.push(`Les cours du secteur ${c.secteur.nom} baissent en plus de ${pct(c.secteur.baissePct)}.`);
  if (c.dividende && c.dividende.reductionPct > 0) hypotheses.push(`Le dividende de ${c.dividende.nom} baisse de ${pct(c.dividende.reductionPct)} ; son cours ne bouge pas.`);

  return {
    lignes,
    capitalAvant,
    capitalApres,
    revenuAvant,
    revenuApres,
    variationCapitalPct: variation(capitalAvant, capitalApres),
    variationRevenuPct: variation(revenuAvant, revenuApres),
    hypotheses,
  };
}

// ── Fixing : ce que l'on peut dire, et ce que l'on ne peut pas dire ─────────

export interface LectureFixing {
  /** Titres visibles en face, compatibles avec la limite (carnet fictif). */
  quantiteCompatible: number;
  phrases: string[];
}

/**
 * Sur une valeur au fixing, les ordres sont confrontés à un cours d'équilibre
 * UNIQUE, fixé par l'ensemble des ordres présents. Ce cours n'est pas connu à
 * l'avance : on ne calcule donc AUCUN prix ni aucune quantité exécutée. On dit
 * seulement ce que le carnet affiché permet de dire.
 */
export function lectureFixing(
  face: NiveauCarnet[],
  ordre: { sens: 'achat' | 'vente'; quantite: number; limite: LimiteOrdre; condition: ConditionOrdre },
): LectureFixing {
  const niveaux = face.filter((n): n is { prix: number; quantite: number } => n.prix != null && n.quantite > 0);
  const achat = ordre.sens === 'achat';
  const borne = ordre.limite === 'au_mieux' || ordre.limite == null ? null : ordre.limite.prix;
  const compatibles = borne == null ? niveaux : niveaux.filter((n) => (achat ? n.prix <= borne : n.prix >= borne));
  const quantiteCompatible = compatibles.reduce((s, n) => s + n.quantite, 0);
  const contrepartie = achat ? 'vendeurs' : 'acheteurs';

  const phrases = [
    'Au fixing, tous les ordres sont confrontés en une fois et servis à un cours d’équilibre unique. Ce cours dépend de l’ensemble des ordres présents à ce moment : il n’est pas connu à l’avance, le simulateur ne le calcule pas.',
  ];
  if (ordre.limite === 'au_mieux') {
    phrases.push(`Ordre au mieux : il accepte le cours d’équilibre, quel qu’il soit. Son exécution est favorisée, son prix n’est pas maîtrisé.`);
  } else if (borne != null) {
    phrases.push(
      achat
        ? `Ordre limité à ${nombre(borne)} FCFA : il ne peut être servi que si le cours d’équilibre est de ${nombre(borne)} FCFA ou moins.`
        : `Ordre limité à ${nombre(borne)} FCFA : il ne peut être servi que si le cours d’équilibre est de ${nombre(borne)} FCFA ou plus.`,
    );
  }
  phrases.push(
    `Dans le carnet affiché, ${nombre(quantiteCompatible, 0)} titres sont proposés par des ${contrepartie} à des prix compatibles avec votre ordre, pour ${nombre(ordre.quantite, 0)} demandés. C’est un indice, pas une promesse : d’autres ordres peuvent arriver ou être retirés avant la confrontation.`,
  );
  if (ordre.condition === 'tout_ou_rien') {
    phrases.push('« Tout ou rien » : servi en totalité au cours d’équilibre, ou pas du tout.');
  }
  return { quantiteCompatible, phrases };
}

// ── Dividendes : lecture commentée des données affichées ────────────────────

export type NaturePoint = 'premier' | 'hausse' | 'baisse' | 'stable' | 'reprise' | 'absent';

export interface PointDividende {
  exercice: number;
  montant: number | null;
  base: 'net' | 'brut' | 'non_verifiee';
  /** Variation depuis le dernier exercice versé (null : premier versé ou absent). */
  variationPct: number | null;
  nature: NaturePoint;
}

export const libelleBase = (b: PointDividende['base']) => (b === 'net' ? 'net' : b === 'brut' ? 'brut' : 'base non vérifiée');

const baseDe = (m: HistoriqueValeur['montants'][number]): PointDividende['base'] =>
  m.base === 'net' || m.baseNette ? 'net' : m.base === 'brut' ? 'brut' : 'non_verifiee';

/**
 * Points d'une série de dividendes : chaque exercice versé est comparé au
 * DERNIER exercice versé (un trou n'est ni une baisse ni une hausse). Une
 * « reprise » est une hausse qui suit une baisse.
 */
export function pointsDividende(v: HistoriqueValeur): PointDividende[] {
  let precedent: number | null = null;
  let derniereNature: NaturePoint | null = null;
  return v.montants.map((m) => {
    if (m.montant == null) return { exercice: m.exercice, montant: null, base: baseDe(m), variationPct: null, nature: 'absent' as const };
    let nature: NaturePoint;
    let variationPct: number | null = null;
    if (precedent == null) nature = 'premier';
    else {
      variationPct = ((m.montant - precedent) / precedent) * 100;
      if (m.montant < precedent) nature = 'baisse';
      else if (m.montant > precedent) nature = derniereNature === 'baisse' ? 'reprise' : 'hausse';
      else nature = 'stable';
    }
    precedent = m.montant;
    derniereNature = nature;
    return { exercice: m.exercice, montant: m.montant, base: baseDe(m), variationPct, nature };
  });
}

/**
 * Commentaire pédagogique AUTOMATIQUE, construit exclusivement à partir des
 * montants affichés : aucune cause n'est avancée, aucune prévision n'est faite.
 */
export function commenterDividendes(v: HistoriqueValeur): string[] {
  const pts = pointsDividende(v);
  const verses = pts.filter((p) => p.montant != null);
  const n = pts.length;
  const phrases: string[] = [];
  if (verses.length === 0) return [`Aucun dividende n’est enregistré pour ${v.nom} sur ces exercices dans la base WestBourse.`];

  const premier = verses[0]!;
  const dernier = verses[verses.length - 1]!;
  phrases.push(
    `${v.nom} : un dividende est enregistré pour ${verses.length} exercice${verses.length > 1 ? 's' : ''} sur ${n} (${pts[0]!.exercice} à ${pts[n - 1]!.exercice}).`,
  );
  if (verses.length > 1) {
    const evol = ((dernier.montant! - premier.montant!) / premier.montant!) * 100;
    phrases.push(
      `De ${nombre(premier.montant!)} FCFA (exercice ${premier.exercice}) à ${nombre(dernier.montant!)} FCFA (exercice ${dernier.exercice}) : ${pctSigne(evol)} sur la période.`,
    );
  }
  const baisses = pts.filter((p) => p.nature === 'baisse');
  const reprises = pts.filter((p) => p.nature === 'reprise');
  if (baisses.length === 0 && verses.length > 1) phrases.push('Aucune baisse d’un exercice versé au suivant sur la période affichée.');
  for (const b of baisses) phrases.push(`Baisse sur l’exercice ${b.exercice} : ${pctSigne(b.variationPct!)} par rapport au dernier dividende versé.`);
  for (const r of reprises) phrases.push(`Reprise sur l’exercice ${r.exercice} : ${pctSigne(r.variationPct!)} après une baisse.`);
  const absents = pts.filter((p) => p.nature === 'absent').map((p) => p.exercice);
  if (absents.length > 0) {
    phrases.push(`Aucun dividende enregistré dans la base pour ${absents.length > 1 ? 'les exercices' : 'l’exercice'} ${absents.join(', ')} : absence de versement ou donnée manquante, la base ne permet pas de trancher.`);
  }
  const bases = new Set(verses.map((p) => p.base));
  if (bases.size > 1) {
    phrases.push('Les montants n’ont pas tous la même base (net, brut ou non vérifiée) : une partie de l’écart peut venir de la fiscalité, pas d’une décision de la société.');
  }
  phrases.push('Ce constat décrit le passé : il ne dit rien des prochains dividendes, qui dépendent des résultats et du vote de l’assemblée générale.');
  return phrases;
}

/** Série en base 100 (premier exercice versé = 100) pour comparer des évolutions, pas des montants. */
export function base100(v: HistoriqueValeur): (number | null)[] {
  const ref = v.montants.find((m) => m.montant != null)?.montant ?? null;
  return v.montants.map((m) => (m.montant == null || ref == null ? null : Math.round((m.montant / ref) * 1000) / 10));
}

// ── Liquidité : données réelles figées (base WestBourse) ────────────────────

export interface LigneLiquidite {
  code: string;
  nom: string;
  capitauxMd: number;
  partPct: number;
  seancesCotees: number;
  seancesSansEchange: number;
}

/**
 * Capitaux échangés par action sur 65 séances (24/08 → 23/11/2026), relevés
 * dans la base WestBourse le 24/11/2026 (contenus/niveau3/sources). Parts
 * recalculées sur l'ensemble des actions du relevé.
 */
export function liquiditeBrvm(codes: string[]) {
  const valeurs = liquiditeSource.valeurs;
  const total = valeurs.reduce((s, v) => s + v.capitaux_md, 0);
  const tri = [...valeurs].sort((a, b) => b.capitaux_md - a.capitaux_md);
  const versLigne = (v: (typeof valeurs)[number]): LigneLiquidite => ({
    code: v.code,
    nom: v.nom,
    capitauxMd: v.capitaux_md,
    partPct: (v.capitaux_md / total) * 100,
    seancesCotees: v.seances_cotees,
    seancesSansEchange: v.seances_sans_echange,
  });
  const top10 = tri.slice(0, 10).reduce((s, v) => s + v.capitaux_md, 0);
  const moinsEchangees = [...valeurs].sort((a, b) => b.seances_sans_echange - a.seances_sans_echange || a.capitaux_md - b.capitaux_md).slice(0, 2);
  return {
    periode: liquiditeSource.periode,
    nbValeurs: valeurs.length,
    totalMd: total,
    partTop10Pct: (top10 / total) * 100,
    lignes: codes.map((c) => valeurs.find((v) => v.code === c)).filter((v): v is (typeof valeurs)[number] => Boolean(v)).map(versLigne),
    moinsEchangees: moinsEchangees.map(versLigne),
    plusEchangee: versLigne(tri[0]!),
  };
}

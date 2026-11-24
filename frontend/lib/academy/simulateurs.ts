/**
 * Simulateurs des leçons Academy (frais, rendement, PER, DPS, obligation…) —
 * fonctions PURES et testées (simulateurs.test.ts).
 *
 * Chaque calcul renvoie ses résultats ET une lecture pédagogique DÉRIVÉE des
 * chiffres (déterministe, sans appel LLM), plus des mises en garde quand une
 * hypothèse s'écarte des exemples de la leçon. Jamais un conseil : aucune
 * phrase ne dit d'acheter, de vendre ou de conserver un titre.
 *
 * Les paramètres sont des HYPOTHÈSES écrites dans la leçon ou saisies par le
 * lecteur ; les seules données réelles (cours, BPA, clôtures) sont lues en base
 * par les routes /api/academy/* et passées telles quelles.
 */
import { bondPrice, yieldToMaturity } from '@/lib/bonds';
import { dividendeNet } from '@/lib/tax/compute';
import { BAREME, PAYS_LABELS, type PaysUemoa } from '@/lib/tax/rates';

export interface Lecture {
  /** Phrase pédagogique dérivée du résultat. */
  lecture: string;
  /** Mises en garde (hypothèse irréaliste, cas impossible…). */
  alertes: string[];
}

/** Erreur de saisie : le message s'affiche tel quel au lecteur. */
export class SaisieInvalide extends Error {}

const exiger = (ok: boolean, message: string) => {
  if (!ok) throw new SaisieInvalide(message);
};
const positif = (x: number) => Number.isFinite(x) && x > 0;
const finiPositifOuNul = (x: number) => Number.isFinite(x) && x >= 0;

const nb = (n: number, dec = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec }).format(n);
export const fmtFcfa = (n: number) => `${nb(Math.round(n))} FCFA`;
export const fmtPct = (n: number, dec = 1) => `${nb(n, dec)} %`.replace('-', '−');
const fmtX = (n: number) => nb(n, 1);

/** Parité FIXE euro – franc CFA (1 € = 655,957 FCFA), rappelée en leçon 10. */
export const PARITE_EUR_FCFA = 655.957;

// ── 1. Frais d'un ordre et seuil de rentabilité d'un aller-retour ───────────

export interface ParamsFrais {
  cours: number;
  quantite: number;
  /** Frais totaux par ordre, en % du montant (courtage, commissions, TVA). */
  taux_frais_pct: number;
  /** Frais minimum par ordre, en FCFA (0 si aucun). */
  minimum_fcfa: number;
}

export interface ResultatFrais extends Lecture {
  montant: number;
  frais: number;
  fraisPct: number;
  coutTotal: number;
  minimumApplique: boolean;
  /** Cours de revente qui rend exactement la mise, frais de revente compris. */
  prixSansPerte: number;
  hausseNecessairePct: number;
}

export function calculerFrais(p: ParamsFrais): ResultatFrais {
  exiger(positif(p.cours), 'Le cours doit être supérieur à zéro.');
  exiger(Number.isInteger(p.quantite) && p.quantite > 0, 'La quantité doit être un nombre entier de titres.');
  exiger(finiPositifOuNul(p.taux_frais_pct) && p.taux_frais_pct < 50, 'Le taux de frais doit être compris entre 0 et 50 %.');
  exiger(finiPositifOuNul(p.minimum_fcfa), 'Le minimum de frais ne peut pas être négatif.');
  const t = p.taux_frais_pct / 100;
  const montant = p.cours * p.quantite;
  const proportionnels = montant * t;
  const minimumApplique = p.minimum_fcfa > proportionnels;
  const frais = Math.max(proportionnels, p.minimum_fcfa);
  const coutTotal = montant + frais;
  // Revente : produit net = P·q − max(P·q·t, minimum) ; on cherche produit net = coût.
  let prixSansPerte = coutTotal / (p.quantite * (1 - t));
  if (prixSansPerte * p.quantite * t < p.minimum_fcfa) prixSansPerte = (coutTotal + p.minimum_fcfa) / p.quantite;
  const hausseNecessairePct = (prixSansPerte / p.cours - 1) * 100;
  const fraisPct = (frais / montant) * 100;

  const alertes: string[] = [];
  if (minimumApplique) {
    alertes.push(
      `Le minimum de ${fmtFcfa(p.minimum_fcfa)} s’applique : sur cet ordre de ${fmtFcfa(montant)}, il représente ${fmtPct(fraisPct)} du montant, bien plus que le taux affiché.`,
    );
  }
  if (p.taux_frais_pct > 3) {
    alertes.push(`Un taux de ${fmtPct(p.taux_frais_pct)} par ordre est bien au-dessus des exemples de la leçon (1 à 1,5 %) : comparez avec la grille de votre SGI.`);
  }
  const lecture =
    `Vous payez ${fmtFcfa(coutTotal)} pour ${fmtFcfa(montant)} d’actions : les frais font ${fmtPct(fraisPct)}. ` +
    `Pour revendre sans perte, frais de revente compris, le cours doit atteindre ${fmtFcfa(Math.ceil(prixSansPerte))}, ` +
    `soit une hausse de ${fmtPct(hausseNecessairePct)}.`;
  return { montant, frais, fraisPct, coutTotal, minimumApplique, prixSansPerte, hausseNecessairePct, lecture, alertes };
}

// ── 2. Rendement total (dividendes + variation du cours) ─────────────────────

export interface ParamsRendementTotal {
  prix_achat: number;
  prix_vente: number;
  actions: number;
  /** Dividendes reçus PAR ACTION sur toute la durée. */
  dividendes_par_action: number;
  annees: number;
}

export interface ResultatRendementTotal extends Lecture {
  investi: number;
  dividendes: number;
  plusValue: number;
  rendementTotalPct: number;
  rendementAnnuelPct: number | null;
  /** Part du gain (ou de la perte) qui vient du dividende, en %. */
  rendementSansDividendePct: number;
}

export function calculerRendementTotal(p: ParamsRendementTotal): ResultatRendementTotal {
  exiger(positif(p.prix_achat) && positif(p.prix_vente), 'Les prix doivent être supérieurs à zéro.');
  exiger(Number.isInteger(p.actions) && p.actions > 0, 'Le nombre d’actions doit être un entier positif.');
  exiger(finiPositifOuNul(p.dividendes_par_action), 'Les dividendes ne peuvent pas être négatifs.');
  exiger(positif(p.annees) && p.annees <= 50, 'La durée doit être comprise entre 1 et 50 ans.');
  const investi = p.prix_achat * p.actions;
  const dividendes = p.dividendes_par_action * p.actions;
  const plusValue = (p.prix_vente - p.prix_achat) * p.actions;
  const total = (dividendes + plusValue) / investi;
  const rendementTotalPct = total * 100;
  const rendementAnnuelPct = total > -1 ? ((1 + total) ** (1 / p.annees) - 1) * 100 : null;
  const rendementSansDividendePct = (plusValue / investi) * 100;

  const alertes: string[] = [];
  if (rendementAnnuelPct != null && rendementAnnuelPct > 25) {
    alertes.push(`Un rendement de ${fmtPct(rendementAnnuelPct)} par an est exceptionnel : vérifiez qu’il ne repose pas sur un prix de revente trop optimiste.`);
  }
  const duree = p.annees === 1 ? 'sur un an' : `sur ${nb(p.annees)} ans`;
  let lecture = `Rendement total ${duree} : ${fmtPct(rendementTotalPct)}` +
    (p.annees > 1 && rendementAnnuelPct != null ? `, soit ${fmtPct(rendementAnnuelPct)} par an en moyenne. ` : '. ');
  if (plusValue < 0 && dividendes > 0) {
    lecture += `Le cours a baissé (${fmtPct(rendementSansDividendePct)}), mais les dividendes ${dividendes + plusValue >= 0 ? 'compensent la baisse' : 'en amortissent une partie'}.`;
  } else if (dividendes > 0) {
    lecture += `Sans les dividendes, le rendement ne serait que de ${fmtPct(rendementSansDividendePct)} : comparer des placements sans eux fausse le résultat.`;
  } else {
    lecture += 'Aucun dividende n’est compté : seul le cours fait le résultat.';
  }
  return { investi, dividendes, plusValue, rendementTotalPct, rendementAnnuelPct, rendementSansDividendePct, lecture, alertes };
}

// ── 3. Valeur future d'une épargne (capital de départ + versements) ─────────

export interface ParamsValeurFuture {
  capital_initial: number;
  versement_mensuel: number;
  /** Rendement annuel HYPOTHÉTIQUE, en %. */
  taux_pct: number;
  annees: number;
  /** Capital visé (facultatif, 0 = aucun). */
  objectif: number;
}

export interface PointValeurFuture { annee: number; verse: number; valeur: number }

export interface ResultatValeurFuture extends Lecture {
  points: PointValeurFuture[];
  valeurFinale: number;
  totalVerse: number;
  gains: number;
  /** Même effort commencé 3 ans plus tard (null si la durée est trop courte). */
  valeurSiRetard3Ans: number | null;
  /** Versement mensuel qui atteint l'objectif (null sans objectif). */
  versementPourObjectif: number | null;
}

function serieValeur(capital: number, versement: number, tauxPct: number, annees: number): PointValeurFuture[] {
  const rm = (1 + tauxPct / 100) ** (1 / 12) - 1;
  const points: PointValeurFuture[] = [{ annee: 0, verse: capital, valeur: capital }];
  let valeur = capital;
  let verse = capital;
  for (let a = 1; a <= annees; a++) {
    for (let m = 0; m < 12; m++) {
      valeur = valeur * (1 + rm) + versement;
      verse += versement;
    }
    points.push({ annee: a, verse, valeur });
  }
  return points;
}

export function calculerValeurFuture(p: ParamsValeurFuture): ResultatValeurFuture {
  exiger(finiPositifOuNul(p.capital_initial) && finiPositifOuNul(p.versement_mensuel), 'Les montants ne peuvent pas être négatifs.');
  exiger(p.capital_initial > 0 || p.versement_mensuel > 0, 'Indiquez un capital de départ ou un versement mensuel.');
  exiger(Number.isFinite(p.taux_pct) && p.taux_pct >= 0 && p.taux_pct <= 30, 'Le rendement doit être compris entre 0 et 30 %.');
  exiger(Number.isInteger(p.annees) && p.annees >= 1 && p.annees <= 40, 'La durée doit être un nombre entier d’années, de 1 à 40.');
  exiger(finiPositifOuNul(p.objectif), 'L’objectif ne peut pas être négatif.');
  const points = serieValeur(p.capital_initial, p.versement_mensuel, p.taux_pct, p.annees);
  const fin = points[points.length - 1]!;
  const valeurSiRetard3Ans = p.annees > 3
    ? serieValeur(p.capital_initial, p.versement_mensuel, p.taux_pct, p.annees - 3).at(-1)!.valeur
    : null;

  let versementPourObjectif: number | null = null;
  if (p.objectif > 0) {
    // Valeur linéaire en versement : V(v) = V(0) + v·V₁ où V₁ = valeur d'un versement de 1 FCFA/mois.
    const v0 = serieValeur(p.capital_initial, 0, p.taux_pct, p.annees).at(-1)!.valeur;
    const v1 = serieValeur(0, 1, p.taux_pct, p.annees).at(-1)!.valeur;
    versementPourObjectif = Math.max(0, Math.ceil((p.objectif - v0) / v1));
  }

  const alertes: string[] = [];
  if (p.taux_pct > 10) {
    alertes.push(`Un rendement de ${fmtPct(p.taux_pct)} par an, chaque année, dépasse les hypothèses de la leçon (6 à 10 %) : les bonnes et les mauvaises années alternent.`);
  }
  let lecture =
    `En ${nb(p.annees)} ans, ${fmtFcfa(fin.verse)} épargnés deviendraient ${fmtFcfa(fin.valeur)}, ` +
    `dont ${fmtFcfa(fin.valeur - fin.verse)} produits par le placement.`;
  if (valeurSiRetard3Ans != null) {
    lecture += ` Commencé trois ans plus tard, le même effort donnerait ${fmtFcfa(valeurSiRetard3Ans)} : le temps fait une grande part du travail.`;
  }
  if (versementPourObjectif != null) {
    lecture += versementPourObjectif === 0
      ? ` L’objectif de ${fmtFcfa(p.objectif)} serait atteint sans versement mensuel.`
      : ` Pour viser ${fmtFcfa(p.objectif)}, il faudrait verser environ ${fmtFcfa(versementPourObjectif)} par mois.`;
  }
  return {
    points,
    valeurFinale: fin.valeur,
    totalVerse: fin.verse,
    gains: fin.valeur - fin.verse,
    valeurSiRetard3Ans,
    versementPourObjectif,
    lecture,
    alertes,
  };
}

// ── 4. PER et rendement bénéficiaire ─────────────────────────────────────────

export interface ParamsPer {
  cours: number;
  bpa: number;
  /** Progression annuelle HYPOTHÉTIQUE du bénéfice, en %. */
  croissance_pct: number;
  annees: number;
}

export type ZonePer = 'faible' | 'intermediaire' | 'entre' | 'eleve';

export interface ResultatPer extends Lecture {
  per: number | null;
  rendementBeneficiairePct: number | null;
  zone: ZonePer | null;
  bpaFutur: number;
  perFutur: number | null;
}

/** Repères pédagogiques de la leçon PER (niveau 2) : moins de 8, 8 à 15, plus de 20. */
export function zonePer(per: number): ZonePer {
  if (per < 8) return 'faible';
  if (per <= 15) return 'intermediaire';
  if (per <= 20) return 'entre';
  return 'eleve';
}

const LECTURE_ZONE: Record<ZonePer, string> = {
  faible: 'Repère de la leçon : moins de 8, une décote ou une méfiance du marché, à expliquer.',
  intermediaire: 'Repère de la leçon : entre 8 et 15, une zone fréquente pour une société mature.',
  entre: 'Entre 15 et 20, au-dessus de la zone fréquente des sociétés matures (8 à 15) : la question est de savoir pourquoi.',
  eleve: 'Repère de la leçon : plus de 20, une croissance attendue, ou un bénéfice temporairement bas.',
};

export function calculerPer(p: ParamsPer): ResultatPer {
  exiger(positif(p.cours), 'Le cours doit être supérieur à zéro.');
  exiger(Number.isFinite(p.bpa), 'Le bénéfice par action doit être un nombre.');
  exiger(Number.isFinite(p.croissance_pct) && p.croissance_pct > -50 && p.croissance_pct <= 50, 'La croissance doit être comprise entre −50 et 50 % par an.');
  exiger(Number.isInteger(p.annees) && p.annees >= 1 && p.annees <= 10, 'La durée doit être comprise entre 1 et 10 ans.');
  const bpaFutur = p.bpa * (1 + p.croissance_pct / 100) ** p.annees;
  if (!(p.bpa > 0)) {
    return {
      per: null,
      rendementBeneficiairePct: null,
      zone: null,
      bpaFutur,
      perFutur: null,
      lecture: 'Avec un bénéfice nul ou négatif, le PER n’a pas de sens : on ne paie pas « un nombre de fois » une perte. Regardez plutôt les fonds propres et la trésorerie.',
      alertes: [],
    };
  }
  const per = p.cours / p.bpa;
  const zone = zonePer(per);
  const perFutur = bpaFutur > 0 ? p.cours / bpaFutur : null;
  const alertes: string[] = [];
  if (p.croissance_pct > 20) {
    alertes.push(`Une hausse du bénéfice de ${fmtPct(p.croissance_pct)} par an pendant ${nb(p.annees)} ans est une hypothèse très optimiste : peu de sociétés la tiennent.`);
  }
  let lecture =
    `Au cours de ${fmtFcfa(p.cours)}, vous payez l’action ${fmtX(per)} fois son bénéfice annuel : ` +
    `pour 100 FCFA payés, la société gagne ${nb(100 / per, 1)} FCFA par an. ${LECTURE_ZONE[zone]}`;
  if (perFutur != null && p.croissance_pct !== 0) {
    lecture += ` Si le bénéfice ${p.croissance_pct > 0 ? 'progressait' : 'reculait'} de ${fmtPct(Math.abs(p.croissance_pct))} par an pendant ${nb(p.annees)} ans, ce même cours ne représenterait plus que ${fmtX(perFutur)} fois le bénéfice de la dernière année.`;
  }
  return { per, rendementBeneficiairePct: 100 / per, zone, bpaFutur, perFutur, lecture, alertes };
}

// ── 5. P/B = PER × ROE ──────────────────────────────────────────────────────

export interface SocietePbRoe { nom: string; per: number; roe_pct: number }

export interface ResultatPbRoe { nom: string; per: number; roePct: number; pb: number; lecture: string }

export function lecturePbRoe(per: number, roePct: number): string {
  const pb = (per * roePct) / 100;
  if (roePct <= 0) return 'Rentabilité nulle ou négative : le P/B ne se lit plus par le ROE, la société détruit de la valeur cette année.';
  if (pb < 1 && roePct < 10) return `P/B de ${fmtX(pb)} : sous la valeur comptable, mais avec un ROE de ${fmtPct(roePct)} la décote s’explique par une rentabilité faible.`;
  if (pb < 1) return `P/B de ${fmtX(pb)} : sous la valeur comptable malgré un ROE de ${fmtPct(roePct)}. C’est ce décalage qui demande une explication.`;
  if (roePct >= 15) return `P/B de ${fmtX(pb)} : au-dessus de la valeur comptable, ce que justifie un ROE de ${fmtPct(roePct)}.`;
  if (roePct < 10 && pb > 1.5) return `P/B de ${fmtX(pb)} pour un ROE de seulement ${fmtPct(roePct)} : le marché attend une forte amélioration, ou paie cher.`;
  return `P/B de ${fmtX(pb)} pour un ROE de ${fmtPct(roePct)} : une valorisation proche de la rentabilité.`;
}

export function calculerPbRoe(societes: SocietePbRoe[]): ResultatPbRoe[] {
  exiger(societes.length > 0, 'Aucune société à comparer.');
  return societes.map((s) => {
    exiger(positif(s.per) && s.per <= 200, `PER impossible pour ${s.nom}.`);
    exiger(Number.isFinite(s.roe_pct) && s.roe_pct > -100 && s.roe_pct <= 100, `ROE impossible pour ${s.nom}.`);
    return { nom: s.nom, per: s.per, roePct: s.roe_pct, pb: (s.per * s.roe_pct) / 100, lecture: lecturePbRoe(s.per, s.roe_pct) };
  });
}

// ── 6. Banque : coefficient d'exploitation et coût du risque ────────────────

export interface ParamsBanque {
  /** Produit net bancaire (même unité pour les trois montants). */
  pnb: number;
  frais_generaux: number;
  cout_risque: number;
}

export interface ResultatBanque extends Lecture {
  coefficientPct: number;
  resultatBrutExploitation: number;
  resultatAvantImpot: number;
  partRisquePct: number | null;
  /** Résultat avant impôt si le coût du risque doublait. */
  resultatSiRisqueDouble: number;
}

export function calculerBanque(p: ParamsBanque): ResultatBanque {
  exiger(positif(p.pnb), 'Le produit net bancaire doit être supérieur à zéro.');
  exiger(finiPositifOuNul(p.frais_generaux) && finiPositifOuNul(p.cout_risque), 'Les frais et le coût du risque ne peuvent pas être négatifs.');
  const coefficientPct = (p.frais_generaux / p.pnb) * 100;
  const rbe = p.pnb - p.frais_generaux;
  const rai = rbe - p.cout_risque;
  const partRisquePct = rbe > 0 ? (p.cout_risque / rbe) * 100 : null;
  const resultatSiRisqueDouble = rbe - 2 * p.cout_risque;
  const alertes: string[] = [];
  if (rbe <= 0) alertes.push('Les frais généraux absorbent tout le produit net bancaire : la banque perd de l’argent avant même le coût du risque.');
  if (coefficientPct > 70) alertes.push(`Un coefficient de ${fmtPct(coefficientPct)} est élevé : l’exemple de la leçon est à 40 %.`);
  let lecture = `Coefficient d’exploitation : ${fmtPct(coefficientPct)}, soit ${nb(coefficientPct, 1)} de frais pour 100 de produit.`;
  if (partRisquePct != null) {
    lecture += ` Le coût du risque absorbe ${fmtPct(partRisquePct)} du résultat brut d’exploitation.`;
    if (p.cout_risque > 0 && rai > 0) {
      const ecart = ((resultatSiRisqueDouble - rai) / rai) * 100;
      lecture += ` S’il doublait, le résultat avant impôt passerait de ${nb(rai, 1)} à ${nb(resultatSiRisqueDouble, 1)} (${fmtPct(ecart)}) : c’est par là qu’une banque qui prête trop facilement finit par payer.`;
    }
  }
  return { coefficientPct, resultatBrutExploitation: rbe, resultatAvantImpot: rai, partRisquePct, resultatSiRisqueDouble, lecture, alertes };
}

// ── 7. Droit préférentiel de souscription ───────────────────────────────────

export interface ParamsDps {
  cours: number;
  prix_emission: number;
  /** Nombre d'actions anciennes pour UNE action nouvelle. */
  parite: number;
  actions: number;
}

export interface ResultatDps extends Lecture {
  valeurDroit: number;
  coursTheorique: number;
  /** Actions nouvelles que les droits détenus permettent de souscrire. */
  nouvellesPossibles: number;
  coutSouscription: number;
  valeurDroits: number;
  /** Part du capital conservée sans souscrire, en % de la part d'avant. */
  partConserveePct: number;
  valeurAvant: number;
}

export function calculerDps(p: ParamsDps): ResultatDps {
  exiger(positif(p.cours) && positif(p.prix_emission), 'Le cours et le prix d’émission doivent être supérieurs à zéro.');
  exiger(Number.isInteger(p.parite) && p.parite >= 1 && p.parite <= 100, 'La parité doit être un entier entre 1 et 100.');
  exiger(Number.isInteger(p.actions) && p.actions > 0, 'Le nombre d’actions doit être un entier positif.');
  const valeurDroit = Math.max(0, (p.cours - p.prix_emission) / (p.parite + 1));
  const coursTheorique = (p.parite * p.cours + p.prix_emission) / (p.parite + 1);
  const nouvellesPossibles = Math.floor(p.actions / p.parite);
  const coutSouscription = nouvellesPossibles * p.prix_emission;
  const valeurDroits = p.actions * valeurDroit;
  const partConserveePct = (p.parite / (p.parite + 1)) * 100;
  const valeurAvant = p.actions * p.cours;
  const alertes: string[] = [];
  if (p.prix_emission >= p.cours) {
    alertes.push('Le prix d’émission dépasse le cours : le droit n’a aucune valeur théorique, et souscrire coûterait plus cher qu’une action achetée en bourse.');
  }
  if (p.actions < p.parite) {
    alertes.push(`Avec ${nb(p.actions)} actions, il manque des droits pour souscrire une action nouvelle (il en faut ${nb(p.parite)}) : il faudrait en acheter, ou vendre les vôtres.`);
  }
  const lecture =
    `Chaque droit vaut en théorie ${fmtFcfa(valeurDroit)} et l’action ${fmtFcfa(coursTheorique)} après détachement. ` +
    `Souscrire : ${nb(nouvellesPossibles)} action(s) nouvelle(s) pour ${fmtFcfa(coutSouscription)}. ` +
    `Vendre vos ${nb(p.actions)} droits : environ ${fmtFcfa(valeurDroits)} encaissés, mais votre part du capital tombe à ${fmtPct(partConserveePct)} de ce qu’elle était. ` +
    `Ne rien faire : les droits expirent, et leur valeur est perdue.`;
  return { valeurDroit, coursTheorique, nouvellesPossibles, coutSouscription, valeurDroits, partConserveePct, valeurAvant, lecture, alertes };
}

// ── 8. Rendement net d'IRVM, par pays de la société ─────────────────────────

export interface LigneRendementNet {
  pays: PaysUemoa;
  libelle: string;
  /** null = taux non vérifié dans le barème (jamais supposé). */
  taux: number | null;
  net: number | null;
  rendementNetPct: number | null;
  netEuros: number | null;
}

export interface ResultatRendementNet extends Lecture {
  rendementBrutPct: number;
  lignes: LigneRendementNet[];
  choisie: LigneRendementNet;
}

export function calculerRendementNet(p: { dividende_brut: number; cours: number; pays: PaysUemoa }): ResultatRendementNet {
  exiger(positif(p.dividende_brut) && positif(p.cours), 'Le dividende et le cours doivent être supérieurs à zéro.');
  const lignes: LigneRendementNet[] = (Object.keys(BAREME) as PaysUemoa[]).map((pays) => {
    const r = dividendeNet(p.dividende_brut, pays);
    const libelle = PAYS_LABELS[pays];
    if (r.indisponible) return { pays, libelle, taux: null, net: null, rendementNetPct: null, netEuros: null };
    return {
      pays,
      libelle,
      taux: r.taux,
      net: r.net,
      rendementNetPct: (r.net / p.cours) * 100,
      netEuros: r.net / PARITE_EUR_FCFA,
    };
  });
  const choisie = lignes.find((l) => l.pays === p.pays)!;
  const rendementBrutPct = (p.dividende_brut / p.cours) * 100;
  const alertes: string[] = [];
  if (rendementBrutPct > 15) alertes.push(`Un rendement brut de ${fmtPct(rendementBrutPct)} est inhabituel : vérifiez le dividende et le cours saisis.`);
  let lecture: string;
  if (choisie.net == null || choisie.taux == null || choisie.rendementNetPct == null) {
    lecture = `Le taux de ${choisie.libelle} n’est pas vérifié par WestBourse : aucun montant net n’est calculé, plutôt qu’un chiffre supposé.`;
  } else {
    const connus = lignes.filter((l) => l.net != null);
    const max = Math.max(...connus.map((l) => l.net!));
    const min = Math.min(...connus.map((l) => l.net!));
    lecture =
      `Société de ${choisie.libelle} : retenue de ${fmtPct(choisie.taux * 100)}, vous recevez ${fmtFcfa(choisie.net)} par action, ` +
      `soit un rendement net de ${fmtPct(choisie.rendementNetPct, 2)} contre ${fmtPct(rendementBrutPct, 2)} brut. ` +
      `Pour le même dividende brut, le net va de ${fmtFcfa(min)} à ${fmtFcfa(max)} selon le pays : comparez les rendements nets.`;
  }
  return { rendementBrutPct, lignes, choisie, lecture, alertes };
}

// ── 9. Obligation : rendement courant, actuariel, coupon couru ──────────────

export interface ParamsObligation {
  nominal: number;
  taux_nominal_pct: number;
  prix: number;
  annees_restantes: number;
  jours_ecoules: number;
  /** Taux de marché pour lequel on recalcule le prix théorique. */
  taux_marche_pct: number;
}

export interface ResultatObligation extends Lecture {
  coupon: number;
  rendementCourantPct: number;
  rendementActuarielPct: number | null;
  couponCouru: number;
  montantPaye: number;
  prixAuTauxMarche: number;
}

export function calculerObligation(p: ParamsObligation): ResultatObligation {
  exiger(positif(p.nominal) && positif(p.prix), 'Le nominal et le prix doivent être supérieurs à zéro.');
  exiger(Number.isFinite(p.taux_nominal_pct) && p.taux_nominal_pct >= 0 && p.taux_nominal_pct <= 30, 'Le taux nominal doit être compris entre 0 et 30 %.');
  exiger(Number.isInteger(p.annees_restantes) && p.annees_restantes >= 1 && p.annees_restantes <= 30, 'La durée restante doit être un entier de 1 à 30 ans.');
  exiger(Number.isInteger(p.jours_ecoules) && p.jours_ecoules >= 0 && p.jours_ecoules < 365, 'Les jours écoulés doivent être compris entre 0 et 364.');
  exiger(Number.isFinite(p.taux_marche_pct) && p.taux_marche_pct > 0 && p.taux_marche_pct <= 30, 'Le taux de marché doit être compris entre 0 et 30 %.');
  const coupon = (p.nominal * p.taux_nominal_pct) / 100;
  const rendementCourantPct = (coupon / p.prix) * 100;
  const rendementActuarielPct = yieldToMaturity({
    prix: p.prix,
    couponRatePct: p.taux_nominal_pct,
    yearsToMaturity: p.annees_restantes,
    face: p.nominal,
  });
  const couponCouru = (coupon * p.jours_ecoules) / 365;
  const montantPaye = p.prix + couponCouru;
  const prixAuTauxMarche = bondPrice(p.taux_marche_pct, p.taux_nominal_pct, p.annees_restantes, p.nominal);
  const alertes: string[] = [];
  if (rendementActuarielPct == null) alertes.push('Rendement actuariel non calculable avec ces hypothèses (hors de la plage 0 à 100 %).');
  if (p.prix > p.nominal * 1.3 || p.prix < p.nominal * 0.5) alertes.push('Ce prix s’écarte beaucoup du nominal : vérifiez la saisie.');
  let lecture = `Coupon de ${fmtFcfa(coupon)} par an, rendement courant de ${fmtPct(rendementCourantPct, 2)}.`;
  if (rendementActuarielPct != null) {
    const ecart = p.prix < p.nominal ? 'sous' : p.prix > p.nominal ? 'au-dessus du' : 'au';
    lecture += ` Payée ${ecart === 'au' ? 'au nominal' : `${ecart} nominal`}, elle rapporte un rendement actuariel de ${fmtPct(rendementActuarielPct, 2)}`;
    lecture += p.prix < p.nominal
      ? ' : plus que le rendement courant, car vous récupérez aussi l’écart au remboursement.'
      : p.prix > p.nominal
        ? ' : moins que le rendement courant, car vous perdez l’écart au remboursement.'
        : ', égal au taux nominal.';
  }
  lecture += ` Si les taux du marché étaient à ${fmtPct(p.taux_marche_pct, 2)}, son prix théorique serait de ${fmtFcfa(prixAuTauxMarche)}.`;
  if (couponCouru > 0) lecture += ` Achetée maintenant, elle coûte ${fmtFcfa(montantPaye)} avec ${fmtFcfa(couponCouru)} de coupon couru.`;
  return { coupon, rendementCourantPct, rendementActuarielPct, couponCouru, montantPaye, prixAuTauxMarche, lecture, alertes };
}

// ── 10. Frais d'un OPCVM sur la durée ───────────────────────────────────────

export interface ParamsOpcvm {
  montant: number;
  annees: number;
  frais_entree_pct: number;
  frais_gestion_pct: number;
  frais_sortie_pct: number;
  /** Performance annuelle HYPOTHÉTIQUE des titres du fonds, avant frais. */
  performance_pct: number;
}

export interface ResultatOpcvm extends Lecture {
  points: { annee: number; avecFrais: number; sansFrais: number }[];
  valeurFinale: number;
  valeurSansFrais: number;
  totalFrais: number;
  totalFraisPct: number;
  /** Performance annuelle avant frais qui rend tout juste la mise. */
  performancePourCompenserPct: number;
}

export function calculerOpcvm(p: ParamsOpcvm): ResultatOpcvm {
  exiger(positif(p.montant), 'Le montant doit être supérieur à zéro.');
  exiger(Number.isInteger(p.annees) && p.annees >= 1 && p.annees <= 30, 'La durée doit être un entier de 1 à 30 ans.');
  for (const [v, nom] of [[p.frais_entree_pct, 'd’entrée'], [p.frais_gestion_pct, 'de gestion'], [p.frais_sortie_pct, 'de sortie']] as const) {
    exiger(Number.isFinite(v) && v >= 0 && v < 20, `Les frais ${nom} doivent être compris entre 0 et 20 %.`);
  }
  exiger(Number.isFinite(p.performance_pct) && p.performance_pct > -50 && p.performance_pct <= 30, 'La performance doit être comprise entre −50 et 30 % par an.');
  const fe = p.frais_entree_pct / 100;
  const fg = p.frais_gestion_pct / 100;
  const fs = p.frais_sortie_pct / 100;
  const r = p.performance_pct / 100;
  let encours = p.montant * (1 - fe);
  let sans = p.montant;
  const points = [{ annee: 0, avecFrais: encours, sansFrais: sans }];
  for (let a = 1; a <= p.annees; a++) {
    encours = encours * (1 + r) * (1 - fg);
    sans *= 1 + r;
    points.push({ annee: a, avecFrais: encours, sansFrais: sans });
  }
  const valeurFinale = encours * (1 - fs);
  const totalFrais = sans - valeurFinale;
  const totalFraisPct = (totalFrais / p.montant) * 100;
  const performancePourCompenserPct = (((1 / ((1 - fe) * (1 - fs))) ** (1 / p.annees)) / (1 - fg) - 1) * 100;
  const alertes: string[] = [];
  if (p.frais_entree_pct > 5) alertes.push(`Des frais d’entrée de ${fmtPct(p.frais_entree_pct)} dépassent nettement l’exemple de la leçon (2 %) : ils se négocient parfois.`);
  if (p.frais_gestion_pct > 3) alertes.push(`Des frais de gestion de ${fmtPct(p.frais_gestion_pct)} par an pèsent lourd sur la durée.`);
  const lecture =
    `Sur ${nb(p.annees)} ans, les frais coûtent ${fmtFcfa(totalFrais)}, soit ${fmtPct(totalFraisPct)} de la somme investie : ` +
    `${fmtFcfa(valeurFinale)} au lieu de ${fmtFcfa(sans)} sans frais. ` +
    `Pour seulement retrouver votre mise, les titres du fonds doivent gagner ${fmtPct(performancePourCompenserPct, 2)} par an.`;
  return { points, valeurFinale, valeurSansFrais: sans, totalFrais, totalFraisPct, performancePourCompenserPct, lecture, alertes };
}

// ── 11. Taille de position, stop et rapport gain sur risque ─────────────────

export interface ParamsPosition {
  portefeuille: number;
  risque_pct: number;
  prix_achat: number;
  stop: number;
  /** Objectif de cours (0 = non renseigné). */
  objectif: number;
}

export interface ResultatPosition extends Lecture {
  risqueMax: number;
  risqueParAction: number;
  actions: number;
  investi: number;
  partPortefeuillePct: number;
  plafonneParCapital: boolean;
  perteSiStop: number;
  rapportGainRisque: number | null;
  tauxReussiteNecessairePct: number | null;
}

export function calculerPosition(p: ParamsPosition): ResultatPosition {
  exiger(positif(p.portefeuille) && positif(p.prix_achat) && positif(p.stop), 'Les montants doivent être supérieurs à zéro.');
  exiger(Number.isFinite(p.risque_pct) && p.risque_pct > 0 && p.risque_pct <= 20, 'Le risque accepté doit être compris entre 0 et 20 %.');
  exiger(p.stop < p.prix_achat, 'Le stop doit être placé sous le prix d’achat.');
  exiger(finiPositifOuNul(p.objectif), 'L’objectif ne peut pas être négatif.');
  const risqueMax = (p.portefeuille * p.risque_pct) / 100;
  const risqueParAction = p.prix_achat - p.stop;
  let actions = Math.floor(risqueMax / risqueParAction);
  const plafonneParCapital = actions * p.prix_achat > p.portefeuille;
  if (plafonneParCapital) actions = Math.floor(p.portefeuille / p.prix_achat);
  const investi = actions * p.prix_achat;
  const partPortefeuillePct = (investi / p.portefeuille) * 100;
  const perteSiStop = actions * risqueParAction;
  const rapportGainRisque = p.objectif > p.prix_achat ? (p.objectif - p.prix_achat) / risqueParAction : null;
  const tauxReussiteNecessairePct = rapportGainRisque != null ? (1 / (1 + rapportGainRisque)) * 100 : null;
  const alertes: string[] = [];
  if (p.risque_pct > 2) alertes.push(`Risquer ${fmtPct(p.risque_pct)} du portefeuille sur une seule position dépasse nettement le repère de la leçon (1 %) : quelques pertes de suite pèseraient lourd.`);
  if (risqueParAction / p.prix_achat < 0.02) alertes.push('Stop très proche du prix d’achat : il autorise une grosse position, mais il sera touché souvent, au moindre mouvement de séance.');
  if (plafonneParCapital) alertes.push('Le calcul demandait plus que tout le portefeuille : la position est plafonnée au capital disponible.');
  if (p.objectif > 0 && p.objectif <= p.prix_achat) alertes.push('L’objectif est sous le prix d’achat : aucun rapport gain sur risque ne se calcule.');
  if (actions === 0) alertes.push('Le risque par action dépasse le risque accepté : aucune action ne peut être achetée avec cette règle.');
  let lecture =
    `Perte maximale acceptée : ${fmtFcfa(risqueMax)}. Avec ${fmtFcfa(risqueParAction)} de risque par action, la règle autorise ${nb(actions)} actions, ` +
    `soit ${fmtFcfa(investi)} investis (${fmtPct(partPortefeuillePct)} du portefeuille) pour une perte de ${fmtFcfa(perteSiStop)} si le stop est touché.`;
  if (rapportGainRisque != null && tauxReussiteNecessairePct != null) {
    lecture += ` Rapport gain sur risque : ${fmtX(rapportGainRisque)}. Il faudrait avoir raison au moins ${fmtPct(tauxReussiteNecessairePct, 0)} du temps pour ne pas perdre, hors frais.`;
  }
  return { risqueMax, risqueParAction, actions, investi, partPortefeuillePct, plafonneParCapital, perteSiStop, rapportGainRisque, tauxReussiteNecessairePct, lecture, alertes };
}

// ── 12. Souscription à une introduction en bourse (réduction des ordres) ────

export interface ParamsSouscription {
  titres_offerts: number;
  prix: number;
  /** Demande ÷ offre, en % (142 = 1,42 fois les titres offerts). */
  taux_souscription_pct: number;
  /** Titres demandés par le lecteur. */
  demande: number;
}

export interface ResultatSouscription extends Lecture {
  coefficientServicePct: number;
  titresServis: number;
  montantEngage: number;
  montantPaye: number;
  montantRendu: number;
  titresDemandesTotal: number;
}

export function calculerSouscription(p: ParamsSouscription): ResultatSouscription {
  exiger(Number.isInteger(p.titres_offerts) && p.titres_offerts > 0, 'Le nombre de titres offerts doit être un entier positif.');
  exiger(positif(p.prix), 'Le prix doit être supérieur à zéro.');
  exiger(Number.isFinite(p.taux_souscription_pct) && p.taux_souscription_pct > 0 && p.taux_souscription_pct <= 2000, 'Le taux de souscription doit être compris entre 0 et 2 000 %.');
  exiger(Number.isInteger(p.demande) && p.demande > 0, 'La demande doit être un nombre entier de titres.');
  const coef = p.taux_souscription_pct > 100 ? 100 / p.taux_souscription_pct : 1;
  const titresServis = Math.floor(p.demande * coef);
  const montantEngage = p.demande * p.prix;
  const montantPaye = titresServis * p.prix;
  const titresDemandesTotal = Math.round((p.titres_offerts * p.taux_souscription_pct) / 100);
  const alertes: string[] = [];
  if (titresServis === 0) alertes.push('Avec une réduction proportionnelle, cet ordre trop petit ne recevrait aucun titre : les règles réelles prévoient souvent un minimum servi, à lire dans la note d’information.');
  if (p.taux_souscription_pct < 100) alertes.push('L’offre n’a pas été entièrement souscrite : chaque ordre est servi en entier, mais tous les titres offerts n’ont pas trouvé preneur.');
  const lecture = p.taux_souscription_pct > 100
    ? `La demande a représenté ${nb(p.taux_souscription_pct / 100, 2)} fois l’offre : en réduction proportionnelle, chaque ordre est servi à ${fmtPct(coef * 100)}. ` +
      `Pour ${nb(p.demande)} titres demandés, vous en recevriez ${nb(titresServis)}, payés ${fmtFcfa(montantPaye)} ; ` +
      `les ${fmtFcfa(montantEngage - montantPaye)} restants vous seraient rendus. Demander plus pour recevoir plus suppose de bloquer davantage d’argent pendant l’opération.`
    : `L’offre n’a pas été sursouscrite : vos ${nb(p.demande)} titres seraient servis en entier, pour ${fmtFcfa(montantPaye)}.`;
  return { coefficientServicePct: coef * 100, titresServis, montantEngage, montantPaye, montantRendu: montantEngage - montantPaye, titresDemandesTotal, lecture, alertes };
}

// ── 13. Affectation du résultat : du bénéfice au dividende ──────────────────

export interface ParamsDistribution {
  resultat_net: number;
  actions: number;
  taux_distribution_pct: number;
}

export interface ResultatDistribution extends Lecture {
  bpa: number;
  dpa: number;
  distribue: number;
  misEnReserve: number;
}

export function calculerDistribution(p: ParamsDistribution): ResultatDistribution {
  exiger(Number.isFinite(p.resultat_net), 'Le résultat net doit être un nombre.');
  exiger(Number.isInteger(p.actions) && p.actions > 0, 'Le nombre d’actions doit être un entier positif.');
  exiger(Number.isFinite(p.taux_distribution_pct) && p.taux_distribution_pct >= 0 && p.taux_distribution_pct <= 150, 'Le taux de distribution doit être compris entre 0 et 150 %.');
  const bpa = p.resultat_net / p.actions;
  if (p.resultat_net <= 0) {
    return {
      bpa, dpa: 0, distribue: 0, misEnReserve: 0,
      lecture: 'Sans bénéfice, il n’y a rien à affecter : un dividende versé malgré une perte serait prélevé sur les réserves des années passées.',
      alertes: [],
    };
  }
  const distribue = (p.resultat_net * p.taux_distribution_pct) / 100;
  const misEnReserve = p.resultat_net - distribue;
  const dpa = distribue / p.actions;
  const alertes: string[] = [];
  if (p.taux_distribution_pct > 100) alertes.push('Distribuer plus que le bénéfice de l’année puise dans les réserves : ce n’est pas durable année après année.');
  else if (p.taux_distribution_pct >= 90) alertes.push('Une société qui distribue presque tout garde peu pour investir : sa croissance future en dépend.');
  const lecture =
    `Bénéfice par action : ${fmtFcfa(bpa)}. En distribuant ${fmtPct(p.taux_distribution_pct, 0)}, l’assemblée verse ${fmtFcfa(dpa)} par action ` +
    `et ${misEnReserve >= 0 ? `met ${fmtFcfa(misEnReserve)} en réserve, qui renforcent les fonds propres` : `prélève ${fmtFcfa(-misEnReserve)} sur les réserves`}.`;
  return { bpa, dpa, distribue, misEnReserve, lecture, alertes };
}

// ── 14. Change euro – franc CFA et frais de transfert ───────────────────────

export interface ParamsChange {
  montant_eur: number;
  frais_pct: number;
  frais_fixes_eur: number;
  /** Cours d'une action, pour compter les titres achetables (0 = non renseigné). */
  cours_action: number;
}

export interface ResultatChange extends Lecture {
  fraisEur: number;
  fraisPct: number;
  netEur: number;
  fcfa: number;
  actions: number | null;
}

export function calculerChange(p: ParamsChange): ResultatChange {
  exiger(positif(p.montant_eur), 'Le montant doit être supérieur à zéro.');
  exiger(Number.isFinite(p.frais_pct) && p.frais_pct >= 0 && p.frais_pct < 50, 'Les frais doivent être compris entre 0 et 50 %.');
  exiger(finiPositifOuNul(p.frais_fixes_eur) && finiPositifOuNul(p.cours_action), 'Les montants ne peuvent pas être négatifs.');
  const fraisEur = (p.montant_eur * p.frais_pct) / 100 + p.frais_fixes_eur;
  exiger(fraisEur < p.montant_eur, 'Les frais dépassent le montant envoyé.');
  const netEur = p.montant_eur - fraisEur;
  const fcfa = netEur * PARITE_EUR_FCFA;
  const fraisPct = (fraisEur / p.montant_eur) * 100;
  const actions = p.cours_action > 0 ? Math.floor(fcfa / p.cours_action) : null;
  const alertes: string[] = [];
  if (fraisPct > 3) alertes.push(`Les frais absorbent ${fmtPct(fraisPct)} de l’envoi : sur un petit transfert, des frais fixes pèsent lourd. Regrouper les envois réduit leur poids.`);
  let lecture = `${nb(p.montant_eur, 2)} € envoyés deviennent ${fmtFcfa(fcfa)} sur votre compte, après ${nb(fraisEur, 2)} € de frais (${fmtPct(fraisPct)}). La parité, elle, ne bouge pas.`;
  if (actions != null) lecture += ` À ${fmtFcfa(p.cours_action)} l’action, cela paie ${nb(actions)} titre(s), hors frais de courtage.`;
  return { fraisEur, fraisPct, netEur, fcfa, actions, lecture, alertes };
}

// ── Module zéro (2026-11-23) : croissance, endettement, ROE moyen ───────────

export interface ParamsCroissance {
  valeur_initiale: number;
  valeur_finale: number;
  /** Nombre d'années ENTRE les deux valeurs (2021 → 2025 : 4). */
  annees: number;
}

export interface ResultatCroissance extends Lecture {
  croissanceTotalePct: number;
  /** Taux de croissance annuel moyen (TCAM). */
  tcamPct: number;
  /** Valeur de chaque année si la croissance avait été régulière, de l'initiale à la finale. */
  trajectoire: number[];
}

export function calculerCroissance(p: ParamsCroissance): ResultatCroissance {
  exiger(positif(p.valeur_initiale) && positif(p.valeur_finale), 'Les deux valeurs doivent être supérieures à zéro.');
  exiger(Number.isInteger(p.annees) && p.annees >= 1, 'Le nombre d’années doit être un entier d’au moins 1.');
  const facteur = p.valeur_finale / p.valeur_initiale;
  const croissanceTotalePct = (facteur - 1) * 100;
  const tcamPct = (Math.pow(facteur, 1 / p.annees) - 1) * 100;
  const trajectoire = Array.from({ length: p.annees + 1 }, (_, k) => p.valeur_initiale * Math.pow(1 + tcamPct / 100, k));
  const alertes: string[] = [];
  if (p.annees === 1) alertes.push('Sur une seule année, le TCAM se confond avec la croissance annuelle.');
  const lecture = `De ${nb(p.valeur_initiale, 1)} à ${nb(p.valeur_finale, 1)} en ${nb(p.annees)} an${p.annees > 1 ? 's' : ''} : ${fmtPct(croissanceTotalePct)} au total, soit un taux de croissance annuel moyen de ${fmtPct(tcamPct)}. Le TCAM lisse le parcours : une année forte et une année faible peuvent donner le même taux qu’une progression régulière.`;
  return { croissanceTotalePct, tcamPct, trajectoire, lecture, alertes };
}

export interface ParamsEndettement {
  dettes_financieres: number;
  tresorerie: number;
  capitaux_propres: number;
  resultat_operationnel: number;
  charges_interets: number;
}

export interface ResultatEndettement extends Lecture {
  detteNette: number;
  gearingPct: number;
  /** Résultat opérationnel ÷ charges d'intérêts ; null sans charges d'intérêts. */
  couverture: number | null;
}

export function calculerEndettement(p: ParamsEndettement): ResultatEndettement {
  exiger(finiPositifOuNul(p.dettes_financieres) && finiPositifOuNul(p.tresorerie) && finiPositifOuNul(p.charges_interets), 'Dettes, trésorerie et charges d’intérêts ne peuvent pas être négatives.');
  exiger(positif(p.capitaux_propres), 'Les capitaux propres doivent être supérieurs à zéro pour calculer le gearing.');
  exiger(Number.isFinite(p.resultat_operationnel), 'Le résultat opérationnel doit être un nombre.');
  const detteNette = p.dettes_financieres - p.tresorerie;
  const gearingPct = (detteNette / p.capitaux_propres) * 100;
  const couverture = p.charges_interets > 0 ? p.resultat_operationnel / p.charges_interets : null;
  const alertes: string[] = [];
  if (gearingPct > 100) alertes.push(`Un gearing de ${fmtPct(gearingPct)} : la dette nette dépasse les capitaux propres.`);
  if (couverture != null && couverture < 3) alertes.push(`Le résultat opérationnel ne couvre les intérêts que ${fmtX(couverture)} fois : une baisse d’activité pèserait vite sur le résultat.`);
  let lecture = detteNette < 0
    ? `La trésorerie dépasse les dettes financières : l’entreprise est en trésorerie nette de ${nb(-detteNette, 1)}. Le gearing est négatif (${fmtPct(gearingPct)}).`
    : `Dette nette de ${nb(detteNette, 1)}, soit un gearing de ${fmtPct(gearingPct)} des capitaux propres.`;
  lecture += couverture == null
    ? ' Sans charges d’intérêts, la couverture ne se calcule pas.'
    : ` Le résultat opérationnel couvre ${fmtX(couverture)} fois les charges d’intérêts.`;
  lecture += ' Ces ratios ne s’appliquent pas à une banque, dont la dette est la matière première.';
  return { detteNette, gearingPct, couverture, lecture, alertes };
}

export interface ParamsRoeMoyen {
  resultat_net: number;
  capitaux_debut: number;
  capitaux_fin: number;
  actif_debut?: number;
  actif_fin?: number;
}

export interface ResultatRoeMoyen extends Lecture {
  roeClotPct: number;
  roeMoyenPct: number;
  /** ROA sur actif moyen ; null sans les deux totaux d'actif. */
  roaMoyenPct: number | null;
}

export function calculerRoeMoyen(p: ParamsRoeMoyen): ResultatRoeMoyen {
  exiger(Number.isFinite(p.resultat_net), 'Le résultat net doit être un nombre.');
  exiger(positif(p.capitaux_debut) && positif(p.capitaux_fin), 'Les capitaux propres doivent être supérieurs à zéro.');
  const roeClotPct = (p.resultat_net / p.capitaux_fin) * 100;
  const moyens = (p.capitaux_debut + p.capitaux_fin) / 2;
  const roeMoyenPct = (p.resultat_net / moyens) * 100;
  const actifs = p.actif_debut != null && p.actif_fin != null && positif(p.actif_debut) && positif(p.actif_fin);
  const roaMoyenPct = actifs ? (p.resultat_net / ((p.actif_debut! + p.actif_fin!) / 2)) * 100 : null;
  const ecart = roeMoyenPct - roeClotPct;
  const alertes: string[] = [];
  if (Math.abs(ecart) >= 2) alertes.push(`Écart de ${fmtPct(Math.abs(ecart))} entre les deux méthodes : comparez deux sociétés avec la même.`);
  let lecture = `ROE sur capitaux propres moyens : ${fmtPct(roeMoyenPct)} ; sur capitaux de clôture : ${fmtPct(roeClotPct)}.`;
  lecture += p.capitaux_fin > p.capitaux_debut
    ? ' Quand les capitaux propres augmentent dans l’année, le ROE de clôture sous-estime le rendement réellement obtenu.'
    : ' Quand les capitaux propres baissent dans l’année, le ROE de clôture surestime le rendement réellement obtenu.';
  if (roaMoyenPct != null) lecture += ` Rapporté à l’actif moyen, le résultat donne un ROA de ${fmtPct(roaMoyenPct, 2)}.`;
  return { roeClotPct, roeMoyenPct, roaMoyenPct, lecture, alertes };
}

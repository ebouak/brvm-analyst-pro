/**
 * Lecture commentée d'une séance : bruit, carnet d'ordres, technique, comptes,
 * actualité — puis ce que ces lectures disent ENSEMBLE.
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI ──
 * La première version énonçait des faits exacts SANS leur échelle, et trois
 * d'entre eux se lisaient à l'envers :
 *
 *  1. « 93 titres demandés contre 10 offerts » faisait lire une pression
 *     acheteuse. Ces deux ordres pesaient 0,8 M FCFA quand la séance en
 *     échangeait 22,5 M : un reliquat, pas un rapport de force. Un chiffre
 *     juste privé de son ordre de grandeur induit en erreur aussi sûrement
 *     qu'un chiffre faux.
 *  2. « avec une confiance de 92 % » se lisait « sûr à 92 % ». Or la confiance
 *     du moteur (scoring §9) vaut 0,5·complétude + 0,3·profondeur d'historique
 *     + 0,2·netteté : elle mesure la QUALITÉ DES DONNÉES, jamais la justesse
 *     d'une prévision.
 *  3. une variation était commentée sans qu'on sache si elle sortait du bruit
 *     ordinaire de la valeur. −1,22 % sur un titre dont l'écart-type est de
 *     1,72 %, ce n'est pas un mouvement : c'est une journée comme les autres.
 *
 * ── LA RÈGLE ──
 * Chaque constat porte un FAIT (ce qui est à l'écran) et sa PORTÉE (à quoi il
 * se compare, ce qu'il coûte, ce qu'il pèse). Sans élément de comparaison, la
 * portée est vide — jamais devinée.
 *
 * ── LES TROIS LECTURES, ET LEUR COHÉRENCE ──
 * Le marché (carnet, capitaux), la technique (RSI/MACD/tendance) et les
 * comptes (résultat, fonds propres, valorisation) ne mesurent pas la même
 * chose et peuvent se contredire durablement. La synthèse DIT quand elles
 * divergent, et refuse d'en tirer un sens : un titre peut coter sous ses fonds
 * propres pendant des années.
 *
 * Trois interdits demeurent, et ce sont eux qui justifient un module plutôt
 * qu'un texte libre confié à un modèle :
 *  1. aucun chiffre qui ne vienne d'un champ reçu (ou d'un calcul sur ces
 *     champs, explicite dans le code) ;
 *  2. aucun lien de CAUSE entre les lectures — le carnet ne dit pas pourquoi
 *     les ordres sont là, et une actualité voisine dans le temps n'explique
 *     rien ;
 *  3. aucune recommandation — ni « à acheter », ni « à surveiller », ni
 *     « opportunité ».
 *
 * Décrire, comparer, mettre à l'échelle : oui. Prédire ou conseiller : non.
 */

import { phraseEvenement, type MesureEvenement } from './evenements';
import type { LectureIntermediaire } from '../financials/interim';

export interface CarnetSeance {
  date_marche: string;
  qte_achat: number | null;
  cours_achat: number | null;
  qte_vente: number | null;
  cours_vente: number | null;
  achat_au_marche: boolean;
  vente_au_marche: boolean;
  cours_reference: number | null;
}

/** Les facteurs du scoring §9, tels qu'on les nomme au lecteur. */
export type FacteurNom = 'variation' | 'volume' | 'rsi' | 'macd' | 'tendance';

const LIBELLE_FACTEUR: Record<FacteurNom, string> = {
  variation: 'la variation du jour',
  volume: 'le volume',
  rsi: 'le RSI',
  macd: 'le MACD',
  tendance: 'la tendance de fond',
};

export interface SignalSeance {
  date_marche: string;
  signal: string;
  confiance: number | null;
  /** Score §9, borné à [-1, +1]. Les seuils sont ±0,60. */
  score_total?: number | null;
  /** Phrase de facteurs produite par le moteur (`signals_daily.explication`). */
  explication?: string | null;
  /**
   * Sous-scores §9, bornés à ±1, NOMMÉS. Seule base permettant d'affirmer que
   * les facteurs se contredisent — et de dire LESQUELS. Sans les nommer, la
   * phrase « ses facteurs se contredisent » reste invérifiable : sur SNTS, la
   * liste affichée annonce « RSI 70 (neutre) » quand le sous-score vaut −0,99.
   */
  sousScores?: Partial<Record<FacteurNom, number | null>> | null;
}

export interface ActualiteRecente {
  titre: string;
  date_publication: string;
}

/**
 * De quoi juger si la séance sort de l'ordinaire. Sans écart-type, on ne
 * qualifie pas le mouvement — on se contente de le citer.
 */
export interface BruitSeance {
  variationPct?: number | null;
  /** Écart-type des variations quotidiennes, en %. */
  ecartTypePct?: number | null;
  /** Nombre de séances ayant servi à le calculer. */
  seancesObservees?: number | null;
  /** Volume du jour rapporté à la moyenne 30 j (1 = normal). */
  volumeRatio?: number | null;
}

/**
 * Les comptes du dernier exercice publié, et de quoi les rapporter au cours.
 * Tout est facultatif : 4 sociétés sur 48 n'ont aucune publication en base.
 */
export interface EconomieSociete {
  exercice: number;
  resultatNet?: number | null;
  resultatNetPrecedent?: number | null;
  chiffreAffaires?: number | null;
  chiffreAffairesPrecedent?: number | null;
  capitauxPropres?: number | null;
  /** Nombre de titres (`brvm_instruments.shares`). */
  actions?: number | null;
  /** Cours de clôture, pour la capitalisation. */
  coursJour?: number | null;
  /** `fundamentals.source` — « pdf-verified » vaut mieux qu'une extraction. */
  source?: string | null;
  /**
   * Comptes intermédiaires de l'année en cours (T1, S1, T3), tant que
   * l'exercice annuel correspondant n'est pas publié — voir
   * lib/financials/interim.ts (règle de remplacement, 12 mois glissants).
   */
  intermediaire?: LectureIntermediaire | null;
}

/** De quoi donner une échelle aux chiffres du carnet. */
export interface ContexteSeance {
  /** Capitaux échangés dans la séance, en FCFA — l'étalon du poids du carnet. */
  valeurEchangee?: number | null;
  /** Médiane des fourchettes du marché ce jour-là, en %. */
  spreadMedianMarche?: number | null;
  /** Combien de valeurs cotées ont une fourchette PLUS SERRÉE que celle-ci. */
  valeursPlusSerrees?: number | null;
  /** Nombre de valeurs dont la fourchette est connue ce jour-là. */
  valeursComparees?: number | null;
}

/** Un constat : le fait, sa portée, et l'origine de la donnée. */
export interface Constat {
  origine: 'bruit' | 'carnet' | 'signal' | 'economie' | 'evenement' | 'actualite';
  /** Le fait brut — retrouvable dans l'écran juste au-dessus. */
  fait: string;
  /** À quoi il se compare, ce qu'il coûte, ce qu'il pèse. Absent si rien ne permet de l'établir. */
  portee?: string;
}

export interface Commentaire {
  constats: Constat[];
  /** Ce que les lectures disent ENSEMBLE — convergence ou désaccord. Jamais une prévision. */
  synthese: string | null;
  /** Ce que ces constats ne permettent PAS de dire. Jamais vide. */
  limites: string[];
}

/* ───────────────────────── Seuils, tous nommés ───────────────────────── */

/** Seuils du moteur de scoring (scraper/src/scoring/score.ts). */
const SEUIL_ACHAT = 0.6;
const SEUIL_VENTE = -0.6;
/** En deçà, le carnet publié ne pèse plus rien face à la séance. */
const POIDS_NEGLIGEABLE_PCT = 10;
/** Montant de référence pour chiffrer une fourchette en francs. */
const REFERENCE_FCFA = 1_000_000;
/** Sous ce nombre de séances, aucun écart-type n'est assez fondé pour qualifier un mouvement. */
const MIN_SEANCES_VOLATILITE = 20;
/** Un mouvement sous 1 écart-type est indiscernable du bruit ; au-delà de 2, il est inhabituel. */
const SIGMA_NOTABLE = 1;
const SIGMA_INHABITUEL = 2;
/** En deçà, un sous-score est trop faible pour peser dans une divergence. */
const FACTEUR_SIGNIFIANT = 0.2;
/** Garde-fous contre les ratios absurdes nés d'une extraction fautive (cf. lib/secteurs/agregat.ts). */
const PER_MAX = 100;
const PBR_MAX = 30;
/** En deçà, une variation d'un exercice à l'autre est une stabilité, pas une évolution. */
const CROISSANCE_PLATE_PCT = 2;
/** Sujet des phrases de synthèse quand seuls les comptes annuels orientent la lecture. */
const ECO_SUJET_ANNUEL = 'Les comptes du dernier exercice';

/* ───────────────────────── Mise en forme ───────────────────────── */

const nb = (v: number) => v.toLocaleString('fr-FR');
/** Exportée pour `lib/carnet/evenements.ts`, qui reprend cette mise en forme plutôt que de la dupliquer. */
export const pc = (v: number, d = 2) =>
  `${v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
/** Exportée pour `lib/carnet/evenements.ts` — voir `pc` ci-dessus. */
export const dec = (v: number, d = 2) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Montant lisible : 22,5 millions plutôt que 22 533 095. */
export function fcfa(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${dec(v / 1_000_000_000, a >= 1_000_000_000_000 ? 0 : a >= 10_000_000_000 ? 1 : 2)} milliards de FCFA`;
  if (a >= 1_000_000) return `${dec(v / 1_000_000, 1)} millions de FCFA`;
  return `${nb(Math.round(v))} FCFA`;
}

/** Exportée pour `lib/carnet/evenements.ts` — voir `pc` ci-dessus. */
export const jour = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ───────────────────────── Calculs purs ───────────────────────── */

/** Écart en jours entre deux dates ISO. `null` si l'une est illisible. */
export function ecartJours(a: string, b: string): number | null {
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.round((x - y) / 86_400_000);
}

/** Fourchette en % du milieu. `null` si un côté manque ou est « au marché ». */
export function fourchettePct(c: CarnetSeance): number | null {
  if (c.achat_au_marche || c.vente_au_marche) return null;
  const a = c.cours_achat;
  const v = c.cours_vente;
  if (a == null || v == null || a <= 0 || v <= 0 || v < a) return null;
  return ((v - a) / ((v + a) / 2)) * 100;
}

/**
 * Valeur en FCFA de ce qui reste en carnet (les deux côtés). `null` si aucun
 * ordre n'est chiffrable — un ordre « au marché » n'a pas de cours.
 */
export function valeurCarnet(c: CarnetSeance): number | null {
  const a = c.qte_achat != null && c.cours_achat != null ? c.qte_achat * c.cours_achat : 0;
  const v = c.qte_vente != null && c.cours_vente != null ? c.qte_vente * c.cours_vente : 0;
  return a + v > 0 ? a + v : null;
}

/**
 * Le mouvement du jour rapporté à l'agitation ordinaire de la valeur.
 * `null` tant que l'historique est trop court pour qu'un écart-type veuille
 * dire quelque chose — sur un marché étroit, qualifier un mouvement sur cinq
 * séances serait une affirmation sans fondement.
 */
export function amplitudeEnSigma(b: BruitSeance): number | null {
  const { variationPct: v, ecartTypePct: s, seancesObservees: n } = b;
  if (v == null || s == null || s <= 0) return null;
  if (n != null && n < MIN_SEANCES_VOLATILITE) return null;
  return Math.abs(v) / s;
}

/**
 * Écart-type des variations quotidiennes, en %. C'est l'étalon qui permet de
 * dire si une séance sort de l'ordinaire. `null` sous le nombre de séances
 * requis : sur un marché étroit, un écart-type tiré de cinq points ne mesure
 * rien. Les zéros sont conservés — une séance sans mouvement EST une donnée.
 */
export function ecartTypeVariations(variations: (number | null | undefined)[]): { ecartTypePct: number | null; seances: number } {
  const v = variations.filter((x): x is number => x != null && Number.isFinite(x));
  if (v.length < MIN_SEANCES_VOLATILITE) return { ecartTypePct: null, seances: v.length };
  const moy = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, b) => a + (b - moy) ** 2, 0) / v.length;
  return { ecartTypePct: Math.sqrt(variance), seances: v.length };
}

/** Ratios de valorisation, bornés contre les extractions fautives. */
export function valorisation(e: EconomieSociete): { capitalisation: number | null; per: number | null; pbr: number | null } {
  const cap = e.actions != null && e.coursJour != null && e.actions > 0 && e.coursJour > 0 ? e.actions * e.coursJour : null;
  if (cap == null) return { capitalisation: null, per: null, pbr: null };
  const rn = e.resultatNet;
  const cp = e.capitauxPropres;
  const per = rn != null && rn > 0 ? cap / rn : null;
  const pbr = cp != null && cp > 0 ? cap / cp : null;
  return {
    capitalisation: cap,
    per: per != null && per > 0 && per < PER_MAX ? per : null,
    pbr: pbr != null && pbr > 0 && pbr < PBR_MAX ? pbr : null,
  };
}

/** Croissance d'un exercice à l'autre, en %. `null` si la base est nulle ou négative. */
export function croissancePct(actuel: number | null | undefined, precedent: number | null | undefined): number | null {
  if (actuel == null || precedent == null || precedent <= 0) return null;
  return ((actuel - precedent) / precedent) * 100;
}

/* ───────────────────────── Le commentaire ───────────────────────── */

export function commenterSeance(entree: {
  carnet: CarnetSeance | null;
  signal: SignalSeance | null;
  actualites?: ActualiteRecente[];
  contexte?: ContexteSeance;
  bruit?: BruitSeance;
  economie?: EconomieSociete | null;
  evenements?: MesureEvenement[];
}): Commentaire {
  const { carnet, signal } = entree;
  const actualites = entree.actualites ?? [];
  const ctx = entree.contexte ?? {};
  const economie = entree.economie ?? null;
  const evenements = entree.evenements ?? [];
  const constats: Constat[] = [];
  const limites: string[] = [];

  // Retenus pour la synthèse finale.
  let seanceOrdinaire: boolean | null = null;
  let carnetNegligeable = false;
  let carnetPenche: 'achat' | 'vente' | null = null;
  let signalPenche: 'hausse' | 'baisse' | 'aucun' | null = null;
  let ecoOrientation: 'favorable' | 'degradee' | 'contrastee' | null = null;
  // Sujet des phrases de synthèse sur les comptes : les plus récents qui orientent.
  let ecoSujet = ECO_SUJET_ANNUEL;
  let coteSousFondsPropres = false;

  /* ── 1. La séance sort-elle de l'ordinaire ? ─────────────────────────── */
  if (entree.bruit) {
    const b = entree.bruit;
    const sigma = amplitudeEnSigma(b);
    if (b.variationPct != null) {
      const sens = b.variationPct > 0 ? 'progressé' : b.variationPct < 0 ? 'reculé' : 'terminé inchangé';
      const fait = b.variationPct === 0
        ? 'Le cours a terminé la séance inchangé.'
        : `Le cours a ${sens} de ${pc(Math.abs(b.variationPct))} sur la séance.`;

      let portee: string | undefined;
      if (sigma != null && b.ecartTypePct != null) {
        seanceOrdinaire = sigma < SIGMA_NOTABLE;
        const cadre = `d'une séance à l'autre, le titre varie en moyenne de ${pc(b.ecartTypePct)}`;
        portee = sigma < SIGMA_NOTABLE
          ? `Ce mouvement reste dans la variation habituelle du titre : ${cadre}. Rien ne le distingue du bruit de marché.`
          : sigma < SIGMA_INHABITUEL
            ? `Ce mouvement dépasse la variation habituelle du titre (${cadre}), sans être inhabituel.`
            : `Ce mouvement représente ${dec(sigma, 1)} fois la variation habituelle du titre (${cadre}) : la séance est inhabituelle.`;
      }
      if (b.volumeRatio != null && b.volumeRatio > 0) {
        const vr = b.volumeRatio < 0.6
          ? `Les échanges sont faibles : ${dec(b.volumeRatio, 1)} fois le volume habituel.`
          : b.volumeRatio > 2
            ? `Les échanges sont soutenus : ${dec(b.volumeRatio, 1)} fois le volume habituel.`
            : null;
        if (vr) portee = portee ? `${portee} ${vr}` : vr;
      }
      constats.push({ origine: 'bruit', fait, portee });
      if (sigma == null) {
        limites.push("L'historique est trop court pour qualifier ce mouvement : il est seulement cité.");
      }
    }
  }

  /* ── 2. Le carnet : ce qui reste à la clôture, et ce qu'il pèse ──────── */
  if (carnet) {
    const a = carnet.qte_achat ?? 0;
    const v = carnet.qte_vente ?? 0;
    const q = jour(carnet.date_marche);

    if (a === 0 && v === 0) {
      constats.push({
        origine: 'carnet',
        fait: `Le carnet était vide à la clôture du ${q} : aucun ordre n'est resté sans contrepartie.`,
        portee: 'Tous les ordres présentés à l’achat comme à la vente ont été exécutés.',
      });
    } else {
      const detail = [
        a > 0 ? `${nb(a)} titre${a > 1 ? 's' : ''} ${carnet.achat_au_marche ? 'demandé au marché' : `demandé${a > 1 ? 's' : ''}${carnet.cours_achat != null ? ` à ${nb(carnet.cours_achat)} FCFA` : ''}`}` : null,
        v > 0 ? `${nb(v)} ${carnet.vente_au_marche ? 'offert au marché' : `offert${v > 1 ? 's' : ''}${carnet.cours_vente != null ? ` à ${nb(carnet.cours_vente)} FCFA` : ''}`}` : null,
      ].filter(Boolean).join(', et ');

      if (a > 0 && v > 0) carnetPenche = a > v ? 'achat' : v > a ? 'vente' : null;

      constats.push({
        origine: 'carnet',
        fait: `À la clôture du ${q}, ordres restés sans contrepartie : ${detail}.`,
        portee: porteeDuCarnet(carnet, ctx, (n) => { carnetNegligeable = n; }),
      });
    }

    const f = fourchettePct(carnet);
    if (f != null) {
      const ecartFcfa = carnet.cours_vente != null && carnet.cours_achat != null ? carnet.cours_vente - carnet.cours_achat : null;
      const cout = Math.round((f / 100) * REFERENCE_FCFA);
      const situation = situerFourchette(f, ctx);
      constats.push({
        origine: 'carnet',
        fait: ecartFcfa != null
          ? `${nb(ecartFcfa)} FCFA ${ecartFcfa > 1 ? 'séparaient' : 'séparait'} le meilleur acheteur du meilleur vendeur, soit ${pc(f)} du cours.`
          : `${pc(f)} séparaient le meilleur acheteur du meilleur vendeur.`,
        portee: `Un aller-retour immédiat (achat puis revente) coûterait environ ${nb(cout)} FCFA par million de FCFA investi, hors frais de courtage.${situation ? ` ${situation}` : ''}`,
      });
    } else if (carnet.achat_au_marche || carnet.vente_au_marche) {
      constats.push({
        origine: 'carnet',
        fait: `Un ordre « au marché » était en attente du côté ${carnet.vente_au_marche ? 'vente' : 'achat'}.`,
        portee: "Un ordre « au marché » s'exécute au prix disponible, sans limite de prix : aucune fourchette ne peut donc être mesurée sur cette séance.",
      });
    }

    limites.push("Le carnet n'indique ni l'auteur des ordres ni leur motif. Le bulletin de la cote ne publie que la meilleure limite de chaque côté : la profondeur complète du marché n'est pas visible.");
  }

  /* ── 3. La lecture technique ─────────────────────────────────────────── */
  if (signal) {
    const s = signal.score_total;
    const estHold = signal.signal === 'HOLD';
    if (s != null) signalPenche = s > 0.05 ? 'hausse' : s < -0.05 ? 'baisse' : 'aucun';

    const positionScore = s == null ? '' :
      ` Score : ${dec(s)} sur une échelle de −1 à +1 ; un signal d'achat exige plus de +${dec(SEUIL_ACHAT, 1)}, un signal de vente moins de −${dec(Math.abs(SEUIL_VENTE), 1)}.`;

    constats.push({
      origine: 'signal',
      fait: estHold
        ? `Sur la séance du ${jour(signal.date_marche)}, la lecture technique reste neutre.${positionScore}`
        : `Sur la séance du ${jour(signal.date_marche)}, la lecture technique donne un signal ${signal.signal === 'BUY' ? "d'achat" : signal.signal === 'SELL' ? 'de vente' : signal.signal}.${positionScore}`,
      portee: facteursEtConfiance(signal, estHold),
    });

    if (carnet && signal.date_marche !== carnet.date_marche) {
      const j = ecartJours(signal.date_marche, carnet.date_marche);
      limites.push(
        j == null
          ? 'Le signal et le carnet ne portent pas sur la même séance.'
          : `Le signal porte sur une séance ${j > 0 ? 'postérieure' : 'antérieure'} de ${Math.abs(j)} jour${Math.abs(j) > 1 ? 's' : ''} à celle du carnet : le bulletin de la cote paraît après la clôture, il a donc toujours une séance de retard.`,
      );
    }
    limites.push("La lecture technique ne repose que sur l'historique des cours et des volumes ; elle ne tient pas compte des comptes de la société.");
  }

  /* ── 4. La lecture des comptes ───────────────────────────────────────── */
  if (economie) {
    const { capitalisation, per, pbr } = valorisation(economie);
    const cCA = croissancePct(economie.chiffreAffaires, economie.chiffreAffairesPrecedent);
    const cRN = croissancePct(economie.resultatNet, economie.resultatNetPrecedent);
    ecoOrientation = orienterEconomie(cCA, cRN);
    coteSousFondsPropres = pbr != null && pbr < 1;

    const bloc = [
      economie.resultatNet != null ? `${fcfa(economie.resultatNet)} de résultat net` : null,
      economie.chiffreAffaires != null ? `${fcfa(economie.chiffreAffaires)} de chiffre d'affaires` : null,
    ].filter(Boolean);

    if (bloc.length > 0 || capitalisation != null) {
      const evolution = [
        cCA != null ? `le chiffre d'affaires ${sensCroissance(cCA)}` : null,
        cRN != null ? `le résultat net ${sensCroissance(cRN)}` : null,
      ].filter(Boolean).join(' et ');

      const ratios = [
        per != null ? `${dec(per, 1)} fois son résultat annuel` : null,
        pbr != null ? `${dec(pbr, 2)} fois ses fonds propres` : null,
      ].filter(Boolean);

      const portee = [
        capitalisation != null && ratios.length > 0
          ? `Au cours du jour, la société vaut ${fcfa(capitalisation)} en Bourse, soit ${ratios.join(' et ')}.`
          : null,
        coteSousFondsPropres
          ? "Le marché la valorise donc sous la valeur comptable de ses capitaux propres. Un tel écart peut durer des années ; il ne dit rien du prochain mouvement du cours."
          : null,
        evolution ? `D'un exercice à l'autre, ${evolution}.` : null,
      ].filter(Boolean).join(' ');

      constats.push({
        origine: 'economie',
        fait: bloc.length > 0
          ? `Sur le dernier exercice publié (${economie.exercice}), la société affiche ${bloc.join(' pour ')}.`
          : `Les comptes du dernier exercice publié portent sur ${economie.exercice}.`,
        portee: portee || undefined,
      });

      limites.push(
        `Les comptes portent sur l'exercice ${economie.exercice}, désormais clos : ils ne décrivent pas la situation actuelle de la société${economie.source === 'pdf-verified' ? ' (chiffres relevés sur les états financiers publiés)' : ''}.`,
      );
    }

    /* ── 4 bis. Les comptes intermédiaires de l'année en cours ───────────
       Plus récents que l'exercice : ce sont EUX qui orientent la lecture tant
       que l'exercice suivant n'est pas publié. La valorisation s'y rapporte
       sur douze mois glissants — jamais par une annualisation (semestre × 2),
       fausse pour toute activité saisonnière. ──────────────────────────── */
    const im = economie.intermediaire ?? null;
    if (im && (im.revenu != null || im.resultatNet != null)) {
      const neuf = im.mois === 9; // « les 9 premiers mois » appelle le pluriel
      const iCA = croissancePct(im.revenu, im.revenuPrecedent);
      const iRN = croissancePct(im.resultatNet, im.resultatNetPrecedent);
      const orientation = orienterEconomie(iCA, iRN);
      if (orientation) {
        ecoOrientation = orientation;
        ecoSujet = `Les comptes ${neuf ? 'des' : 'du'} ${im.libelle}`;
      }

      const blocI = [
        im.resultatNet != null ? `${fcfa(im.resultatNet)} de résultat net` : null,
        im.revenu != null ? `${fcfa(im.revenu)} de chiffre d'affaires` : null,
      ].filter(Boolean);
      const evolI = [
        iCA != null ? `le chiffre d'affaires ${sensCroissance(iCA)}` : null,
        iRN != null ? `le résultat net ${sensCroissance(iRN)}` : null,
      ].filter(Boolean).join(' et ');
      const rnG = im.glissant?.resultatNet ?? null;
      const perG = capitalisation != null && rnG != null && rnG > 0 ? capitalisation / rnG : null;

      const porteeI = [
        evolI ? `Par rapport ${neuf ? 'aux' : 'au'} ${im.libellePrecedent}, ${evolI}.` : null,
        im.glissant && rnG != null
          ? `Sur les ${im.glissant.libelle}, le résultat net atteint ${fcfa(rnG)}${perG != null && perG < PER_MAX ? ` : au cours du jour, la société vaut ${dec(perG, 1)} fois ce résultat` : ''}.`
          : null,
      ].filter(Boolean).join(' ');

      constats.push({
        origine: 'economie',
        fait: `Sur ${neuf ? 'les' : 'le'} ${im.libelle}, la société affiche ${blocI.join(' pour ')} (comptes intermédiaires).`,
        portee: porteeI || undefined,
      });
      limites.push(
        `Les comptes ${neuf ? 'des' : 'du'} ${im.libelle} sont intermédiaires : non audités (au mieux soumis à un examen limité des commissaires aux comptes), ils seront remplacés par les comptes annuels dès leur publication.`,
      );
    }
  }

  /* ── 5. Les événements de marché, et ce que le cours a fait après ─────
     Le point le plus tentant pour glisser une cause : une publication suivie
     d'une hausse ne prouve pas qu'elle l'a provoquée. `phraseEvenement` ne
     décrit qu'une succession dans le temps — jamais une explication. ──── */
  if (evenements.length > 0) {
    for (const mesure of evenements) {
      const { fait, portee } = phraseEvenement(mesure);
      constats.push({ origine: 'evenement', fait, portee });
    }
    limites.push("Ces mesures décrivent ce qui a suivi l'événement, pas ce qu'il a provoqué.");
  }

  /* ── 6. L'actualité, rapprochée par la date et par elle seule ────────── */
  if (actualites.length > 0) {
    const ref = carnet?.date_marche ?? signal?.date_marche ?? null;
    const a0 = actualites[0]!;
    const j = ref ? ecartJours(ref, a0.date_publication) : null;
    const quand = j == null || j < 0 ? `le ${jour(a0.date_publication)}`
      : j === 0 ? 'le jour même de cette séance'
      : `${j} jour${j > 1 ? 's' : ''} avant cette séance`;
    constats.push({
      origine: 'actualite',
      fait: `${actualites.length === 1 ? 'Une publication concerne' : `${actualites.length} publications concernent`} cette société, la plus récente parue ${quand} : « ${a0.titre} ».`,
      portee: 'Elle est citée pour sa date uniquement : le rapprochement est chronologique, pas explicatif.',
    });
    limites.push("Rien n'établit que cette publication explique les ordres en carnet ou la position de la lecture technique.");
  }

  if (constats.length === 0) {
    return {
      constats: [{ origine: 'carnet', fait: 'Aucune donnée de séance exploitable pour cette valeur.' }],
      synthese: null,
      limites: ["Ni carnet d'ordres, ni signal, ni comptes, ni publication récente ne sont disponibles pour cette valeur."],
    };
  }

  limites.push('Ces constats décrivent une séance passée et ne constituent pas un conseil en investissement.');
  return {
    constats,
    synthese: synthetiser({ seanceOrdinaire, carnetNegligeable, carnetPenche, signalPenche, ecoOrientation, ecoSujet, coteSousFondsPropres }),
    limites,
  };
}

/* ───────────────────────── Portées ───────────────────────── */

/**
 * Ce que pèse le carnet face à la séance. C'est LA phrase qui empêche de lire
 * « 93 contre 10 » comme un rapport de force.
 */
function porteeDuCarnet(c: CarnetSeance, ctx: ContexteSeance, marquerNegligeable: (n: boolean) => void): string | undefined {
  const val = valeurCarnet(c);
  const seance = ctx.valeurEchangee;
  if (val == null || seance == null || seance <= 0) {
    // Sans capitaux de la séance, rien ne permet de mettre à l'échelle — et on
    // se garde bien d'inventer un ordre de grandeur.
    return val != null ? `Ces ordres représentent ${fcfa(val)} au total.` : undefined;
  }
  const part = (val / seance) * 100;
  const negligeable = part < POIDS_NEGLIGEABLE_PCT;
  marquerNegligeable(negligeable);
  const partTxt = part < 1 ? 'moins de 1 %' : pc(part, part < 10 ? 1 : 0);
  return negligeable
    ? `Rapportés à la séance, ces ordres pèsent peu : ${fcfa(val)} au total, soit ${partTxt} des ${fcfa(seance)} échangés. L'écart entre acheteurs et vendeurs porte sur un reliquat ; il ne mesure pas un rapport de force.`
    : `Ces ordres représentent ${fcfa(val)}, soit ${partTxt} des ${fcfa(seance)} échangés dans la séance : une part notable de l'activité du jour.`;
}

/** Situe la fourchette parmi celles du marché ce jour-là. */
function situerFourchette(f: number, ctx: ContexteSeance): string | null {
  const { spreadMedianMarche: med, valeursPlusSerrees: mieux, valeursComparees: total } = ctx;
  if (med == null && (mieux == null || total == null)) return null;
  const rang = mieux != null && total != null && total > 1
    ? mieux === 0
      ? `c'est la fourchette la plus serrée des ${total} valeurs mesurées ce jour-là`
      : `${mieux} valeur${mieux > 1 ? 's' : ''} sur ${total} ${mieux > 1 ? 'affichent' : 'affiche'} une fourchette plus serrée`
    : null;
  const medTxt = med != null ? `la médiane du marché étant à ${pc(med)}` : null;
  const qualif = med == null ? '' : f > med * 1.5 ? 'Fourchette large pour la BRVM : ' : f < med * 0.66 ? 'Fourchette serrée pour la BRVM : ' : 'Fourchette dans la moyenne du marché : ';
  const corps = [rang, medTxt].filter(Boolean).join(', ');
  return corps ? `${qualif}${corps}.` : null;
}

/**
 * Les facteurs du moteur, et ce que « confiance » veut vraiment dire.
 * Le malentendu corrigé ici : la confiance mesure la qualité des données, pas
 * la certitude d'une direction.
 */
function facteursEtConfiance(signal: SignalSeance, estHold: boolean): string | undefined {
  const morceaux: string[] = [];

  const facteurs = extraireFacteurs(signal.explication);
  const div = facteursDivergents(signal.sousScores);
  // On ne se contente pas d'affirmer la contradiction : on NOMME les deux camps.
  // Sinon le lecteur lit « ils se contredisent » sous une liste qui, elle, a
  // l'air unanime — et n'a aucun moyen de trancher.
  const divergents = div?.divergent === true;
  if (estHold && divergents && div) {
    morceaux.push(`Elle reste neutre car ses facteurs s'opposent : ${et(div.hausse)} ${div.hausse.length > 1 ? 'tirent' : 'tire'} à la hausse, ${et(div.baisse)} à la baisse.`);
    if (facteurs) morceaux.push(`Facteurs retenus : ${facteurs}.`);
  } else if (facteurs) {
    // Sans sous-scores, ou sans opposition constatée, aucune contradiction
    // n'est affirmée : on énonce les facteurs, c'est tout.
    morceaux.push(estHold
      ? `Elle reste neutre : aucun facteur ne l'emporte nettement. Facteurs retenus : ${facteurs}.`
      : `Facteurs retenus : ${facteurs}.`);
  } else if (estHold) {
    morceaux.push("Elle reste neutre : aucun facteur ne l'emporte nettement.");
  }

  const c = signal.confiance;
  if (c != null) {
    const pct = Math.round(c * (c <= 1 ? 100 : 1));
    morceaux.push(`Le taux de confiance de ${pct} % mesure la qualité des données (historique disponible, séances complètes), pas la justesse d'une prévision.`);
  }

  return morceaux.length > 0 ? morceaux.join(' ') : undefined;
}

/**
 * Extrait la liste de facteurs de `signals_daily.explication`, dont la forme
 * est « Pas de signal franc (HOLD). Facteurs : A ; B ; C. ». Si la phrase ne
 * suit pas cette forme, on ne devine pas : on rend `null`.
 */
export function extraireFacteurs(explication: string | null | undefined): string | null {
  if (!explication) return null;
  const m = explication.match(/Facteurs\s*:\s*([^]+?)\.?\s*$/i);
  if (!m) return null;
  const liste = m[1]!.split(';').map((x) => x.trim()).filter(Boolean);
  if (liste.length === 0) return null;
  if (liste.length === 1) return liste[0]!;
  return `${liste.slice(0, -1).join(' ; ')} ; et ${liste[liste.length - 1]}`;
}

function sensCroissance(p: number): string {
  if (Math.abs(p) < CROISSANCE_PLATE_PCT) return `reste stable (${pc(p, 1)})`;
  return p > 0 ? `progresse de ${pc(p, 1)}` : `recule de ${pc(Math.abs(p), 1)}`;
}

function orienterEconomie(cCA: number | null, cRN: number | null): 'favorable' | 'degradee' | 'contrastee' | null {
  if (cCA == null && cRN == null) return null;
  const signe = (x: number | null) => (x == null ? null : Math.abs(x) < CROISSANCE_PLATE_PCT ? 0 : x > 0 ? 1 : -1);
  const a = signe(cCA);
  const b = signe(cRN);
  const vus = [a, b].filter((x): x is number => x != null);
  if (vus.length === 0) return null;
  if (vus.every((x) => x > 0)) return 'favorable';
  if (vus.every((x) => x < 0)) return 'degradee';
  if (vus.every((x) => x === 0)) return null;
  return 'contrastee';
}

/**
 * Ce que les lectures disent ENSEMBLE. Elle constate un accord ou un désaccord
 * entre des mesures de nature différente — elle ne prédit rien, ne recommande
 * rien, et ne fait d'aucune lecture l'explication d'une autre.
 */
function synthetiser(e: {
  seanceOrdinaire: boolean | null;
  carnetNegligeable: boolean;
  carnetPenche: 'achat' | 'vente' | null;
  signalPenche: 'hausse' | 'baisse' | 'aucun' | null;
  ecoOrientation: 'favorable' | 'degradee' | 'contrastee' | null;
  /** « Les comptes du dernier exercice » ou « Les comptes du 1er semestre 2026 ». */
  ecoSujet: string;
  coteSousFondsPropres: boolean;
}): string | null {
  const parties: string[] = [];
  const rienAuCarnet = e.carnetNegligeable;
  const rienEnTechnique = e.signalPenche === 'aucun';
  // Vrai dès que la phrase d'ouverture a déjà dit que la technique ne dit rien.
  let techniqueDeja = false;

  // a) La séance elle-même vaut-elle qu'on s'y arrête ?
  //    Les trois cas de « rien à signaler » sont traités ici, y compris quand
  //    aucune volatilité n'est fournie : sans cette branche, l'information
  //    « carnet trop petit » se perdait en silence.
  if (e.seanceOrdinaire === true && rienAuCarnet) {
    parties.push("Séance sans fait notable : le cours évolue dans sa variation habituelle et les ordres restés en carnet sont trop faibles pour être significatifs.");
  } else if (e.seanceOrdinaire === false) {
    parties.push("La séance sort de l'ordinaire par son ampleur.");
  } else if (rienAuCarnet && rienEnTechnique) {
    parties.push("Séance sans fait notable : les ordres restés en carnet sont trop faibles pour être significatifs et la lecture technique reste neutre.");
    techniqueDeja = true;
  } else if (rienAuCarnet) {
    parties.push("Les ordres restés en carnet sont trop faibles pour être significatifs : l'écart entre acheteurs et vendeurs porte sur des montants marginaux.");
  }

  // b) Technique contre carnet — seulement si le carnet pèse quelque chose.
  if (techniqueDeja) {
    // déjà dit
  } else if (!e.carnetNegligeable && e.carnetPenche && e.signalPenche && e.signalPenche !== 'aucun') {
    const accord = (e.carnetPenche === 'achat' && e.signalPenche === 'hausse') || (e.carnetPenche === 'vente' && e.signalPenche === 'baisse');
    parties.push(accord
      ? `Les ordres restés en carnet penchent côté ${e.carnetPenche}, et la lecture technique va dans le même sens. Les deux concordent sans se confirmer : elles ne mesurent pas la même chose.`
      : `Les ordres restés en carnet penchent côté ${e.carnetPenche}, la lecture technique vers la ${e.signalPenche} : les deux divergent, et rien ne permet ici de les départager.`);
  } else if (e.signalPenche === 'aucun') {
    parties.push('La lecture technique reste neutre.');
  } else if (e.signalPenche) {
    parties.push(`La lecture technique penche vers la ${e.signalPenche}, sans donner de signal.`);
  }

  // c) Technique contre comptes — la cohérence que réclame toute lecture sérieuse.
  if (e.ecoOrientation && e.signalPenche && e.signalPenche !== 'aucun') {
    const ecoSens = e.ecoOrientation === 'favorable' ? 1 : e.ecoOrientation === 'degradee' ? -1 : 0;
    const techSens = e.signalPenche === 'hausse' ? 1 : -1;
    parties.push(
      ecoSens === 0
        ? `${e.ecoSujet} donnent une image contrastée, que la lecture technique ne recoupe ni ne contredit.`
        : ecoSens === techSens
          ? `${e.ecoSujet} vont dans le même sens que la lecture technique. Cela ne fait pas une prévision : les deux décrivent le passé, l'un sur ${e.ecoSujet === ECO_SUJET_ANNUEL ? 'douze mois' : 'quelques mois'}, l'autre sur quelques séances.`
          : `${e.ecoSujet} et la lecture technique divergent : ${e.ecoOrientation === 'favorable' ? 'une activité en progression' : 'une activité en repli'} d'un côté, ${e.signalPenche === 'hausse' ? 'un cours orienté à la hausse' : 'un cours orienté à la baisse'} de l'autre. Un tel écart peut durer des années.`,
    );
  } else if (e.ecoOrientation && !e.signalPenche) {
    parties.push(e.ecoOrientation === 'favorable'
      ? `${e.ecoSujet} sont orientés favorablement.`
      : e.ecoOrientation === 'degradee'
        ? `${e.ecoSujet} sont orientés à la baisse.`
        : `${e.ecoSujet} donnent une image contrastée.`);
  }

  if (parties.length === 0) return null;
  return parties.join(' ');
}

/**
 * Les facteurs du moteur se contredisent-ils ? `true` SEULEMENT si des
 * sous-scores non négligeables portent des signes opposés ; `null` quand les
 * sous-scores ne sont pas fournis — on ne suppose alors rien, et le texte se
 * garde bien d'affirmer une contradiction qu'il n'a pas constatée.
 */
export function facteursDivergents(
  sousScores: Partial<Record<FacteurNom, number | null>> | null | undefined,
): { divergent: boolean; hausse: string[]; baisse: string[] } | null {
  if (!sousScores) return null;
  const hausse: string[] = [];
  const baisse: string[] = [];
  for (const [nom, val] of Object.entries(sousScores) as [FacteurNom, number | null | undefined][]) {
    if (val == null || !Number.isFinite(val) || Math.abs(val) < FACTEUR_SIGNIFIANT) continue;
    (val > 0 ? hausse : baisse).push(LIBELLE_FACTEUR[nom] ?? nom);
  }
  return { divergent: hausse.length > 0 && baisse.length > 0, hausse, baisse };
}

/** « le RSI et le MACD » — énumération française, sans virgule finale. */
function et(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? '';
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

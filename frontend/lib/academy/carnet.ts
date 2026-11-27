/**
 * Atelier « Choisissez votre ordre » — moteur PUR et testé (carnet.test.ts).
 *
 * Il n'applique QUE les catégories du règlement général de la BRVM (version du
 * 1er juillet 2022) : art. 44 limite (au mieux / à cours limité ; un ordre sans
 * limite indiquée est rejeté), art. 45 validité (jour par défaut, mensuel,
 * à exécution), art. 46 réponse partielle (sans condition / tout ou rien).
 * Aucun ordre « meilleure limite », « quantité minimale » ou « exécuté ou
 * éliminé » : ils n'existent pas au règlement BRVM.
 *
 * Sens ACHAT seulement : le carnet est le côté vente (prix croissants).
 * Les frais de courtage et l'impôt ne sont pas pris en compte.
 */

export interface NiveauCarnet {
  /** Prix en FCFA ; `null` = ordre « au marché » (aucun cours publié). */
  prix: number | null;
  quantite: number;
}

export type LimiteOrdre = 'au_mieux' | { prix: number } | null | undefined;
export type ConditionOrdre = 'sans' | 'tout_ou_rien';
export type ValiditeOrdre = 'jour' | 'mensuel' | 'a_execution';

export interface OrdreAchat {
  sens: 'achat';
  quantite: number;
  limite: LimiteOrdre;
  condition: ConditionOrdre;
  validite: ValiditeOrdre;
}

export interface OptionsExecution {
  /**
   * Vrai quand le carnet ne donne que la MEILLEURE limite (cas du Bulletin
   * officiel de la cote) : au-delà des quantités connues, la profondeur est
   * inconnue, jamais exécutée par hypothèse.
   */
  profondeurInconnue?: boolean;
}

export interface LigneExecution {
  prix: number;
  quantite: number;
  montant: number;
}

export type StatutOrdre = 'execute' | 'partiel' | 'non_execute' | 'rejete' | 'indetermine';

export interface ResultatOrdre {
  statut: StatutOrdre;
  lignes: LigneExecution[];
  quantiteServie: number;
  /** Prix moyen pondéré des titres servis ; `null` si rien n'est servi. */
  prixMoyen: number | null;
  coutTotal: number;
  /** Titres demandés non servis (hors quantité inconnue). */
  reliquat: number;
  /** Titres dont l'exécution ne peut pas être établie (profondeur inconnue). */
  quantiteInconnue: number;
  /** Niveaux « au marché » sans cours : écartés du calcul. */
  niveauxSansPrix: number;
  /** Phrase DÉRIVÉE du résultat, dite à l'utilisateur. */
  explication: string;
}

export const VALIDITES: Record<ValiditeOrdre, { libelle: string; sort: string }> = {
  jour: {
    libelle: 'Jour',
    sort: 'validité « jour » : présenté à la seule séance qui suit sa transmission, puis il disparaît',
  },
  mensuel: {
    libelle: 'Mensuel',
    sort: 'validité « mensuel » : il reste en attente jusqu’à la dernière séance du mois',
  },
  a_execution: {
    libelle: 'À exécution',
    sort: 'validité « à exécution » : il reste en attente trois mois au plus (ou jusqu’à la date limite choisie)',
  },
};

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const fmt = (n: number) => nf.format(n);
const arrondi2 = (x: number) => Math.round(x * 100) / 100;

function rejet(raison: string): ResultatOrdre {
  return {
    statut: 'rejete',
    lignes: [],
    quantiteServie: 0,
    prixMoyen: null,
    coutTotal: 0,
    reliquat: 0,
    quantiteInconnue: 0,
    niveauxSansPrix: 0,
    explication: `Ordre rejeté : ${raison}`,
  };
}

/**
 * Exécute un ordre d'achat contre le côté vente du carnet, niveaux parcourus
 * du prix le plus bas au plus haut. Un niveau dépassant la limite n'est jamais
 * touché.
 */
export function executerOrdre(
  carnet: NiveauCarnet[],
  ordre: OrdreAchat,
  options: OptionsExecution = {},
): ResultatOrdre {
  if (!Number.isInteger(ordre.quantite) || ordre.quantite <= 0) {
    return rejet('la quantité doit être un nombre entier de titres, supérieur à zéro.');
  }
  // Art. 44 : sans indication de limite, l'ordre est rejeté.
  if (ordre.limite == null) {
    return rejet('aucune limite de prix indiquée. Le règlement exige « au mieux » ou un cours limité.');
  }
  const plafond = ordre.limite === 'au_mieux' ? Infinity : ordre.limite.prix;
  if (!(plafond > 0)) return rejet('le cours limité doit être supérieur à zéro.');

  const niveauxSansPrix = carnet.filter((n) => n.prix == null && n.quantite > 0).length;
  const niveaux = carnet
    .filter((n): n is { prix: number; quantite: number } => n.prix != null && n.prix > 0 && n.quantite > 0)
    .sort((a, b) => a.prix - b.prix);

  const accessibles = niveaux.filter((n) => n.prix <= plafond);
  const disponible = accessibles.reduce((s, n) => s + n.quantite, 0);
  const inconnue = options.profondeurInconnue === true;

  // Tout ou rien : servi en totalité ou pas du tout.
  if (ordre.condition === 'tout_ou_rien' && disponible < ordre.quantite) {
    if (inconnue && disponible > 0) {
      return {
        statut: 'indetermine',
        lignes: [],
        quantiteServie: 0,
        prixMoyen: null,
        coutTotal: 0,
        reliquat: 0,
        quantiteInconnue: ordre.quantite,
        niveauxSansPrix,
        explication:
          `Tout ou rien : ${fmt(disponible)} titres sont visibles à votre limite, pour ${fmt(ordre.quantite)} demandés. ` +
          'Le carnet réel ne publie que la meilleure limite : on ne peut pas dire si le reste existe. Rien n’est présenté comme exécuté.',
      };
    }
    if (inconnue) return sansVisibilite(niveauxSansPrix, ordre.quantite);
    return {
      statut: 'non_execute',
      lignes: [],
      quantiteServie: 0,
      prixMoyen: null,
      coutTotal: 0,
      reliquat: ordre.quantite,
      quantiteInconnue: 0,
      niveauxSansPrix,
      explication:
        `Non exécuté : « tout ou rien » exige ${fmt(ordre.quantite)} titres ; ` +
        `seulement ${fmt(disponible)} sont proposés à votre limite ou en dessous. Il ne peut pas être servi partiellement.`,
    };
  }

  const lignes: LigneExecution[] = [];
  let reste = ordre.quantite;
  for (const n of accessibles) {
    if (reste <= 0) break;
    const q = Math.min(reste, n.quantite);
    lignes.push({ prix: n.prix, quantite: q, montant: n.prix * q });
    reste -= q;
  }
  const servie = ordre.quantite - reste;
  const cout = lignes.reduce((s, l) => s + l.montant, 0);
  const prixMoyen = servie > 0 ? arrondi2(cout / servie) : null;

  const quantiteInconnue = inconnue ? reste : 0;
  const reliquat = inconnue ? 0 : reste;
  const sort = VALIDITES[ordre.validite].sort;

  let statut: StatutOrdre;
  let explication: string;
  if (servie === 0) {
    if (inconnue) return sansVisibilite(niveauxSansPrix, ordre.quantite);
    statut = 'non_execute';
    explication =
      ordre.limite === 'au_mieux'
        ? 'Le carnet ne contient aucun vendeur : rien n’est exécuté.'
        : `Non exécuté : aucun vendeur à ${fmt(plafond)} FCFA ou moins. L’ordre attend (${sort}).`;
  } else if (reste === 0) {
    statut = 'execute';
    explication =
      `Servi en totalité : ${fmt(servie)} titres à ${fmt(prixMoyen!)} FCFA en moyenne, soit ${fmt(cout)} FCFA` +
      (lignes.length > 1 ? `, répartis sur ${lignes.length} niveaux de prix.` : '.');
    if (ordre.limite === 'au_mieux' && lignes.length > 1) {
      explication += ` Ce prix moyen est supérieur au meilleur prix affiché (${fmt(lignes[0]!.prix)} FCFA).`;
    }
  } else if (inconnue) {
    statut = 'partiel';
    explication =
      `${fmt(servie)} titres sont visibles à ${fmt(prixMoyen!)} FCFA. Pour les ${fmt(quantiteInconnue)} autres, ` +
      'la BRVM ne publie que la meilleure limite : la profondeur au-delà n’est pas connue, et rien n’est présenté comme exécuté.';
  } else {
    statut = 'partiel';
    explication =
      `Servi en partie : ${fmt(servie)} titres sur ${fmt(ordre.quantite)}, à ${fmt(prixMoyen!)} FCFA en moyenne. ` +
      `Les ${fmt(reste)} titres restants restent au carnet (${sort}).`;
  }

  return { statut, lignes, quantiteServie: servie, prixMoyen, coutTotal: cout, reliquat, quantiteInconnue, niveauxSansPrix, explication };
}

/** Carnet réel sans niveau exploitable à la limite choisie : on ne conclut pas. */
function sansVisibilite(niveauxSansPrix: number, quantite: number): ResultatOrdre {
  return {
    statut: 'indetermine',
    lignes: [],
    quantiteServie: 0,
    prixMoyen: null,
    coutTotal: 0,
    reliquat: 0,
    quantiteInconnue: quantite,
    niveauxSansPrix,
    explication:
      niveauxSansPrix > 0
        ? 'Le côté vente est publié « au marché », sans cours : on ne peut pas établir à quel prix votre ordre serait servi.'
        : 'Aucun titre n’est visible à votre limite. La BRVM ne publie que la meilleure limite : on ne peut pas dire si votre ordre serait servi.',
  };
}

// ── Vente (simulateur d'ordres de la leçon 7, 2026-11-27) ─────────────────────

export interface OrdreVente {
  sens: 'vente';
  quantite: number;
  limite: LimiteOrdre;
  condition: ConditionOrdre;
  validite: ValiditeOrdre;
}

/**
 * Exécute un ordre de VENTE contre le côté ACHAT d'un carnet FICTIF, niveaux
 * parcourus du prix le plus haut au plus bas. Mêmes règles que l'achat (art. 44
 * à 46) : la limite est ici un prix MINIMAL ; un niveau inférieur n'est jamais
 * touché. Carnet entièrement connu (pas de profondeur inconnue).
 */
export function executerOrdreVente(carnetAchat: NiveauCarnet[], ordre: OrdreVente): ResultatOrdre {
  if (!Number.isInteger(ordre.quantite) || ordre.quantite <= 0) {
    return rejet('la quantité doit être un nombre entier de titres, supérieur à zéro.');
  }
  if (ordre.limite == null) {
    return rejet('aucune limite de prix indiquée. Le règlement exige « au mieux » ou un cours limité.');
  }
  const plancher = ordre.limite === 'au_mieux' ? 0 : ordre.limite.prix;
  if (ordre.limite !== 'au_mieux' && !(plancher > 0)) return rejet('le cours limité doit être supérieur à zéro.');

  const niveaux = carnetAchat
    .filter((n): n is { prix: number; quantite: number } => n.prix != null && n.prix > 0 && n.quantite > 0)
    .sort((a, b) => b.prix - a.prix);
  const accessibles = niveaux.filter((n) => n.prix >= plancher);
  const disponible = accessibles.reduce((s, n) => s + n.quantite, 0);
  const sort = VALIDITES[ordre.validite].sort;
  const vide = { lignes: [], quantiteServie: 0, prixMoyen: null, coutTotal: 0, quantiteInconnue: 0, niveauxSansPrix: 0 };

  if (ordre.condition === 'tout_ou_rien' && disponible < ordre.quantite) {
    return {
      ...vide,
      statut: 'non_execute',
      reliquat: ordre.quantite,
      explication:
        `Non exécuté : « tout ou rien » exige ${fmt(ordre.quantite)} titres ; ` +
        `seulement ${fmt(disponible)} sont demandés à votre limite ou au-dessus. Il ne peut pas être servi partiellement.`,
    };
  }

  const lignes: LigneExecution[] = [];
  let reste = ordre.quantite;
  for (const n of accessibles) {
    if (reste <= 0) break;
    const q = Math.min(reste, n.quantite);
    lignes.push({ prix: n.prix, quantite: q, montant: n.prix * q });
    reste -= q;
  }
  const servie = ordre.quantite - reste;
  const produit = lignes.reduce((s, l) => s + l.montant, 0);
  const prixMoyen = servie > 0 ? arrondi2(produit / servie) : null;

  if (servie === 0) {
    return {
      ...vide,
      statut: 'non_execute',
      reliquat: ordre.quantite,
      explication:
        ordre.limite === 'au_mieux'
          ? 'Le carnet ne contient aucun acheteur : rien n’est exécuté.'
          : `Non exécuté : aucun acheteur à ${fmt(plancher)} FCFA ou plus. L’ordre attend (${sort}).`,
    };
  }
  let statut: StatutOrdre;
  let explication: string;
  if (reste === 0) {
    statut = 'execute';
    explication =
      `Servi en totalité : ${fmt(servie)} titres vendus à ${fmt(prixMoyen!)} FCFA en moyenne, soit ${fmt(produit)} FCFA` +
      (lignes.length > 1 ? `, répartis sur ${lignes.length} niveaux de prix.` : '.');
    if (ordre.limite === 'au_mieux' && lignes.length > 1) {
      explication += ` Ce prix moyen est inférieur au meilleur prix affiché (${fmt(lignes[0]!.prix)} FCFA).`;
    }
  } else {
    statut = 'partiel';
    explication =
      `Servi en partie : ${fmt(servie)} titres sur ${fmt(ordre.quantite)}, à ${fmt(prixMoyen!)} FCFA en moyenne. ` +
      `Les ${fmt(reste)} titres restants restent au carnet (${sort}).`;
  }
  return { statut, lignes, quantiteServie: servie, prixMoyen, coutTotal: produit, reliquat: reste, quantiteInconnue: 0, niveauxSansPrix: 0, explication };
}

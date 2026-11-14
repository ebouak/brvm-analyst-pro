import { fmtFcfa, fmtDateFR } from '@/lib/format';
import { dividendeCourant, horsExploitation } from '@/lib/fiche/affichage';
import { lireCodePeriode, MOIS } from '@/lib/financials/interim';
import type { DossierValeur } from './build';

/**
 * Appréciations dérivées — PUR, déterministe, sans modèle de langage.
 *
 * POURQUOI PAS L'IA ICI. Le projet a déjà tranché ce point pour l'analyse
 * hebdomadaire : un squelette déterministe d'abord, un polissage LLM ensuite,
 * borné par une liste blanche de chiffres (`scraper/src/hebdo/polish.ts`). La
 * raison tient en une phrase : un rapport envoyé à un porteur de titres ne
 * peut pas dépendre de l'humeur d'un modèle.
 *
 * Chaque appréciation ci-dessous PORTE SON CHIFFRE. Une force sans mesure
 * n'est pas une force, c'est une opinion — et une opinion n'a pas sa place
 * dans un document qui se veut vérifiable ligne à ligne.
 *
 * Les seuils sont explicites et commentés. Ils sont discutables ; c'est
 * précisément pourquoi ils sont ici, en un seul endroit, plutôt que dilués
 * dans un gabarit.
 */

export interface Appreciation {
  /** Texte prêt à afficher, chiffre inclus. */
  texte: string;
  /**
   * Le même fait, SANS AUCUN CHIFFRE, pour la prose (lib/dossier/prose.ts).
   * Les chiffres restent aux panneaux ; la prose ne fait que les nommer.
   */
  fait: string;
  /** Valeur qui fonde l'appréciation, pour vérification. */
  mesure: number | null;
}

export interface Narratif {
  forces: Appreciation[];
  risques: Appreciation[];
  /** Vrai si l'un des deux blocs est vide — le rapport doit le dire. */
  incomplet: boolean;
}

const pct = (x: number, d = 1) =>
  `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

/* `fmtFcfa` adapte l'ordre de grandeur (k / M / Md / T) : un résultat de
   80 millions ne doit pas s'afficher « 0,08 Md ». */
const mtt = (x: number) => `${fmtFcfa(x)} FCFA`;
/* Un NIVEAU (rentabilité) ou une variation déjà qualifiée par « hausse » ne
   prend pas de signe, et garde la décimale des panneaux : « +30 % » ici contre
   29,6 % partout ailleurs faisait lire deux chiffres pour une même mesure. */
const niveau = (x: number) => `${Math.abs(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

const nb = (x: number, d = 1) =>
  x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ── Seuils ────────────────────────────────────────────────────────────────
   Choisis pour un marché étroit où la liquidité domine tout le reste. Ils
   valent pour la BRVM, pas pour une place profonde. */
const SEUILS = {
  /** Au-delà, le bénéfice ne vient majoritairement pas de l'exploitation. */
  NON_OPERATIONNEL: 0.5,
  /** Endettement rapporté aux capitaux propres : en dessous, structure saine. */
  GEARING_SAIN: 0.25,
  /** Rentabilité des capitaux propres jugée élevée. */
  ROE_ELEVE: 0.15,
  /** Multiple des capitaux propres au-delà duquel la prime est notable. */
  PB_PRIME: 3,
  /** Recul de chiffre d'affaires jugé préoccupant sur un exercice. */
  CA_RECUL: -0.1,
  /** Sous ce nombre de titres échangés, l'exécution devient un vrai sujet. */
  VOLUME_FAIBLE: 5000,
  /**
   * Hausse du cours depuis le 1er janvier qui dépasse de plus de dix points celle
   * du résultat net du dernier exercice : en dessous, l'écart est du bruit.
   */
  ECART_COURS_BENEFICE: 0.1,
  /** Position dans la plage 52 semaines à partir de laquelle le cours est dans le quart haut. */
  QUART_HAUT: 0.75,
  /** Part du capital au flottant sous laquelle peu de titres sont réellement échangeables. */
  FLOTTANT_FAIBLE: 0.25,
  /** Ancienneté (en mois) des derniers comptes au-delà de laquelle ils sont jugés anciens. */
  COMPTES_ANCIENS_MOIS: 18,
} as const;

/**
 * Ancienneté, en mois pleins, des DERNIERS COMPTES publiés : la fin de la période
 * intermédiaire la plus récente si elle existe, sinon la clôture de l'exercice
 * annuel (31 décembre, convention du plan comptable de la zone). null si aucune
 * période n'est exploitable. Pure et testée.
 */
export function ancienneteComptesMois(exercice: string | null, periodeIntermediaire: string | null, aujourdhui: string): number | null {
  let fin: string | null = null;
  const inter = periodeIntermediaire ? lireCodePeriode(periodeIntermediaire) : null;
  if (inter) {
    const mois = MOIS[inter.code];
    const dernierJour = new Date(Date.UTC(inter.annee, mois, 0)).getUTCDate();
    fin = `${inter.annee}-${String(mois).padStart(2, '0')}-${String(dernierJour).padStart(2, '0')}`;
  } else if (exercice && /^\d{4}$/.test(exercice)) {
    fin = `${exercice}-12-31`;
  }
  if (!fin) return null;
  const [a1, m1, j1] = fin.split('-').map(Number) as [number, number, number];
  const [a2, m2, j2] = aujourdhui.split('-').map(Number) as [number, number, number];
  let mois = (a2 - a1) * 12 + (m2 - m1);
  if (j2 < j1) mois -= 1;
  return mois < 0 ? null : mois;
}

export function construireNarratif(d: DossierValeur): Narratif {
  const forces: Appreciation[] = [];
  const risques: Appreciation[] = [];
  const r = d.ratios;
  const c = d.chiffres_cles;
  const q = d.qualite_resultat;

  // ── Rentabilité ─────────────────────────────────────────────────────────
  if (c.resultat_net != null && c.resultat_net > 0) {
    forces.push({ texte: `Exercice bénéficiaire : ${mtt(c.resultat_net)}`, fait: 'un exercice bénéficiaire', mesure: c.resultat_net });
  } else if (c.resultat_net != null && c.resultat_net < 0) {
    risques.push({ texte: `Exercice déficitaire : ${mtt(c.resultat_net)}`, fait: 'un exercice déficitaire', mesure: c.resultat_net });
  }

  if (r?.roe != null && r.roe > SEUILS.ROE_ELEVE) {
    forces.push({ texte: `Rentabilité des capitaux propres élevée : ${niveau(r.roe)}`, fait: 'une rentabilité des capitaux propres élevée', mesure: r.roe });
  }

  /* La qualité du bénéfice prime sur son montant. Un profit massivement non
     opérationnel ne se reproduit pas, et le taire serait trompeur. */
  const horsExpl = q ? horsExploitation(q.resultat_avant_impots, q.resultat_exploitation) : null;
  if (q?.part_non_operationnelle != null && q.part_non_operationnelle > SEUILS.NON_OPERATIONNEL && horsExpl != null) {
    /* En montant, pas en pourcentage : quand le résultat avant impôts frôle zéro
       le rapport s'envole (17 883 % sur STAC) et ne veut plus rien dire. */
    risques.push({
      texte:
        `${mtt(horsExpl)} de produits hors exploitation, pour un résultat d'exploitation de ` +
        `${mtt(q.resultat_exploitation ?? 0)} : la récurrence du bénéfice reste à confirmer`,
      fait: "un bénéfice majoritairement non opérationnel, dont la récurrence reste à confirmer",
      mesure: q.part_non_operationnelle,
    });
  } else if (
    q?.part_non_operationnelle != null &&
    Math.abs(q.part_non_operationnelle) < 0.2
  ) {
    /* Valeur absolue : une part NÉGATIVE signifie que les charges financières
       amputent un résultat d'exploitation supérieur. Proche de zéro dans un
       sens comme dans l'autre, le bénéfice reste d'origine opérationnelle. */
    forces.push({
      texte: `Bénéfice d'origine opérationnelle (part non opérationnelle : ${pct(q.part_non_operationnelle, 0)})`,
      fait: "un bénéfice d'origine opérationnelle",
      mesure: q.part_non_operationnelle,
    });
  }

  // ── Activité ────────────────────────────────────────────────────────────
  if (c.croissance_ca_1an != null) {
    if (c.croissance_ca_1an < SEUILS.CA_RECUL) {
      const deux = c.croissance_ca_2ans != null ? `, ${pct(c.croissance_ca_2ans, 1)} sur deux exercices` : '';
      risques.push({
        texte: `Chiffre d'affaires en recul : ${pct(c.croissance_ca_1an, 1)} sur un exercice${deux}`,
        fait: "un chiffre d'affaires en recul",
        mesure: c.croissance_ca_1an,
      });
    } else if (c.croissance_ca_1an > 0.05) {
      forces.push({
        texte: `Chiffre d'affaires en progression : ${pct(c.croissance_ca_1an, 1)}`,
        fait: "un chiffre d'affaires en progression",
        mesure: c.croissance_ca_1an,
      });
    }
  }

  // ── Structure financière ────────────────────────────────────────────────
  // « Faible » seulement sur une dette au périmètre établi (bilan, court + long
  // terme) : SNTS affichait 17,7 % sur sa seule dette à long terme, 28,8 % réels.
  if (r?.gearing != null && r.gearing < SEUILS.GEARING_SAIN && d.chiffres_cles.dette_perimetre === 'totale') {
    forces.push({ texte: `Endettement faible : ${nb(r.gearing * 100, 0)} % des capitaux propres`, fait: 'un endettement faible', mesure: r.gearing });
  } else if (r?.gearing != null && r.gearing > 1) {
    risques.push({ texte: `Endettement supérieur aux capitaux propres : ${nb(r.gearing * 100, 0)} %`, fait: 'un endettement supérieur aux capitaux propres', mesure: r.gearing });
  }

  if (c.variation_capitaux_propres_1an != null && c.variation_capitaux_propres_1an > 0.1) {
    forces.push({
      texte: `Capitaux propres en hausse de ${niveau(c.variation_capitaux_propres_1an)}`,
      fait: 'des capitaux propres en hausse',
      mesure: c.variation_capitaux_propres_1an,
    });
  }

  // ── Valorisation ────────────────────────────────────────────────────────
  if (r?.pb != null && r.pb > SEUILS.PB_PRIME) {
    risques.push({
      texte: `Le marché paie ${nb(r.pb, 1)} fois les capitaux propres : la valeur n'est pas décotée`,
      fait: 'une valorisation sans décote sur les capitaux propres',
      mesure: r.pb,
    });
  }

  // ── Dividende ───────────────────────────────────────────────────────────
  /* Un dividende dont l'exercice précède de plus d'un an le dernier publié ne
     dit rien de la politique actuelle : ce n'est pas un point d'appui. */
  const divAncien = dividendeCourant(
    [{ montant: d.dividende.montant ?? 0, exercice: d.dividende.exercice, ex_date: d.dividende.ex_date, payment_date: d.dividende.payment_date }],
    c.exercice != null ? Number(c.exercice) : null,
  )?.ancien ?? false;
  if (d.dividende.montant != null && d.dividende.montant > 0 && d.dividende.rendement != null && !divAncien) {
    const base =
      d.dividende.base_fiscale === 'net' ? ' net'
      : d.dividende.base_fiscale === 'brut' ? ' brut'
      : ' (base non précisée par la source)';
    forces.push({
      texte: `Dividende de ${nb(d.dividende.montant, 2)} FCFA${base}, soit ${nb(d.dividende.rendement * 100, 2)} % du cours`,
      fait:
        d.dividende.base_fiscale === 'net' ? 'un dividende net versé'
        : d.dividende.base_fiscale === 'brut' ? 'un dividende brut versé'
        : 'un dividende versé, de base fiscale non précisée',
      mesure: d.dividende.rendement,
    });
  }

  /* L'irrégularité pèse autant que le montant : un rendement ponctuel ne se
     projette pas. */
  if (d.dividende.exercices_sans_dividende > 0) {
    risques.push({
      texte: `Distribution irrégulière : ${d.dividende.exercices_sans_dividende} exercice${d.dividende.exercices_sans_dividende > 1 ? 's' : ''} sans dividende sur la période couverte`,
      fait: 'une distribution irrégulière',
      mesure: d.dividende.exercices_sans_dividende,
    });
  }

  // ── Notation ────────────────────────────────────────────────────────────
  // Une note dépassée par un communiqué plus récent n'est pas un point d'appui.
  if (d.identite.notation?.note && !d.identite.notation.communique_plus_recent) {
    const n = d.identite.notation;
    const stab = n.annees_stables && n.annees_stables > 1 ? `, stable depuis ${n.annees_stables} exercices` : '';
    forces.push({
      texte: `Notation ${n.note} (${n.agence ?? 'agence non précisée'})${stab} — qualité de crédit, non valorisation`,
      fait: 'une notation de crédit publiée',
      mesure: null,
    });
  }

  // ── Liquidité et marché ─────────────────────────────────────────────────
  const dernierVolume = d.technique.serie[d.technique.serie.length - 1]?.volume ?? null;
  if (dernierVolume != null && dernierVolume < SEUILS.VOLUME_FAIBLE) {
    risques.push({
      texte: `Liquidité faible : ${dernierVolume.toLocaleString('fr-FR')} titres échangés — l'exécution peut déplacer le cours`,
      fait: 'une liquidité faible',
      mesure: dernierVolume,
    });
  }

  /* Une chute mal expliquée par le détachement est un fait de marché, pas un
     ajustement mécanique. Le distinguer évite de rassurer à tort. Quand la date
     elle-même n'est pas confirmée, c'est la constatation plus bas qui parle :
     deux lignes pour un même fait se contrediraient. */
  const dateNonConfirmee = d.suivi?.ex_date_controle === 'a_verifier';
  if (d.detachement?.part_expliquee != null && d.detachement.part_expliquee < 0.9 && !dateNonConfirmee) {
    risques.push({
      texte:
        `Le détachement du ${fmtDateFR(d.detachement.ex_date)} n'explique que ` +
        `${nb(d.detachement.part_expliquee * 100, 0)} % de la baisse observée ` +
        `(${nb(d.detachement.baisse_fcfa, 0)} FCFA pour un dividende de ${nb(d.detachement.dividende, 2)})`,
      fait: 'une baisse au détachement que le dividende seul n’explique pas',
      mesure: d.detachement.part_expliquee,
    });
  }

  // ── Constats de marché et de fraîcheur (chacun porte son chiffre) ───────
  /* Un titre qui a davantage monté que le bénéfice publié : les deux mesures ne
     portent pas sur la même période (cours depuis le 1er janvier, résultat net du
     dernier exercice), et le texte le dit — on rapproche deux ordres de grandeur,
     on n'en tire aucune cause. */
  const ytd = d.suivi?.performance?.var_ytd ?? null;
  const traj = d.trajectoire ?? [];
  const dernierRn = traj.length >= 2 ? traj[traj.length - 1]!.resultat_net : null;
  const precedentRn = traj.length >= 2 ? traj[traj.length - 2]!.resultat_net : null;
  if (ytd != null && dernierRn != null && precedentRn != null && precedentRn > 0 && dernierRn > 0) {
    const croissanceRn = dernierRn / precedentRn - 1;
    if (ytd > 0 && ytd - croissanceRn >= SEUILS.ECART_COURS_BENEFICE) {
      risques.push({
        texte:
          `Le cours a progressé de ${pct(ytd, 1)} depuis le 1er janvier, contre ${pct(croissanceRn, 1)} pour le résultat net ` +
          `de l'exercice ${traj[traj.length - 1]!.exercice} : le titre a davantage monté que le bénéfice publié (périodes différentes)`,
        fait: 'une hausse du cours supérieure à celle du bénéfice publié',
        mesure: ytd - croissanceRn,
      });
    }
  }

  const position52 = d.suivi?.performance?.position_52s ?? null;
  if (position52 != null && position52 >= SEUILS.QUART_HAUT) {
    const { bas52, haut52 } = d.suivi.performance;
    risques.push({
      texte:
        `Le cours se situe à ${nb(position52 * 100, 0)} % de sa plage sur 52 semaines` +
        (bas52 != null && haut52 != null ? ` (de ${nb(bas52, 0)} à ${nb(haut52, 0)} FCFA)` : ''),
      fait: 'un cours dans le quart haut de sa plage annuelle',
      mesure: position52,
    });
  }

  const { flottant, actions } = d.identite;
  if (flottant != null && actions != null && actions > 0 && flottant / actions < SEUILS.FLOTTANT_FAIBLE) {
    risques.push({
      texte: `Flottant de ${nb((flottant / actions) * 100, 1)} % du capital : peu de titres sont réellement échangeables`,
      fait: 'un flottant inférieur au quart du capital',
      mesure: flottant / actions,
    });
  }

  if (dateNonConfirmee && d.detachement) {
    risques.push({
      texte:
        `La date de détachement enregistrée (${fmtDateFR(d.detachement.ex_date_officielle)}) n'est pas confirmée : ` +
        `le cours a baissé de ${nb(d.detachement.baisse_fcfa, 0)} FCFA pour un dividende de ${nb(d.detachement.dividende, 2)} FCFA`,
      fait: 'une date de détachement que le cours ne confirme pas',
      mesure: d.detachement.baisse_fcfa,
    });
  }

  const anciennete = ancienneteComptesMois(c.exercice, d.suivi?.intermediaire?.periode ?? null, d.genere_le);
  if (anciennete != null && anciennete > SEUILS.COMPTES_ANCIENS_MOIS) {
    risques.push({
      texte: `Les derniers comptes publiés datent de ${anciennete} mois${c.exercice ? ` (exercice ${c.exercice})` : ''}`,
      fait: 'des derniers comptes publiés anciens',
      mesure: anciennete,
    });
  }

  return {
    forces,
    risques,
    incomplet: forces.length === 0 || risques.length === 0,
  };
}

/**
 * Les appréciations AVEC leur chiffre, pour la lecture d'ensemble. La prose du
 * dossier ne porte aucun nombre par construction (voir prose.ts : un chiffre
 * poli le samedi serait contredit lundi) ; la lecture d'ensemble le cite donc
 * dessous, lu à l'instant à partir des mêmes appréciations que les panneaux de
 * points d'appui et de vigilance. Un seul calcul, deux emplacements : ils ne
 * peuvent pas diverger.
 */
export function chiffresDeLecture(n: Narratif, max = 3): { forces: string[]; risques: string[] } {
  return { forces: n.forces.slice(0, max).map((a) => a.texte), risques: n.risques.slice(0, max).map((a) => a.texte) };
}

import { fmtFcfa, fmtDateFR } from '@/lib/format';
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
} as const;

export function construireNarratif(d: DossierValeur): Narratif {
  const forces: Appreciation[] = [];
  const risques: Appreciation[] = [];
  const r = d.ratios;
  const c = d.chiffres_cles;
  const q = d.qualite_resultat;

  // ── Rentabilité ─────────────────────────────────────────────────────────
  if (c.resultat_net != null && c.resultat_net > 0) {
    forces.push({ texte: `Exercice bénéficiaire : ${mtt(c.resultat_net)}`, mesure: c.resultat_net });
  } else if (c.resultat_net != null && c.resultat_net < 0) {
    risques.push({ texte: `Exercice déficitaire : ${mtt(c.resultat_net)}`, mesure: c.resultat_net });
  }

  if (r?.roe != null && r.roe > SEUILS.ROE_ELEVE) {
    forces.push({ texte: `Rentabilité des capitaux propres élevée : ${pct(r.roe, 0)}`, mesure: r.roe });
  }

  /* La qualité du bénéfice prime sur son montant. Un profit massivement non
     opérationnel ne se reproduit pas, et le taire serait trompeur. */
  if (q?.part_non_operationnelle != null && q.part_non_operationnelle > SEUILS.NON_OPERATIONNEL) {
    risques.push({
      texte:
        `${pct(q.part_non_operationnelle, 0).replace('+', '')} du résultat avant impôts ne vient pas de ` +
        `l'exploitation : la récurrence du bénéfice reste à confirmer`,
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
      mesure: q.part_non_operationnelle,
    });
  }

  // ── Activité ────────────────────────────────────────────────────────────
  if (c.croissance_ca_1an != null) {
    if (c.croissance_ca_1an < SEUILS.CA_RECUL) {
      const deux = c.croissance_ca_2ans != null ? `, ${pct(c.croissance_ca_2ans, 1)} sur deux exercices` : '';
      risques.push({
        texte: `Chiffre d'affaires en recul : ${pct(c.croissance_ca_1an, 1)} sur un exercice${deux}`,
        mesure: c.croissance_ca_1an,
      });
    } else if (c.croissance_ca_1an > 0.05) {
      forces.push({
        texte: `Chiffre d'affaires en progression : ${pct(c.croissance_ca_1an, 1)}`,
        mesure: c.croissance_ca_1an,
      });
    }
  }

  // ── Structure financière ────────────────────────────────────────────────
  if (r?.gearing != null && r.gearing < SEUILS.GEARING_SAIN) {
    forces.push({ texte: `Endettement faible : ${nb(r.gearing * 100, 0)} % des capitaux propres`, mesure: r.gearing });
  } else if (r?.gearing != null && r.gearing > 1) {
    risques.push({ texte: `Endettement supérieur aux capitaux propres : ${nb(r.gearing * 100, 0)} %`, mesure: r.gearing });
  }

  if (c.variation_capitaux_propres_1an != null && c.variation_capitaux_propres_1an > 0.1) {
    forces.push({
      texte: `Capitaux propres en hausse de ${pct(c.variation_capitaux_propres_1an, 0)}`,
      mesure: c.variation_capitaux_propres_1an,
    });
  }

  // ── Valorisation ────────────────────────────────────────────────────────
  if (r?.pb != null && r.pb > SEUILS.PB_PRIME) {
    risques.push({
      texte: `Le marché paie ${nb(r.pb, 1)} fois les capitaux propres : la valeur n'est pas décotée`,
      mesure: r.pb,
    });
  }

  // ── Dividende ───────────────────────────────────────────────────────────
  if (d.dividende.montant != null && d.dividende.montant > 0 && d.dividende.rendement != null) {
    const base =
      d.dividende.base_fiscale === 'net' ? ' net'
      : d.dividende.base_fiscale === 'brut' ? ' brut'
      : ' (base non précisée par la source)';
    forces.push({
      texte: `Dividende de ${nb(d.dividende.montant, 2)} FCFA${base}, soit ${nb(d.dividende.rendement * 100, 2)} % du cours`,
      mesure: d.dividende.rendement,
    });
  }

  /* L'irrégularité pèse autant que le montant : un rendement ponctuel ne se
     projette pas. */
  if (d.dividende.exercices_sans_dividende > 0) {
    risques.push({
      texte: `Distribution irrégulière : ${d.dividende.exercices_sans_dividende} exercice${d.dividende.exercices_sans_dividende > 1 ? 's' : ''} sans dividende sur la période couverte`,
      mesure: d.dividende.exercices_sans_dividende,
    });
  }

  // ── Notation ────────────────────────────────────────────────────────────
  if (d.identite.notation?.note) {
    const n = d.identite.notation;
    const stab = n.annees_stables && n.annees_stables > 1 ? `, stable depuis ${n.annees_stables} exercices` : '';
    forces.push({
      texte: `Notation ${n.note} (${n.agence ?? 'agence non précisée'})${stab} — qualité de crédit, non valorisation`,
      mesure: null,
    });
  }

  // ── Liquidité et marché ─────────────────────────────────────────────────
  const dernierVolume = d.technique.serie[d.technique.serie.length - 1]?.volume ?? null;
  if (dernierVolume != null && dernierVolume < SEUILS.VOLUME_FAIBLE) {
    risques.push({
      texte: `Liquidité faible : ${dernierVolume.toLocaleString('fr-FR')} titres échangés — l'exécution peut déplacer le cours`,
      mesure: dernierVolume,
    });
  }

  /* Une chute mal expliquée par le détachement est un fait de marché, pas un
     ajustement mécanique. Le distinguer évite de rassurer à tort. */
  if (d.detachement?.part_expliquee != null && d.detachement.part_expliquee < 0.9) {
    risques.push({
      texte:
        `Le détachement du ${fmtDateFR(d.detachement.ex_date)} n'explique que ` +
        `${nb(d.detachement.part_expliquee * 100, 0)} % de la baisse observée ` +
        `(${nb(d.detachement.baisse_fcfa, 0)} FCFA pour un dividende de ${nb(d.detachement.dividende, 2)})`,
      mesure: d.detachement.part_expliquee,
    });
  }

  return {
    forces,
    risques,
    incomplet: forces.length === 0 || risques.length === 0,
  };
}

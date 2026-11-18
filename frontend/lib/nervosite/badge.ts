/**
 * Pastille de l'indice de nervosité : régime + date de séance + fraîcheur. PUR.
 *
 * La question posée : la valeur affichée est-elle celle de la dernière séance
 * qu'on aurait dû calculer ? On compare la date de la dernière ligne de
 * `brvm_nervosite_daily` aux séances présentes dans `brvm_actions_daily`.
 *
 * Une séance n'est « due » qu'une fois sa mise à jour possible : la ligne du
 * jour apparaît dans `brvm_actions_daily` dès 09:00 UTC (collecte intraday),
 * alors que l'indice ne se calcule qu'après la clôture (nervosite.yml, 16:30
 * UTC). Sans ce délai, la pastille dirait « en retard » toute la journée.
 *
 * Règles d'honnêteté :
 *  - jamais « à jour » par défaut : une séance inconnue (lecture en échec)
 *    rend l'état `indisponible`, pas `a_jour` ;
 *  - un régime NULL (historique trop court) rend `indisponible` : on ne montre
 *    pas une valeur sans pouvoir la situer ;
 *  - aucun verdict : un régime décrit l'ampleur des variations passées, ce
 *    n'est pas un signal d'achat ou de vente.
 */
import type { Regime } from './nervosite';
import { LIBELLE_REGIME, fmtNervosite } from './affichage';

/**
 * Heure UTC à partir de laquelle la séance du jour est due. Clôture 15:00,
 * calcul planifié 16:30 ; la marge couvre les retards ordinaires du
 * planificateur GitHub (constatés jusqu'à plusieurs heures). Au-delà, le
 * passage de rattrapage du lendemain 07:30 prend le relais, et la pastille dit
 * « en retard » en attendant : c'est exact.
 */
export const HEURE_LIMITE_UTC = 20;

export type EtatBadge = 'a_jour' | 'en_retard' | 'indisponible';

export interface EntreeBadge {
  /** Dernière ligne publiée, `null` si aucune ou lecture en échec. */
  derniere: { date_marche: string; valeur: number | null; regime: Regime | null } | null;
  /**
   * Dates de séance connues (YYYY-MM-DD, ordre et doublons indifférents) à
   * partir de la date de la dernière ligne publiée, celle-ci comprise. `null`
   * = lecture en échec ; liste vide = rien pour recouper : dans les deux cas
   * la fraîcheur n'est pas vérifiable.
   */
  seances: readonly string[] | null;
  maintenant: Date;
}

export interface BadgeNervosite {
  etat: EtatBadge;
  regime: Regime | null;
  valeur: number | null;
  /** Séance de la valeur affichée (YYYY-MM-DD), `null` si aucune. */
  date: string | null;
  /** Séances dues non encore calculées (0 si à jour, `null` si non mesurable). */
  retard: number | null;
  /** Texte visible, ex. « Nervosité · Tendu · 12,9 % · 17/11 ». */
  libelle: string;
  /** Phrase complète pour `title` / `aria-label`. */
  description: string;
}

const jourMois = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Une séance est due si elle est passée, ou si c'est aujourd'hui après l'heure limite. */
export function seanceDue(date: string, maintenant: Date): boolean {
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  if (date < aujourdhui) return true;
  if (date > aujourdhui) return false;
  return maintenant.getUTCHours() >= HEURE_LIMITE_UTC;
}

export function calculerBadge({ derniere, seances, maintenant }: EntreeBadge): BadgeNervosite {
  const indispo = (description: string, l?: EntreeBadge['derniere']): BadgeNervosite => ({
    etat: 'indisponible',
    regime: null,
    valeur: l?.valeur ?? null,
    date: l?.date_marche ?? null,
    retard: null,
    libelle: 'Nervosité · indisponible',
    description,
  });

  if (!derniere) return indispo('Indice de nervosité indisponible : aucune valeur publiée ne peut être lue.');
  if (derniere.valeur === null || derniere.regime === null) {
    return indispo('Indice de nervosité indisponible : historique encore trop court pour classer la séance.', derniere);
  }
  if (seances === null || seances.length === 0) {
    return indispo('Indice de nervosité : la date de la dernière séance n’a pas pu être lue, la fraîcheur n’est pas vérifiable.', derniere);
  }

  const date = derniere.date_marche;
  const dues = new Set(seances.filter((s) => s > date && seanceDue(s, maintenant)));
  const retard = dues.size;
  const regime = derniere.regime;
  const base = `Nervosité · ${LIBELLE_REGIME[regime]} · ${fmtNervosite(derniere.valeur)} · ${jourMois(date)}`;
  const phrase = `Indice de nervosité WESTBOURSE : régime ${LIBELLE_REGIME[regime].toLowerCase()}, ${fmtNervosite(derniere.valeur)} annualisé, séance du ${jourMois(date)}`;

  if (retard === 0) {
    return { etat: 'a_jour', regime, valeur: derniere.valeur, date, retard, libelle: base, description: `${phrase}. À jour.` };
  }
  const n = `${retard} séance${retard > 1 ? 's' : ''}`;
  return {
    etat: 'en_retard',
    regime,
    valeur: derniere.valeur,
    date,
    retard,
    libelle: `${base} · en retard`,
    description: `${phrase}. En retard : ${n} non encore calculée${retard > 1 ? 's' : ''}.`,
  };
}

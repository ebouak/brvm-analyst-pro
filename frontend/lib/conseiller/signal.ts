/**
 * Signal « tendance longue » du Conseiller Premium (table conseiller_signaux,
 * écrite par le scraper). Le frontend AFFICHE un état lu en base ; il ne le
 * recalcule jamais. Protocole : docs/conseiller/PREREG-signal-tendance-longue.md.
 */
export type EtatSignal = 'a_eviter' | 'favorable' | 'neutre' | 'pas_de_signal';

export interface Signal {
  code: string;
  /** Séance de la révision mensuelle dont l'état est affiché. */
  date_marche: string;
  etat: EtatSignal;
}

const ETATS: EtatSignal[] = ['a_eviter', 'favorable', 'neutre', 'pas_de_signal'];

export function signalValide(l: { code?: unknown; date_marche?: unknown; etat?: unknown }): l is Signal {
  return typeof l.code === 'string' && l.code.length > 0 && typeof l.date_marche === 'string' && ETATS.includes(l.etat as EtatSignal);
}

export const LIBELLE_ETAT: Record<EtatSignal, string> = {
  a_eviter: 'À éviter',
  favorable: 'Favorable',
  neutre: 'Neutre',
  pas_de_signal: 'Pas de signal',
};

/**
 * Chiffres de la relecture historique par la chaîne du dépôt
 * (`npm run conseiller:signal-historique`, 4 470 séances du 2 janvier 2008 au
 * 10 novembre 2026, PREREG §7). EXPLORATOIRES : à ne modifier qu'en relançant
 * cette commande, jamais à la main.
 */
export const HISTORIQUE = {
  depuis: 2008,
  aEviterEcartAnnuelPct: -8.0,
  aEviterPartSeancesNegativesPct: 63,
  favorableEcartAnnuelPct: 5.3,
  confirmationApres: '2026-11-10',
} as const;

const nombre = (x: number) => Math.abs(x).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Ce que l'état veut dire et ce qui le fonde. Aucun verbe d'ordre. */
export function preuveDe(etat: EtatSignal): string {
  switch (etat) {
    case 'a_eviter':
      return `Tendance longue dans le tiers le plus faible de la cote. Depuis ${HISTORIQUE.depuis}, les valeurs dans cet état ont fait en moyenne ${nombre(HISTORIQUE.aEviterEcartAnnuelPct)} % par an de moins que la cote sur les trois mois suivants, et moins bien qu'elle ${HISTORIQUE.aEviterPartSeancesNegativesPct} % du temps.`;
    case 'favorable':
      return `Tendance longue dans le tiers le plus fort de la cote. Depuis ${HISTORIQUE.depuis}, les valeurs dans cet état ont fait en moyenne ${nombre(HISTORIQUE.favorableEcartAnnuelPct)} % par an de mieux que la cote, mais cet écart n'est pas établi statistiquement.`;
    case 'neutre':
      return 'Tendance longue dans le tiers médian de la cote.';
    case 'pas_de_signal':
      return 'Valeur trop peu échangée ou cotée depuis trop peu de temps pour être classée.';
  }
}

/** Statut de la preuve, à afficher avec tout état classé. */
export function statutDe(etat: EtatSignal): string | null {
  if (etat === 'a_eviter') return 'Mesure historique exploratoire, confirmation en cours sur les séances postérieures au 10 novembre 2026.';
  if (etat === 'favorable') return 'Non prouvé.';
  return null;
}

const JOUR_MS = 86_400_000;
/** Au-delà, la révision mensuelle a manqué : on n'affiche pas un signal périmé. */
export const AGE_MAX_JOURS = 45;

export function signalPerime(dateSignal: string, dateSeance: string): boolean {
  const age = (Date.parse(`${dateSeance}T00:00:00Z`) - Date.parse(`${dateSignal}T00:00:00Z`)) / JOUR_MS;
  return !Number.isFinite(age) || age > AGE_MAX_JOURS;
}

/** Mois de la prochaine révision, ex. « décembre 2026 ». */
export function moisProchaineRevision(dateSeance: string): string {
  const [a, m] = dateSeance.split('-').map(Number);
  const d = new Date(Date.UTC(a!, m!, 1));
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

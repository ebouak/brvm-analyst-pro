/**
 * Contexte d'actualité — PUR, testé. Ne retient qu'un événement RÉCENT et se
 * contente de le JUXTAPOSER au mouvement de cours : jamais de lien de cause à
 * effet (spec §4). Un événement hors fenêtre est écarté, quitte à n'afficher
 * aucun contexte — mieux vaut le silence qu'un rapprochement trompeur.
 */

export interface MarketEventRow {
  event_date: string;
  title: string;
  event_type?: string | null;
}

export interface RecentEvent {
  phrase: string;
  chiffres: number[];
}

const FENETRE_JOURS = 14;

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-07-18 » → « 18 juillet 2026 ». */
function dateLisible(iso: string): { texte: string; jour: number; annee: number } {
  const [a, m, j] = iso.split('-').map((x) => parseInt(x, 10));
  const jour = j ?? 1;
  const annee = a ?? 0;
  return { texte: `${jour} ${MOIS[(m ?? 1) - 1] ?? ''} ${annee}`, jour, annee };
}

function joursEntre(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(b - a) / 86_400_000;
}

export function pickRecentEvent(
  events: MarketEventRow[],
  dateEdition: string,
  fenetreJours = FENETRE_JOURS,
): RecentEvent | null {
  const eligibles = events
    .filter((e) => e.event_date && e.title)
    .filter((e) => joursEntre(e.event_date, dateEdition) <= fenetreJours)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
  const e = eligibles[0];
  if (!e) return null;
  const d = dateLisible(e.event_date);
  return {
    // Gabarit FIGÉ et purement factuel : on énonce, on n'explique pas.
    phrase: `À noter : ${e.title}, publié le ${d.texte}.`,
    chiffres: [d.jour, d.annee],
  };
}

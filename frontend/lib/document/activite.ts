/**
 * Photo d'ACTIVITÉ des documents : elle illustre le métier (antenne, palmeraie,
 * port…), jamais la société elle-même. Photos Pexels (licence libre d'usage
 * commercial), crédit du photographe affiché sous l'image. Choisies sans marque
 * lisible pour ne laisser croire à aucun lien avec une enseigne.
 * Sélection : scripts/images-activites.mjs. PUR.
 */
import photos from './photosActivite.json';

export type Activite =
  | 'telecoms' | 'banque' | 'plantations' | 'agroalimentaire' | 'energie'
  | 'electricite' | 'industrie' | 'logistique' | 'distribution';

/** Métier propre à une valeur quand le secteur ne suffit pas (agro-industrie contre agroalimentaire…). */
const PAR_CODE: Record<string, Activite> = {
  PALC: 'plantations', SCRC: 'plantations', SICC: 'plantations', SOGC: 'plantations', SPHC: 'plantations',
  SDSC: 'logistique', ABJC: 'logistique',
};

const PAR_SECTEUR: Record<string, Activite> = {
  'Télécommunications': 'telecoms',
  'Services financiers': 'banque',
  'Energie': 'energie',
  'Services publics': 'electricite',
  'Industriels': 'industrie',
  'Consommation de base': 'agroalimentaire',
  'Consommation discrétionnaire': 'distribution',
};

export function activiteDe(code: string, secteur: string | null): Activite | null {
  return PAR_CODE[code.toUpperCase()] ?? (secteur ? PAR_SECTEUR[secteur] ?? null : null);
}

export interface PhotoActivite { fichier: string; credit: string }

export function photoActivite(code: string, secteur: string | null): PhotoActivite | null {
  const a = activiteDe(code, secteur);
  const p = a ? (photos as Record<string, { fichier: string; photographe: string }>)[a] : undefined;
  return p ? { fichier: p.fichier, credit: `Photo : ${p.photographe} / Pexels. Illustration de l’activité, sans lien avec la société.` } : null;
}

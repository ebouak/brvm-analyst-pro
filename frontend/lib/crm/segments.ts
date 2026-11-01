/** Segments commerciaux du CRM (filtres secondaires de /admin/crm) — PURS. */
import type { Dossier } from './types';
import { continentDe, estUemoa } from './geo';

export const ZONES = ['tous', 'afrique', 'uemoa', 'europe', 'autres', 'inconnu'] as const;
export type Zone = (typeof ZONES)[number];
export const LIB_ZONE: Record<Zone, string> = { tous: 'Tous', afrique: 'Afrique', uemoa: 'UEMOA', europe: 'Europe', autres: 'Autres continents', inconnu: 'Pays inconnu' };

export const estZone = (v: unknown): v is Zone => typeof v === 'string' && (ZONES as readonly string[]).includes(v);

/** « Afrique » inclut l'UEMOA ; « Autres » = pays connu hors Afrique et Europe ; « Inconnu » = pays absent ou non classé. */
export function dansZone(pays: string | null, zone: Zone): boolean {
  const c = continentDe(pays);
  switch (zone) {
    case 'tous': return true;
    case 'afrique': return c === 'Afrique';
    case 'uemoa': return estUemoa(pays);
    case 'europe': return c === 'Europe';
    case 'autres': return c !== null && c !== 'Afrique' && c !== 'Europe';
    case 'inconnu': return c === null;
  }
}

/** Intérêt pour la formation : pages consultées ou au moins une leçon suivie. */
export const aInteretFormation = (d: Pick<Dossier, 'formationVues' | 'leconsAcademy'>): boolean => d.formationVues.length > 0 || d.leconsAcademy > 0;

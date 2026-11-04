import { PAYS, type Sgi } from './directory';
import type { SgiFrais } from './types';

/**
 * Identité d'une SGI dans les URL et à l'écran. Le `slug` vient de la base
 * (migration 0190) ; ce repli ne sert qu'aux données de secours en TS.
 */
export function slugDepuisNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugSgi(s: Pick<Sgi, 'slug' | 'nom'>): string {
  return s.slug ?? slugDepuisNom(s.nom);
}

/** Drapeau servi par le site (aucune requête vers un tiers). */
export function drapeau(code: string): string {
  const iso = code in PAYS ? PAYS[code as keyof typeof PAYS].iso : code.toLowerCase();
  return `/drapeaux/${iso}.svg`;
}

/** Repères du bandeau, tous DÉRIVÉS des données (aucun chiffre saisi). */
export interface StatistiquesSgi {
  /** SGI de l'annuaire. */
  sgi: number;
  /** Pays où au moins une SGI référencée a son siège. */
  pays: number;
  /** Barèmes lus dans une décision d'homologation. */
  baremesHomologues: number;
  /** Barèmes homologués reliés au PDF officiel de leur décision. */
  baremesAvecDecision: number;
}

export function statistiquesSgi(directory: Pick<Sgi, 'pays'>[], frais: Pick<SgiFrais, 'confiance' | 'sourceUrl'>[]): StatistiquesSgi {
  const homologues = frais.filter((f) => f.confiance === 'homologue_crepmf');
  return {
    sgi: directory.length,
    pays: new Set(directory.map((s) => s.pays)).size,
    baremesHomologues: homologues.length,
    baremesAvecDecision: homologues.filter((f) => /^https:\/\/www\.brvm\.org\/.+\.pdf$/i.test(f.sourceUrl ?? '')).length,
  };
}

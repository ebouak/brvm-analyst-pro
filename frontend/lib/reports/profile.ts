// Classification d'une société pour adapter la « Revue de résultats ».
// Les sociétés agro-industrielles ont une activité CYCLIQUE (campagnes, cours
// des matières premières) → lecture pluriannuelle plutôt que simple N/N-1.
// Fonction pure, testable.

export type Profil = 'agro' | 'telecom' | 'banque' | 'general';

export interface ProfilInfo {
  profil: Profil;
  cyclique: boolean;
  /** Nombre d'exercices à mettre en perspective (5 pour le cyclique, 2 sinon). */
  anneesAffichees: number;
  label: string;
}

// Codes agro-industriels BRVM connus (huile de palme, hévéa/caoutchouc, sucre…).
const AGRO_CODES = new Set(['PALC', 'SPHC', 'SOGC', 'SICC', 'SCRC', 'SVOC']);
const RE_AGRO = /agro|agri|h[eé]v[eé]a|caoutch|palm|sucr|coton|cacao|caf[eé]|plantation/i;
const RE_TELECOM = /t[eé]l[eé]com/i;

export function classifyCompany(code: string, secteur: string | null, famille?: string | null): ProfilInfo {
  const c = code.toUpperCase();
  const s = secteur ?? '';
  if (AGRO_CODES.has(c) || RE_AGRO.test(s)) {
    return { profil: 'agro', cyclique: true, anneesAffichees: 5, label: 'Agro-industrie (activité cyclique)' };
  }
  if (famille === 'banque' || /banque|finance/i.test(s)) {
    return { profil: 'banque', cyclique: false, anneesAffichees: 2, label: 'Banque / Finance' };
  }
  if (RE_TELECOM.test(s)) {
    return { profil: 'telecom', cyclique: false, anneesAffichees: 2, label: 'Télécommunications' };
  }
  return { profil: 'general', cyclique: false, anneesAffichees: 2, label: 'Société cotée' };
}

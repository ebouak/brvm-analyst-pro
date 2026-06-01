import type { PublicationType } from './types.js';

export function classifyPublication(libelle: string): PublicationType {
  const l = libelle.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip accents
  if (l.includes('etats financiers') || l.includes('ifrs') || l.includes('syscohada')) return 'etats_financiers';
  if (l.includes('assemblee generale') || l.includes('convocation') || l.includes('ago') || l.includes('age')) return 'ag';
  if (l.includes('rapport') && (l.includes('trimestre') || l.includes('annuel') || l.includes('semestriel') || l.includes('semestre'))) return 'rapport';
  if (l.includes('bilan')) return 'bilan';
  if (l.includes('notation')) return 'notation';
  if (l.includes('avis')) return 'avis';
  return 'autre';
}

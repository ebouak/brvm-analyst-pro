import { classifyPublication } from './classify.js';
import { dedupeHash } from './repository.js';
import type { Publication } from './types.js';

export function buildMockPublications(): Publication[] {
  const samples: Array<{ code: string; date: string; libelle: string }> = [
    { code: 'SNTS', date: '2026-04-30', libelle: 'Etats financiers IFRS - Exercice 2025 - SONATEL SN' },
    { code: 'SNTS', date: '2026-04-27', libelle: "Rapport d'activités - 1er trimestre 2026 - SONATEL SN" },
    { code: 'BOAB', date: '2026-04-15', libelle: 'Avis de convocation - Assemblée Générale Ordinaire - BANK OF AFRICA BENIN' },
    { code: 'BOAB', date: '2026-03-31', libelle: 'Etats financiers SYSCOHADA - Exercice 2025 - BOA BENIN' },
    { code: 'SNTS', date: '2026-01-15', libelle: 'Notation financière - SONATEL SN' },
  ];
  return samples.map(s => ({
    code: s.code,
    date_publication: s.date,
    libelle: s.libelle,
    type_publication: classifyPublication(s.libelle),
    source_url: `https://bfin.brvm.org/publications/${s.code}-${s.date}.pdf`,
    source: 'bdfin' as const,
    dedupe_hash: dedupeHash(s.code, s.date, s.libelle),
  }));
}

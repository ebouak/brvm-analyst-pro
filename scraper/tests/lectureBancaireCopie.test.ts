import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as copie from '../src/bank/pure/lecture.js';

describe('copie scraper de la lecture bancaire', () => {
  it('identique au module du frontend', () => {
    const a = readFileSync(new URL('../src/bank/pure/lecture.ts', import.meta.url), 'utf8');
    const b = readFileSync(new URL('../../frontend/lib/bank/lecture.ts', import.meta.url), 'utf8');
    expect(a).toBe(b);
  });
  it('donne le même résultat qu’au frontend sur un exemple', () => {
    const s = { document_url: 'u', document_libelle: 'd', page: 1, perimetre: 'individuel' as const };
    const p = copie.periodesDepuisLignes([{ periode: '2025', lignes_specifiques: { pnb: 300e9, charges_exploitation: 150e9 }, sources_specifiques: { pnb: s, charges_exploitation: s }, resultat_net: 95e9 }], []);
    expect(copie.lireBanque(p, { annee: 2025, code: 'exercice' })!.ratios[0]!.valeur).toBe(0.5);
  });
});

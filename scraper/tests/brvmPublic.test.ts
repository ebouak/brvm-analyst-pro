import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBrvmPublic } from '../src/scrapers/brvmPublic.js';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'fixtures', 'brvm-public.html'), 'utf8');

describe('parseBrvmPublic', () => {
  it('extrait les actions avec le bon mapping', () => {
    const snap = parseBrvmPublic(html, '2026-06-09');
    expect(snap.actions.length).toBe(3);
    const palc = snap.actions.find((a) => a.code === 'PALC')!;
    expect(palc.designation).toBe('PALMCI');
    expect(palc.cours_precedent).toBe(9800);
    expect(palc.cours_jour).toBe(9850); // cours clôture = dernier cours
    expect(palc.variation_pct).toBeCloseTo(0.51, 2);
    expect(palc.volume).toBe(1250);
    const snts = snap.actions.find((a) => a.code === 'SNTS')!;
    expect(snts.variation_pct).toBeCloseTo(-0.57, 2);
    expect(snts.cours_jour).toBe(17400);
  });

  it('renseigne date_marche et listes vides', () => {
    const snap = parseBrvmPublic(html, '2026-06-09');
    expect(snap.date_marche).toBe('2026-06-09');
    expect(snap.obligations).toEqual([]);
    expect(snap.indices.length).toBe(2);
    expect(typeof snap.hash_source).toBe('string');
  });

  it('renvoie 0 action si le tableau est absent', () => {
    const snap = parseBrvmPublic('<html><body>rien</body></html>', '2026-06-09');
    expect(snap.actions).toEqual([]);
  });

  it('extrait les indices BRVM-C et BRVM-30 avec valeur_precedente dérivée', () => {
    const snap = parseBrvmPublic(html, '2026-06-09');
    expect(snap.indices.length).toBe(2);
    const c = snap.indices.find((i) => i.code === 'BRVMC')!;
    expect(c.libelle).toBe('BRVM Composite');
    expect(c.valeur).toBeCloseTo(436.06, 2);
    expect(c.variation_pct).toBeCloseTo(-0.14, 2);
    // prev = 436.06 / (1 - 0.0014) ≈ 436.67
    expect(c.valeur_precedente).toBeCloseTo(436.67, 1);
    const i30 = snap.indices.find((i) => i.code === 'BRVM30')!;
    expect(i30.valeur).toBeCloseTo(204.78, 2);
  });
});

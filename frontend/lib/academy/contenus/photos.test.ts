import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Photos des leçons (relecture du 2026-11-15, migration 0244).
 * Les JSON du dépôt sont la source de la clé `image` de chaque leçon : niveau 1
 * (lecon*.json) et cours hors niveaux (autres/*.json).
 */
type Image = { url: string; alt: string; credit: string };
type Lecon = { titre: string; image?: Image | null };

const racine = __dirname;
const lire = (chemin: string) => JSON.parse(readFileSync(chemin, 'utf8')) as Record<string, unknown>;

const lecons: { source: string; lecon: Lecon }[] = [
  ...readdirSync(racine)
    .filter((f) => /^lecon\d+-.*\.json$/.test(f))
    .map((f) => ({ source: f, lecon: lire(join(racine, f)) as unknown as Lecon })),
  ...readdirSync(join(racine, 'autres'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const d = lire(join(racine, 'autres', f));
      const ls = Array.isArray(d.lessons) ? (d.lessons as Lecon[]) : [];
      return ls.map((lecon) => ({ source: `autres/${f}`, lecon }));
    }),
];
const avecImage = lecons.filter((l) => l.lecon.image);

// Seule exception à Pexels : la photo du siège de la BRVM (Wikimedia Commons).
const HOTES = ['images.pexels.com', 'upload.wikimedia.org'];

// Photos retirées parce que hors sujet (dollars, euros, cryptomonnaies, trading
// spéculatif, personnes identifiables, Bourse de New York, Durban, « scam »).
const RETIREES = [
  6801681, 186461, 7680623, 38375325, 28682356, 7876494, 6770610, 5717809, 6802043, 29799518,
  8927688, 28958001, 7414041, 3814231, 7247413, 35118208,
];

// Mots anglais fréquents dans les descriptions Pexels d'origine.
const ANGLAIS = /\b(the|of|with|and|on a|close-up|top view|showing|symbolizing|featuring)\b/i;

describe('photos des leçons', () => {
  it('le dépôt porte des photos (niveau 1 et cours hors niveaux)', () => {
    expect(avecImage.filter((l) => l.source.startsWith('lecon')).length).toBe(10);
    expect(avecImage.filter((l) => l.source.startsWith('autres/')).length).toBe(19);
  });

  it.each(avecImage.map((l) => [`${l.source} — ${l.lecon.titre}`, l.lecon.image as Image]))(
    '%s : url https Pexels, alt en français, crédit',
    (_nom, image) => {
      const url = new URL(image.url);
      expect(url.protocol).toBe('https:');
      expect(HOTES).toContain(url.hostname);
      expect(image.alt.trim().length).toBeGreaterThan(10);
      expect(image.alt).not.toMatch(ANGLAIS);
      expect(image.credit).toMatch(/^Photo : \S/);
      if (url.hostname === 'images.pexels.com') expect(image.credit).toMatch(/ \/ Pexels$/);
    },
  );

  it('aucune photo retirée ne revient', () => {
    const ids = avecImage
      .map((l) => /\/photos\/(\d+)\//.exec((l.lecon.image as Image).url)?.[1])
      .filter(Boolean)
      .map(Number);
    for (const id of RETIREES) expect(ids).not.toContain(id);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBceaoRates, parseDateFr } from '../src/parsers/bceao.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, 'fixtures/bceao-home.html'), 'utf-8');

describe('parseBceaoRates', () => {
  it('extrait les deux taux et la date d\'effet depuis la fixture réelle', () => {
    const r = parseBceaoRates(fixture);
    expect(r.tauxDirecteur).toBe(3.0);
    expect(r.guichetMarginal).toBe(5.0);
    expect(r.effectifDepuis).toBe('2026-03-16');
  });

  it('mapping par libellé : jamais de valeur si le libellé ne matche pas', () => {
    const r = parseBceaoRates('<html><body><li>Un texte sans rapport</li></body></html>');
    expect(r.tauxDirecteur).toBeNull();
    expect(r.guichetMarginal).toBeNull();
    expect(r.effectifDepuis).toBeNull();
  });
});

describe('parseDateFr', () => {
  it('parse une date française simple', () => {
    expect(parseDateFr('Effectifs depuis le 16 mars 2026')).toBe('2026-03-16');
  });
  it('gère les accents (février, décembre)', () => {
    expect(parseDateFr('depuis le 3 février 2025')).toBe('2025-02-03');
    expect(parseDateFr('depuis le 25 décembre 2024')).toBe('2024-12-25');
  });
  it('retourne null si aucune date reconnaissable', () => {
    expect(parseDateFr('pas de date ici')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { avertissementsBloquants, PREFIXE_PARTIELLE } from '../src/agregats/garde.js';

const partielle = `${PREFIXE_PARTIELLE}2023-01-01 seulement.`;

describe('avertissementsBloquants', () => {
  it('bloque la reprise partielle sans acceptation explicite', () => {
    expect(avertissementsBloquants([partielle], { partielleAcceptee: false })).toEqual([partielle]);
  });
  it('laisse passer la seule reprise partielle quand elle est acceptée', () => {
    expect(avertissementsBloquants([partielle], { partielleAcceptee: true })).toEqual([]);
  });
  it('garde bloquant tout autre avertissement, même acceptée', () => {
    const autre = 'Migration 0245 absente : anciennes colonnes lues.';
    expect(avertissementsBloquants([partielle, autre], { partielleAcceptee: true })).toEqual([autre]);
  });
  it('rien à bloquer sans avertissement', () => {
    expect(avertissementsBloquants(undefined, { partielleAcceptee: false })).toEqual([]);
  });
});

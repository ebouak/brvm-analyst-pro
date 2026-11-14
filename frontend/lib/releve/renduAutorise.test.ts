import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  egalTempsConstant, evaluerAcces, hashPlausible, idReleveValide, jetonRenduPlausible,
} from './renduAutorise';

const JETON = 'a'.repeat(64);
const HASH = createHash('sha256').update(JETON).digest('hex');
const MAINTENANT = new Date('2026-11-02T08:00:00Z');
const DANS_4_MIN = '2026-11-02T08:04:00Z';
const IL_Y_A_1_MIN = '2026-11-02T07:59:00Z';
const PROPRIO = '11111111-1111-4111-8111-111111111111';
const AUTRE = '22222222-2222-4222-8222-222222222222';

const base = {
  sessionUserId: null as string | null,
  ligneUserId: PROPRIO as string | null,
  hashAttendu: HASH as string | null,
  expire: DANS_4_MIN as string | null,
  hashFourni: HASH as string | null,
  maintenant: MAINTENANT,
};

describe('accès à la page d’un relevé', () => {
  it('(a) le propriétaire connecté entre, sans jeton', () => {
    expect(evaluerAcces({ ...base, sessionUserId: PROPRIO, hashAttendu: null, expire: null, hashFourni: null })).toBe('proprietaire');
  });

  it('(a) une session d’un AUTRE compte n’ouvre rien, même avec un jeton absent', () => {
    expect(evaluerAcces({ ...base, sessionUserId: AUTRE, hashAttendu: null, expire: null, hashFourni: null })).toBe('refus');
  });

  it('(b) un jeton dont le SHA-256 égale l’empreinte, non expiré, entre', () => {
    expect(evaluerAcces(base)).toBe('jeton');
  });

  it('(b) un jeton expiré est refusé', () => {
    expect(evaluerAcces({ ...base, expire: IL_Y_A_1_MIN })).toBe('refus');
  });

  it('(b) l’expiration exactement égale à maintenant est refusée (strictement dans le futur)', () => {
    expect(evaluerAcces({ ...base, expire: MAINTENANT.toISOString() })).toBe('refus');
  });

  it('(b) une empreinte différente est refusée', () => {
    const autre = createHash('sha256').update('b'.repeat(64)).digest('hex');
    expect(evaluerAcces({ ...base, hashFourni: autre })).toBe('refus');
  });

  it('(b) le jeton brut n’est jamais accepté à la place de son empreinte', () => {
    expect(evaluerAcces({ ...base, hashFourni: JETON })).toBe('refus'); // même forme, mais ≠ SHA-256(jeton)
  });

  it('un jeton déjà consommé (empreinte et expiration nulles) est refusé', () => {
    expect(evaluerAcces({ ...base, hashAttendu: null, expire: null })).toBe('refus');
  });

  it('tout est refusé quand rien n’est présenté', () => {
    expect(evaluerAcces({ ...base, hashFourni: null })).toBe('refus');
    expect(evaluerAcces({ ...base, expire: 'pas-une-date' })).toBe('refus');
  });
});

describe('formes acceptées', () => {
  it('jeton : 64 caractères hexadécimaux minuscules, rien d’autre', () => {
    expect(jetonRenduPlausible(JETON)).toBe(true);
    for (const v of [null, undefined, '', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), ' ' + 'a'.repeat(63)]) {
      expect(jetonRenduPlausible(v)).toBe(false);
    }
  });
  it('empreinte : SHA-256 hexadécimal', () => {
    expect(hashPlausible(HASH)).toBe(true);
    expect(hashPlausible('abc')).toBe(false);
  });
  it('identifiant de relevé : un uuid', () => {
    expect(idReleveValide(PROPRIO)).toBe(true);
    expect(idReleveValide('2026-10')).toBe(false);
    expect(idReleveValide("1' or '1'='1")).toBe(false);
  });
  it('égalité à temps constant : mêmes valeurs seulement', () => {
    expect(egalTempsConstant('abc', 'abc')).toBe(true);
    expect(egalTempsConstant('abc', 'abd')).toBe(false);
    expect(egalTempsConstant('abc', 'abcd')).toBe(false);
    expect(egalTempsConstant('', '')).toBe(true);
  });
});

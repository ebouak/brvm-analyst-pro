import { describe, expect, it } from 'vitest';
import { codeSujetValide, corpsCheckout, sujetAchat } from '@/lib/billing/chariow/regles';

describe('dossier Chariow — code société', () => {
  it.each([
    ['SNTS', 'SNTS'],
    [' palc ', 'PALC'],
    ['bBgC', 'BBGC'],
  ])('normalise %s en %s', (entree, attendu) => {
    expect(codeSujetValide(entree)).toBe(attendu);
  });

  it.each([undefined, null, '', 'A', '../SNTS', 'SNTS-01', 48])('refuse %s', (entree) => {
    expect(codeSujetValide(entree)).toBeNull();
  });
});

describe('dossier Chariow — corps de checkout', () => {
  const base = {
    productCode: 'dossier:a4',
    subjectCode: 'SNTS',
    firstName: 'Awa',
    lastName: 'Koné',
    phone: { number: '0700000000', countryCode: 'CI' },
  };

  it('accepte le code société sans autoriser prix ou produit Chariow', () => {
    expect(corpsCheckout.safeParse(base).success).toBe(true);
    expect(corpsCheckout.safeParse({ ...base, amount: 1 }).success).toBe(false);
    expect(corpsCheckout.safeParse({ ...base, product_id: 'prd_x' }).success).toBe(false);
  });

  it('laisse le code société facultatif au schéma pour les autres produits', () => {
    expect(corpsCheckout.safeParse({ ...base, productCode: 'academy:integrale', subjectCode: undefined }).success).toBe(true);
  });

  it('exige le code seulement pour un dossier', () => {
    expect(sujetAchat('dossier', 'snts')).toEqual({ ok: true, code: 'SNTS' });
    expect(sujetAchat('dossier', undefined)).toEqual({ ok: false, message: 'Choisissez une société.' });
    expect(sujetAchat('pass', undefined)).toEqual({ ok: true, code: null });
  });
});

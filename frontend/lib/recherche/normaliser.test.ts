import { describe, it, expect } from 'vitest';
import { contientDonneePersonnelle, empreinte, hacherIdentifiant, normaliser, validerRequete } from './normaliser';

describe('normalisation de la requête', () => {
  it('ignore accents, casse, ponctuation et espaces superflus', () => {
    expect(normaliser('  Une BANQUE  ivoirienne, qui verse… un dividende ! ')).toBe('une banque ivoirienne qui verse un dividende');
    expect(normaliser("Télécoms d'Afrique")).toBe('telecoms d afrique');
  });

  it('même requête, même empreinte ; requête différente, empreinte différente', () => {
    expect(empreinte('Banque  Sénégalaise')).toBe(empreinte('banque senegalaise'));
    expect(empreinte('banque senegalaise')).not.toBe(empreinte('banque ivoirienne'));
    expect(empreinte('x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('détecte e-mails et numéros de téléphone, pas les montants', () => {
    expect(contientDonneePersonnelle('écrire à jean.dupont@gmail.com')).toBe(true);
    expect(contientDonneePersonnelle('appelez le +225 07 08 09 10 11')).toBe(true);
    expect(contientDonneePersonnelle('rendement de 6 % et 1 000 000 FCFA')).toBe(false);
  });

  it('borne la longueur et refuse les données personnelles', () => {
    expect(validerRequete('ab')).toEqual({ ok: false, erreur: 'longueur' });
    expect(validerRequete('x'.repeat(151))).toEqual({ ok: false, erreur: 'longueur' });
    expect(validerRequete(42)).toEqual({ ok: false, erreur: 'longueur' });
    expect(validerRequete('contact: a@b.ci')).toEqual({ ok: false, erreur: 'donnee_personnelle' });
    expect(validerRequete('  une banque  ')).toEqual({ ok: true, q: 'une banque' });
  });

  it('hache un identifiant de compte sans le révéler', () => {
    const h = hacherIdentifiant('3f1c-uuid');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain('3f1c');
  });
});

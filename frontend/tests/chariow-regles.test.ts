import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  CODE_FORMATION,
  ID_VENTE,
  corpsCheckout,
  droitNiveauValide,
  niveauxDesDroits,
  lirePulse,
  normaliserTelephone,
  telephoneChariow,
  signatureValide,
  verifierVente,
} from '@/lib/billing/chariow/regles';

const SECRET = 'whsec_test_uniquement';
const signer = (corps: string, secret = SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(corps, 'utf8').digest('hex');

describe('signatureValide', () => {
  // Corps tel que Chariow l'émet : « / » échappés, non-ASCII en \uXXXX.
  const corps = '{"event":"successful.sale","sale":{"id":"sal_abc123","url":"https:\\/\\/x.com","nom":"\\u00e9"}}';

  it('accepte la signature du corps brut', () => {
    expect(signatureValide(corps, signer(corps), SECRET)).toBe(true);
  });

  it('refuse un corps re-sérialisé (les « / » ne sont plus échappés)', () => {
    const reserialise = JSON.stringify(JSON.parse(corps));
    expect(signatureValide(reserialise, signer(corps), SECRET)).toBe(false);
  });

  it('refuse un mauvais secret, un en-tête absent ou sans préfixe', () => {
    expect(signatureValide(corps, signer(corps, 'whsec_autre'), SECRET)).toBe(false);
    expect(signatureValide(corps, null, SECRET)).toBe(false);
    expect(signatureValide(corps, signer(corps).slice(7), SECRET)).toBe(false);
  });

  it('refuse tout quand le secret n’est pas configuré', () => {
    expect(signatureValide(corps, signer(corps, ''), undefined)).toBe(false);
  });

  it('ne lève pas sur une signature de longueur différente', () => {
    expect(signatureValide(corps, 'sha256=abc', SECRET)).toBe(false);
  });
});

describe('lirePulse', () => {
  it('extrait événement, vente et transaction — rien du client', () => {
    const lu = lirePulse(
      {
        event: 'successful.sale',
        sale: { id: 'sal_xyz789', custom_metadata: { txn: '0b8f1c1e-1234-4abc-9def-001122334455' } },
        customer: { email: 'x@y.z', phone: '+22507' },
      },
      null,
    );
    expect(lu).toEqual({
      evenement: 'successful.sale',
      saleId: 'sal_xyz789',
      txnMeta: '0b8f1c1e-1234-4abc-9def-001122334455',
    });
  });

  it('ignore un identifiant de vente ou de transaction mal formé', () => {
    const lu = lirePulse({ event: 'successful.sale', sale: { id: '../../x', custom_metadata: { txn: "1' or 1=1" } } }, null);
    expect(lu.saleId).toBeNull();
    expect(lu.txnMeta).toBeNull();
  });

  it('se rabat sur l’en-tête x-pulse-event', () => {
    expect(lirePulse({}, 'license.revoked').evenement).toBe('license.revoked');
  });
});

describe('verifierVente', () => {
  const att = { saleId: 'sal_1', chariowProductId: 'prd_niv1', montant: 15000, devise: 'XOF' };
  const vente = { id: 'sal_1', status: 'completed', amount: { value: 15000, currency: 'XOF' }, product: { id: 'prd_niv1' } };

  it('accepte une vente complète et conforme', () => {
    expect(verifierVente(vente, att)).toEqual({ ok: true });
    expect(verifierVente({ ...vente, status: 'settled' }, att)).toEqual({ ok: true });
  });

  it('accepte le produit désigné par son slug', () => {
    expect(verifierVente({ ...vente, product: { id: 'prd_x', slug: 'prd_niv1' } }, att).ok).toBe(true);
  });

  it.each([
    ['statut non payé', { ...vente, status: 'awaiting_payment' }],
    ['vente abandonnée', { ...vente, status: 'abandoned' }],
    ['autre vente', { ...vente, id: 'sal_2' }],
    ['autre produit', { ...vente, product: { id: 'prd_moins_cher' } }],
    ['autre devise', { ...vente, amount: { value: 15000, currency: 'EUR' } }],
    ['montant insuffisant', { ...vente, amount: { value: 5, currency: 'XOF' } }],
    ['montant illisible', { ...vente, amount: { value: 'abc', currency: 'XOF' } }],
  ])('refuse : %s', (_nom, v) => {
    expect(verifierVente(v, att).ok).toBe(false);
  });

  it('refuse une vente absente', () => {
    expect(verifierVente(null, att).ok).toBe(false);
  });
});

describe('droitNiveauValide — à vie sauf refonte > 12 mois', () => {
  const achat = { granted_at: '2026-01-15T00:00:00Z', expires_at: null, revoked_at: null };
  const now = new Date('2028-06-01T00:00:00Z');

  it('valide sans refonte', () => {
    expect(droitNiveauValide(achat, null, now)).toBe(true);
  });

  it('valide si la refonte tombe dans les 12 mois suivant l’achat', () => {
    expect(droitNiveauValide(achat, '2026-12-01T00:00:00Z', now)).toBe(true);
  });

  it('invalide si la refonte arrive plus de 12 mois après l’achat', () => {
    expect(droitNiveauValide(achat, '2027-03-01T00:00:00Z', now)).toBe(false);
  });

  it('invalide si révoqué (remboursement)', () => {
    expect(droitNiveauValide({ ...achat, revoked_at: '2026-02-01T00:00:00Z' }, null, now)).toBe(false);
  });

  it('invalide si expiré', () => {
    expect(droitNiveauValide({ ...achat, expires_at: '2027-01-01T00:00:00Z' }, null, now)).toBe(false);
  });
});

describe('corpsCheckout — le navigateur ne fixe ni prix ni produit Chariow', () => {
  const ok = {
    productCode: 'academy:debutant',
    firstName: 'Awa',
    lastName: 'Koné',
    phone: { number: '0700000000', countryCode: 'CI' },
  };

  it('accepte le corps attendu', () => {
    expect(corpsCheckout.safeParse(ok).success).toBe(true);
  });

  it.each([
    ['un prix', { ...ok, amount: 1 }],
    ['un product_id Chariow', { ...ok, product_id: 'prd_x' }],
    ['un plan', { ...ok, plan: 'platinium' }],
    ['un rôle', { ...ok, role: 'admin' }],
  ])('refuse %s', (_nom, corps) => {
    expect(corpsCheckout.safeParse(corps).success).toBe(false);
  });

  it('refuse un code produit hors format et un téléphone non numérique', () => {
    expect(corpsCheckout.safeParse({ ...ok, productCode: 'DROP TABLE' }).success).toBe(false);
    expect(corpsCheckout.safeParse({ ...ok, phone: { number: '07 00', countryCode: 'CI' } }).success).toBe(false);
  });

  it('normalise un numéro saisi à la main', () => {
    expect(normaliserTelephone('+225 07 00-00.00.00')).toBe('2250700000000');
    expect(normaliserTelephone('00225 0700000000')).toBe('2250700000000');
  });
});

describe('niveauxDesDroits — formation complète (0155) et niveaux à l’unité', () => {
  const base = { granted_at: '2026-10-19T00:00:00Z', expires_at: null, revoked_at: null };
  const now = new Date('2027-06-01T00:00:00Z');
  const aucune = new Map();

  it('la formation complète ouvre les quatre niveaux', () => {
    const n = niveauxDesDroits([{ ...base, product_code: CODE_FORMATION, niveau: null }], aucune, now);
    expect([...n].sort()).toEqual(['avance', 'debutant', 'expert', 'intermediaire']);
  });

  it('un niveau acheté seul n’ouvre que lui', () => {
    const n = niveauxDesDroits([{ ...base, product_code: 'academy:avance', niveau: 'avance' }], aucune, now);
    expect([...n]).toEqual(['avance']);
  });

  it('une refonte tardive d’UN niveau ne retire que ce niveau à l’acheteur de la formation', () => {
    const refontes = new Map<'avance', string>([['avance', '2028-03-01T00:00:00Z']]);
    const n = niveauxDesDroits([{ ...base, product_code: CODE_FORMATION, niveau: null }], refontes, new Date('2028-06-01T00:00:00Z'));
    expect(n.has('avance')).toBe(false);
    expect(n.size).toBe(3);
  });

  it('formation remboursée (révoquée) : plus rien', () => {
    const n = niveauxDesDroits([{ ...base, revoked_at: '2026-11-01T00:00:00Z', product_code: CODE_FORMATION, niveau: null }], aucune, now);
    expect(n.size).toBe(0);
  });

  it('un droit étranger à l’Academy ou sans niveau n’ouvre rien', () => {
    const n = niveauxDesDroits(
      [{ ...base, product_code: 'pass:premium:monthly', niveau: null }, { ...base, product_code: 'academy:debutant', niveau: null }],
      aucune,
      now,
    );
    expect(n.size).toBe(0);
  });
});

describe('telephoneChariow — l’indicatif saisi fait foi sur le pays', () => {
  it('« France » + numéro ivoirien en +225 → CI, indicatif retiré (cas réel du 2026-10-19)', () => {
    expect(telephoneChariow('+2250707115115', 'FR')).toEqual({ number: '0707115115', countryCode: 'CI' });
  });
  it('format 00 et espaces', () => {
    expect(telephoneChariow('00 221 77 123 45 67', 'CI')).toEqual({ number: '771234567', countryCode: 'SN' });
  });
  it('numéro français en +33', () => {
    expect(telephoneChariow('+33 6 12 34 56 78', 'CI')).toEqual({ number: '612345678', countryCode: 'FR' });
  });
  it('sans indicatif : le pays choisi est conservé', () => {
    expect(telephoneChariow('07 07 11 51 15', 'CI')).toEqual({ number: '0707115115', countryCode: 'CI' });
  });
  it('indicatif inconnu : pays choisi conservé, chiffres seuls', () => {
    expect(telephoneChariow('+1 202 555 0123', 'FR')).toEqual({ number: '12025550123', countryCode: 'FR' });
  });
});

describe('ID_VENTE — format réel des ventes Chariow', () => {
  it('accepte le format de production (constaté le 2026-10-19) et celui de la documentation', () => {
    expect(ID_VENTE.test('SALERPBUEKQBLIBCHU9')).toBe(true);
    expect(ID_VENTE.test('sal_xyz789abc')).toBe(true);
  });
  it('refuse un Pulse de test et tout identifiant hors gabarit', () => {
    for (const x of ['test_sale_123', '../sales', 'SAL', 'abc', 'sal_a/b', '']) expect(ID_VENTE.test(x)).toBe(false);
  });
  it('lirePulse lit une vraie vente au format de production', () => {
    expect(lirePulse({ event: 'successful.sale', sale: { id: 'SALERPBUEKQBLIBCHU9' } }, null).saleId).toBe('SALERPBUEKQBLIBCHU9');
  });
});

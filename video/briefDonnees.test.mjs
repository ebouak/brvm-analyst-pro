import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nettoyerResume, precedentDe, coursSeance, pointsIntraday, construireAgenda, votreSeance } from './briefDonnees.mjs';

test('nettoyerResume écarte le texte d’un mur payant et les résumés trop courts', () => {
  assert.equal(nettoyerResume('Ce contenu est réservé aux membres. Visitez le site et connectez-vous ou bien adhérez pour le lire.'), null);
  assert.equal(nettoyerResume('Trop court.'), null);
  assert.equal(nettoyerResume(null), null);
  const vrai = 'La société annonce un résultat net en hausse de 12 % sur le premier semestre, porté par ses activités de détail.';
  assert.equal(nettoyerResume(`  ${vrai}  `), vrai);
});

test('precedentDe prend cours_precedent, sinon le déduit de la variation publiée', () => {
  assert.equal(precedentDe({ cours_precedent: 25500, cours_jour: 26000, variation_pct: 1.96 }), 25500);
  assert.equal(precedentDe({ cours_precedent: null, cours_jour: 102, variation_pct: 2 }), 100);
  assert.equal(precedentDe({ cours_precedent: null, cours_jour: null, variation_pct: 2 }), null);
});

test('coursSeance garde les valeurs cotées avec leur veille', () => {
  const c = coursSeance([
    { code: 'SNTS', cours_jour: 4040, variation_pct: -1.22, cours_precedent: 4090 },
    { code: 'XXXX', cours_jour: null, variation_pct: null },
  ]);
  assert.deepEqual(c, [{ code: 'SNTS', cours: 4040, variation_pct: -1.22, precedent: 4090 }]);
});

test('pointsIntraday trie, écarte les trous et les répétitions après la séance', () => {
  const p = pointsIntraday([
    { captured_at: '2026-11-23T09:30:00+00:00', valeur: 312.5 },
    { captured_at: '2026-11-23T09:15:00+00:00', valeur: 311.9 },
    { captured_at: '2026-11-23T09:45:00+00:00', valeur: null },
    { captured_at: '2026-11-23T15:45:00+00:00', valeur: 313.1 },
    { captured_at: '2026-11-23T21:30:00+00:00', valeur: 313.1 },
  ]);
  assert.deepEqual(p.map((x) => x.valeur), [311.9, 312.5, 313.1]);
});

test('construireAgenda : lignes fiables seulement, dans la fenêtre, triées', () => {
  const a = construireAgenda({
    seance: '2026-11-21',
    dividendes: [
      { code: 'SNTS', exercice: 2025, ex_date: '2026-11-25', payment_date: '2026-12-05', montant: 1655 },
      { code: 'ORAC', exercice: 2025, ex_date: '2026-11-24', payment_date: '2026-11-27', montant: 704 },
      { code: 'ZERO', exercice: 2025, ex_date: '2026-11-24', payment_date: null, montant: 0 },
      { code: 'SANS', exercice: null, ex_date: '2026-11-24', payment_date: null, montant: 300 },
      { code: 'PASS', exercice: 2025, ex_date: '2026-11-20', payment_date: null, montant: 300 },
    ],
    assemblees: [
      { code: 'PALC', nature_cle: 'ordinaire', date_ag: '2026-11-26', dernier_bulletin: '2026-11-21' },
      { code: 'VIEL', nature_cle: 'mixte', date_ag: '2026-11-26', dernier_bulletin: '2026-10-01' },
    ],
    dernierBulletin: '2026-11-21',
  });
  assert.deepEqual(a.map((i) => `${i.date} ${i.type} ${i.code}`), [
    '2026-11-24 detachement ORAC',
    '2026-11-25 detachement SNTS',
    '2026-11-26 ag PALC',
    '2026-11-27 paiement ORAC',
  ]);
});

test('votreSeance : variation du jour des positions, liquidités exclues, rien d’estimé', () => {
  const m = { cours_seance: [
    { code: 'SNTS', cours: 4040, variation_pct: -1.22, precedent: 4090 },
    { code: 'PALC', cours: 7600, variation_pct: 2.01, precedent: 7450 },
  ] };
  const r = votreSeance([
    { code: 'SNTS', quantite: 100 },
    { code: 'PALC', quantite: 10 },
    { code: 'PALC', quantite: 10 },
    { code: 'LIQUIDITES', quantite: 1 },
    { code: 'ABSN', quantite: 5 },
  ], m);
  assert.equal(r.ecart, 100 * (4040 - 4090) + 20 * (7600 - 7450));
  assert.equal(r.valeur, 100 * 4040 + 20 * 7600);
  assert.equal(r.sansCours, 1);
  assert.deepEqual(r.lignes.map((l) => l.code), ['SNTS', 'PALC']);
  assert.ok(Math.abs(r.pct - (r.ecart / (100 * 4090 + 20 * 7450)) * 100) < 1e-9);
});

test('votreSeance : rien à dire sans position valorisable', () => {
  assert.equal(votreSeance([{ code: 'LIQUIDITES', quantite: 1 }], { cours_seance: [] }), null);
  assert.equal(votreSeance([], { cours_seance: [] }), null);
});

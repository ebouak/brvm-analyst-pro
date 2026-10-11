import assert from 'node:assert/strict';
import test from 'node:test';
import { performanceTitre, piliersThese, controleExDate } from './suivi.ts';

test('performance : 1 mois (21 séances), depuis le 1er janvier, position dans la plage 52 semaines', () => {
  const closes = Array.from({ length: 30 }, (_, i) => 100 + i); // 100 … 129
  const p = performanceTitre({ closes, coursDebutAnnee: 80, haut52: 140, bas52: 60 });
  assert.ok(Math.abs(p.var_1m - (129 / 108 - 1)) < 1e-9);
  assert.ok(Math.abs(p.var_ytd - (129 / 80 - 1)) < 1e-9);
  assert.ok(Math.abs(p.position_52s - (129 - 60) / (140 - 60)) < 1e-9);
});

test('performance : données absentes -> null, jamais 0', () => {
  const p = performanceTitre({ closes: [100], coursDebutAnnee: null, haut52: null, bas52: null });
  assert.equal(p.var_1m, null);
  assert.equal(p.var_ytd, null);
  assert.equal(p.position_52s, null);
});

test('piliers : chaque pilier porte sa mesure, son seuil et un statut factuel', () => {
  const ps = piliersThese({
    famille: 'general',
    croissanceCA: 0.083, margeExp: 0.348, margeExpPrecedente: 0.349, roe: 0.296,
    endettement: 0.177, dividendes: [1400, 1500, 1575, 1655, 1750], per: 10.88, perMediane: 12.5,
  });
  const p = (cle) => ps.find((x) => x.cle === cle);
  assert.equal(p('croissance').statut, 'tenu');
  assert.equal(p('marge').tendance, 'stable');
  assert.equal(p('rentabilite').statut, 'tenu');
  assert.equal(p('endettement').statut, 'tenu');
  assert.equal(p('dividende').statut, 'tenu', 'cinq exercices sans baisse');
  assert.equal(p('valorisation').statut, 'tenu', 'PER sous la médiane sectorielle');
  for (const x of ps) assert.ok(x.seuil.length > 0, `${x.cle} sans seuil`);
});

test('piliers : une donnée absente est « non mesurable », jamais « tenu » ni « non tenu »', () => {
  const ps = piliersThese({ famille: 'general', croissanceCA: null, margeExp: null, margeExpPrecedente: null, roe: null, endettement: null, dividendes: [], per: null, perMediane: null });
  for (const x of ps) assert.equal(x.statut, 'non_mesurable', x.cle);
});

test('piliers : un dividende réduit sur la période fait tomber le pilier, une banque n’a pas de pilier d’endettement', () => {
  const ps = piliersThese({ famille: 'banque', croissanceCA: 0.05, margeExp: null, margeExpPrecedente: null, roe: 0.18, endettement: 4.2, dividendes: [100, 120, 90], per: 6, perMediane: 7 });
  assert.equal(ps.find((x) => x.cle === 'dividende').statut, 'non_tenu');
  assert.equal(ps.find((x) => x.cle === 'endettement').statut, 'non_applicable');
});

test('ex-date : une baisse très inférieure au dividende signale une date à vérifier (SNTS : 50 pour 1 750)', () => {
  assert.equal(controleExDate({ dividende: 1750, baisse: 50 }), 'a_verifier');
  assert.equal(controleExDate({ dividende: 140.4, baisse: 350 }), 'coherente');
  assert.equal(controleExDate({ dividende: 55.44, baisse: 0 }), 'a_verifier');
  assert.equal(controleExDate({ dividende: 100, baisse: 60 }), 'coherente', 'au-delà de 50 % du dividende');
});

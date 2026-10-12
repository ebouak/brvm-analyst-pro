import assert from 'node:assert/strict';
import test from 'node:test';
import { performanceTitre, piliersThese, controleExDate, rentabiliteActif, fiscaliteDividende, notationDepassee, detteFinanciere, memesComptes } from './suivi.ts';

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

test("rentabilité de l'actif : l'actif total du bilan quand il existe (SNTS 2025 : 413,6 / 3 270,2 = 12,6 %)", () => {
  const r = rentabiliteActif({ resultatNet: 413_588e6, totalActif: 3_270_175e6, capitauxPropres: 1_399_263e6, dette: 248_038e6 });
  assert.equal(r?.mesure, 'actif_total');
  assert.equal(Math.round(r.valeur * 1000) / 10, 12.6);
});

test("rentabilité de l'actif : sans bilan, l'approximation change de NOM (capitaux investis), jamais présentée comme l'actif", () => {
  const r = rentabiliteActif({ resultatNet: 413_588e6, totalActif: null, capitauxPropres: 1_399_263e6, dette: 248_038e6 });
  assert.equal(r?.mesure, 'capitaux_investis');
  assert.equal(Math.round(r.valeur * 1000) / 10, 25.1);
  assert.equal(rentabiliteActif({ resultatNet: null, totalActif: 1, capitauxPropres: 1, dette: 1 }), null);
  assert.equal(rentabiliteActif({ resultatNet: 1, totalActif: null, capitauxPropres: 1, dette: null }), null);
});

test("fiscalité du dividende : le taux vient du barème du pays de l'émetteur, jamais d'un 12 % en dur", () => {
  assert.deepEqual(fiscaliteDividende('SN'), { pays: 'Sénégal', taux: 0.1 });
  assert.deepEqual(fiscaliteDividende('ML'), { pays: 'Mali', taux: 0.07 });
  // Pays connu au taux non vérifié, ou pays absent : AUCUN chiffre.
  assert.deepEqual(fiscaliteDividende('NE'), { pays: 'Niger', taux: null });
  assert.deepEqual(fiscaliteDividende(null), { pays: null, taux: null });
});

test('notation : un communiqué de notation postérieur à la note enregistrée la rend « à confirmer » (SNTS : AA+ du 01/06/2025, communiqué du 30/06/2026)', () => {
  assert.equal(notationDepassee('2025-06-01', ['2026-06-30', '2024-06-28']), '2026-06-30');
  assert.equal(notationDepassee('2025-06-01', ['2024-06-28']), null);
  // Note sans date : on ne peut pas la dater, le communiqué le plus récent la signale.
  assert.equal(notationDepassee(null, ['2024-06-28']), '2024-06-28');
  assert.equal(notationDepassee('2025-06-01', []), null);
});

test('dette financière : bilan court + long terme hors banques (SNTS 2025 : 232,66 + 170,03 = 402,69 Md, comptes certifiés)', () => {
  assert.deepEqual(
    detteFinanciere({ famille: 'general', lt: 232_660e6, ct: 170_026e6, declaree: 248_038e6 }),
    { valeur: 402_686e6, perimetre: 'totale' },
  );
  // Une rubrique absente du bilan vaut zéro : la consigne d'extraction met null quand la ligne n'existe pas.
  assert.deepEqual(detteFinanciere({ famille: 'general', lt: null, ct: 30e9, declaree: 2e9 }), { valeur: 30e9, perimetre: 'totale' });
});

test('dette financière : banque = long terme seul (le court terme du bilan bancaire, ce sont les dépôts) ; sans bilan = périmètre non vérifié', () => {
  assert.deepEqual(detteFinanciere({ famille: 'banque', lt: 7e9, ct: 500e9, declaree: 7e9 }), { valeur: 7e9, perimetre: 'long_terme' });
  assert.deepEqual(detteFinanciere({ famille: 'general', lt: null, ct: null, declaree: 5e9 }), { valeur: 5e9, perimetre: 'declaree' });
  assert.equal(detteFinanciere({ famille: 'general', lt: null, ct: null, declaree: null }), null);
});

test('mêmes comptes : le bilan ne se croise avec les fondamentaux que s’ils portent les mêmes capitaux propres (SCRC 2025 : SYSCOHADA 13,8 Md, IFRS 17,2 Md)', () => {
  assert.equal(memesComptes(13_822_035_189, 17_243_172_000), false);
  assert.equal(memesComptes(1_399_263e6, 1_399_263e6), true);
  assert.equal(memesComptes(100, 101.5), true, 'écart de 1,5 % toléré');
  assert.equal(memesComptes(null, 5), true, 'sans point de comparaison, rien ne prouve un écart');
});

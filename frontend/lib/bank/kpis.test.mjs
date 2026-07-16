import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBankYear, computeBankKpis, scoreBanqueUemoa } from './kpis.ts';

/** npx tsx --test lib/bank/kpis.test.mjs */

/** Cas réel : BOABF exercice 2025 (valeurs base, alignées Sika). */
const BOABF_2025 = {
  periode: '2025',
  pnb: 57_819_599_384,
  margeInterets: 38_226_426_205,
  fraisGeneraux: 25_420_000_000,
  resultatNet: 19_252_015_161,
  totalActifs: 1_148_674_652_683,
  capitauxPropres: 126_516_071_556,
  depotsClientele: 877_821_961_416,
  creditsClientele: 474_063_826_349,
  creancesDouteuses: null,
  ratioSolvabilite: null,
};
const BOABF_2024 = {
  ...BOABF_2025,
  periode: '2024',
  totalActifs: 1_079_053_439_829,
  capitauxPropres: 129_272_440_868,
};
const MARKET = { cours: 7335, shares: 44_000_000, dividendeParAction: 397 };

test('extractBankYear lit colonnes standard + lignes_specifiques', () => {
  const y = extractBankYear(
    {
      periode: '2025', resultat_net: 100, depenses_exploitation: 50,
      lignes_specifiques: { pnb: 200, marge_interets: 120 },
    },
    {
      total_actifs: 1000, total_capitaux_propres: 150,
      lignes_specifiques: { depots_clientele: 700, credits_clientele: 450 },
    },
  );
  assert.ok(y);
  assert.equal(y.pnb, 200);
  assert.equal(y.margeInterets, 120);
  assert.equal(y.fraisGeneraux, 50);
  assert.equal(y.depotsClientele, 700);
  assert.equal(y.creditsClientele, 450);
  assert.equal(y.creancesDouteuses, null); // absent = null, jamais 0
});

test('extractBankYear: frais généraux replie sur frais_generaux_admin', () => {
  const y = extractBankYear(
    { periode: '2025', resultat_net: 1, depenses_exploitation: null, frais_generaux_admin: 42 },
    null,
  );
  assert.equal(y.fraisGeneraux, 42);
});

test('KPIs BOABF : ordres de grandeur réalistes', () => {
  const k = computeBankKpis(BOABF_2025, BOABF_2024, MARKET);
  // ROE sur CP moyens (~127,9 Md) : ~15 %
  assert.ok(k.roe > 0.14 && k.roe < 0.16, `roe=${k.roe}`);
  // ROA ~1,7 %
  assert.ok(k.roa > 0.015 && k.roa < 0.02, `roa=${k.roa}`);
  // NIM sur actifs moyens : ~3,4 %
  assert.ok(k.nim > 0.03 && k.nim < 0.04, `nim=${k.nim}`);
  // Coefficient d'exploitation ~44 %
  assert.ok(k.costIncome > 0.40 && k.costIncome < 0.48, `ce=${k.costIncome}`);
  // Transformation crédits/dépôts ~54 %
  assert.ok(k.transformation > 0.5 && k.transformation < 0.6, `tr=${k.transformation}`);
  // P/B ~2,55
  assert.ok(k.pb > 2.4 && k.pb < 2.7, `pb=${k.pb}`);
  // Rendement ~5,4 %
  assert.ok(k.rendementDiv > 0.05 && k.rendementDiv < 0.06, `rdt=${k.rendementDiv}`);
  // Non publiés → null, pas 0
  assert.equal(k.nplRatio, null);
  assert.equal(k.ratioSolvabilite, null);
});

test('score BOABF : neutralisation des axes non publiés + confiance affichée', () => {
  const k = computeBankKpis(BOABF_2025, BOABF_2024, MARKET);
  const s = scoreBanqueUemoa(k);
  // Disponible : rentabilité 25 + intermédiation 25 + levier 5 = 55 pts → confiance 0.55
  assert.equal(s.confiance, 0.55);
  assert.ok(s.total != null, 'score calculable (≥40 pts mesurables)');
  assert.ok(s.total > 50 && s.total <= 100, `total=${s.total}`);
  // L'axe qualité est entièrement neutralisé : 0 point disponible
  const qualite = s.axes.find((a) => a.id === 'qualite');
  assert.equal(qualite.disponibles, 0);
  // Chaque sous-score non publié est null (jamais 0 déguisé)
  assert.ok(qualite.sousScores.every((x) => x.points === null));
});

test('banque exemplaire : score proche de 100', () => {
  const k = computeBankKpis(
    { ...BOABF_2025, creancesDouteuses: 14_000_000_000, ratioSolvabilite: 0.19,
      fraisGeneraux: 26_000_000_000, resultatNet: 20_000_000_000 },
    BOABF_2024,
    { cours: 3000, shares: 44_000_000, dividendeParAction: 150 }, // P/B ~1, yield 5 %
  );
  const s = scoreBanqueUemoa(k);
  // NPL ~3 % (<5 → plein), solva 19 % (plein), P/B 1,04 + yield 5 % (plein marché)
  assert.ok(s.confiance >= 0.9, `confiance=${s.confiance}`);
  assert.ok(s.total >= 85, `total=${s.total}`);
});

test('banque dégradée : score faible', () => {
  const k = computeBankKpis(
    {
      ...BOABF_2025,
      resultatNet: 1_000_000_000,            // ROE ~0,8 %
      fraisGeneraux: 50_000_000_000,          // CE ~86 %
      margeInterets: 5_000_000_000,           // NIM ~0,45 %
      creditsClientele: 400_000_000_000,
      creancesDouteuses: 80_000_000_000,      // NPL 20 %
      ratioSolvabilite: 0.10,                 // sous le minimum réglementaire
    },
    BOABF_2024,
    { cours: 7335, shares: 44_000_000, dividendeParAction: 0 },
  );
  const s = scoreBanqueUemoa(k);
  assert.ok(s.total != null && s.total < 25, `total=${s.total}`);
});

test('sans bilan : score honnêtement indisponible (< 40 pts mesurables)', () => {
  const k = computeBankKpis(
    { ...BOABF_2025, totalActifs: null, capitauxPropres: null, depotsClientele: null, creditsClientele: null },
    null,
    { cours: null, shares: null, dividendeParAction: null },
  );
  const s = scoreBanqueUemoa(k);
  // Mesurable : CE 10 seulement (ROE/ROA/NIM exigent le bilan) → pas de score
  assert.equal(s.total, null);
  assert.ok(s.confiance < 0.4);
});

test('moyennes : sans exercice précédent, on utilise le bilan courant', () => {
  const seul = computeBankKpis(BOABF_2025, null, MARKET);
  const deux = computeBankKpis(BOABF_2025, BOABF_2024, MARKET);
  assert.ok(seul.roe != null && deux.roe != null);
  assert.notEqual(seul.roe, deux.roe); // la moyenne change le dénominateur
});

// Tests du simulateur. Exécuter : npx tsx lib/simulate.test.mjs
import assert from 'node:assert';
import { simulateInvestment } from './simulate.ts';

const prices = [
  { date: '2021-01-04', close: 10000 },
  { date: '2022-01-04', close: 12000 },
  { date: '2023-01-04', close: 15000 },
  { date: '2024-01-04', close: 20000 },
];

// --- Rendement simple sans dividendes ---------------------------------------
// 1 000 000 à 10 000 => 100 actions ; fin à 20 000 => 2 000 000 ; +100 %
let r = simulateInvestment(1_000_000, '2021-01-01', prices);
assert.ok(r, 'simulation attendue');
assert.equal(r.shares, 100);
assert.equal(r.cashLeftover, 0);
assert.equal(r.finalStockValue, 2_000_000);
assert.equal(r.totalDividends, 0);
assert.equal(r.finalValue, 2_000_000);
assert.ok(Math.abs(r.totalReturnPct - 100) < 0.01, `+100 %, obtenu ${r.totalReturnPct}`);
// ~3 ans => annualisé ~26 %
assert.ok(r.annualizedReturnPct != null && Math.abs(r.annualizedReturnPct - 26) < 1.5,
  `annualisé ~26 %, obtenu ${r.annualizedReturnPct}`);

// --- Avec dividendes (versés pendant la détention) ----------------------------
r = simulateInvestment(1_000_000, '2021-01-01', prices, [
  { date: '2021-06-01', montant: 500 },  // 100 × 500 = 50 000
  { date: '2023-06-01', montant: 700 },  // 100 × 700 = 70 000
  { date: '2020-06-01', montant: 999 },  // hors période : ignoré
]);
assert.equal(r.totalDividends, 120_000);
assert.equal(r.finalValue, 2_120_000);

// --- Reliquat (actions entières) ----------------------------------------------
// 1 050 000 à 10 000 => 105 actions, reliquat 0 ; 1 005 000 => 100 actions + 5 000
r = simulateInvestment(1_005_000, '2021-01-01', prices);
assert.equal(r.shares, 100);
assert.equal(r.cashLeftover, 5_000);
assert.equal(r.finalValue, 2_005_000);

// --- Date de départ intermédiaire : démarre à la première séance disponible ---
r = simulateInvestment(1_200_000, '2021-06-15', prices);
assert.equal(r.startDate, '2022-01-04'); // première séance >= date demandée
assert.equal(r.startPrice, 12000);
assert.equal(r.shares, 100);

// --- Cas limites ---------------------------------------------------------------
assert.equal(simulateInvestment(0, '2021-01-01', prices), null);
assert.equal(simulateInvestment(-5, '2021-01-01', prices), null);
assert.equal(simulateInvestment(1_000_000, '2024-06-01', prices), null); // < 2 points
assert.equal(simulateInvestment(5000, '2021-01-01', prices), null); // < 1 action
assert.equal(simulateInvestment(1_000_000, '2021-01-01', []), null);

// --- Période courte : pas d'annualisé ------------------------------------------
const shortPrices = [
  { date: '2024-01-02', close: 10000 },
  { date: '2024-01-15', close: 11000 },
];
r = simulateInvestment(1_000_000, '2024-01-01', shortPrices);
assert.ok(r);
assert.equal(r.annualizedReturnPct, null);

console.log('✅ simulate.test.mjs : tous les tests passent');

import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDailyRow, computeLiquidity } from './liquidity.ts';

test('fromDailyRow mappe une ligne liquidity_daily en LiquidityScore enrichi', () => {
  const s = fromDailyRow({
    code: 'SNTS', date_marche: '2026-07-17', score: 82, classe: 'A',
    presence_pct: 96.67, activite: 0.91, amihud: 0.02, spread_roll_pct: 0.6,
    valeur_moyenne_30j: 45_000_000, seances_traitees: 29, seances_marche: 30,
    volume_achat: 3000, volume_vente: 1000, volume_neutre: 500, flux_net_pct: 50,
  });
  assert.equal(s.score, 82);
  assert.equal(s.classe, 'A');
  assert.equal(s.label, 'Très liquide');
  assert.equal(s.presencePct, 97);
  assert.equal(s.v2.spread_roll_pct, 0.6);
  assert.equal(s.v2.flux_net_pct, 50);
});

test('fromDailyRow score null (données insuffisantes) → null', () => {
  assert.equal(fromDailyRow({ score: null, classe: null, presence_pct: 0, valeur_moyenne_30j: 0, seances_traitees: 0, seances_marche: 5 }), null);
});

test('computeLiquidity legacy reste intact (fallback)', () => {
  const rows = Array.from({ length: 20 }, () => ({ volume: 100, cours_jour: 5000, valeur_echangee: 500_000 }));
  const s = computeLiquidity(rows, 30);
  assert.ok(s && s.score > 0);
});

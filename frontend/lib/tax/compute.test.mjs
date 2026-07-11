// Tests fiscalité. Exécuter : cd frontend && npx tsx lib/tax/compute.test.mjs
import assert from 'node:assert';
import { dividendeNet, couponNet, rendementNet } from './compute.ts';

const T = (taux) => ({ taux, source: 'fixture', sourceUrl: null, verifieLe: '2026-01-01' });
const FIXTURE = {
  CI: { dividende_cote: T(0.10), obligation_etat: T(0), obligation_privee: T(0.06) },
  SN: { dividende_cote: T(null), obligation_etat: T(null), obligation_privee: T(null) },
};

// Dividende : 100 000 brut à 10 % → 90 000 net, 10 000 d'impôt.
let r = dividendeNet(100_000, 'CI', FIXTURE);
assert.equal(r.indisponible, undefined);
assert.equal(r.net, 90_000);
assert.equal(r.impot, 10_000);
assert.equal(r.taux, 0.10);

// Taux 0 (exonéré) est un taux VALIDE, pas « indisponible ».
r = couponNet(50_000, 'CI', 'obligation_etat', FIXTURE);
assert.equal(r.indisponible, undefined);
assert.equal(r.net, 50_000);
assert.equal(r.impot, 0);

// Taux null → indisponible (jamais de calcul silencieux).
r = dividendeNet(100_000, 'SN', FIXTURE);
assert.equal(r.indisponible, true);
assert.equal(r.raison, 'taux_non_confirme');

// Pays hors barème → indisponible.
r = dividendeNet(100_000, 'XX', FIXTURE);
assert.equal(r.indisponible, true);
assert.equal(r.raison, 'pays_inconnu');

// Arrondi FCFA entier + conservation du brut.
r = dividendeNet(33_333, 'CI', FIXTURE);
assert.equal(r.net, 30_000);
assert.equal(r.impot, 3_333);
assert.equal(r.net + r.impot, 33_333);

// Rendement net : 8 % brut à 10 % d'IRVM → 7.2 %.
const y = rendementNet(8, 'CI', 'dividende_cote', FIXTURE);
assert.equal(y.indisponible, undefined);
assert.ok(Math.abs(y.valeur - 7.2) < 1e-9);

// Rendement : taux non confirmé → indisponible.
const y2 = rendementNet(8, 'SN', 'dividende_cote', FIXTURE);
assert.equal(y2.indisponible, true);

console.log('✓ compute.test.mjs : tous les tests passent');

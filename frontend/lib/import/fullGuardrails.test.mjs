import assert from 'node:assert';
import { checkStatement } from './fullGuardrails.ts';

const base = {
  revenu_total: 42_454_000_000, total_actifs: 49_140_000_000, total_passif: 49_140_000_000,
  resultat_net: null, resultat_avant_impots: null, impots: null,
  benefice_par_action: null, actions_en_circulation: null,
  marge_brute: null, cout_ventes: null,
  total_capitaux_propres: 17_770_000_000, passif_non_courant: 942_000_000,
};

// Passif réconcilié (CP + PNC + PC ≈ total) -> OK
const ok = checkStatement({ ...base, passif_courant: 30_424_000_000 }, false);
assert.equal(ok.ok, true, `attendu ok, reasons: ${ok.reasons.join(', ')}`);

// Découverts oubliés : passif_courant = passif circulant seul (11 888 M) -> sous-totaux trop bas
const bad = checkStatement({ ...base, passif_courant: 11_888_000_000 }, false);
assert.equal(bad.ok, false, 'attendu rejet quand la trésorerie passif manque');
assert.ok(
  bad.reasons.some((r) => r.includes('réconcilient')),
  `attendu raison de réconciliation, eu: ${bad.reasons.join(', ')}`,
);

console.log('✓ fullGuardrails reconciliation tests OK');

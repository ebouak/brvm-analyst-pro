import assert from 'node:assert';
import { checkStatement, checkDeviseFcfa, checkResultatNetCoherence } from './fullGuardrails.ts';

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

// --- Devise + cohérence inter-tables (régression ETIT 2022-2025) ---

assert.equal(checkDeviseFcfa('fcfa').ok, true);
assert.equal(checkDeviseFcfa(undefined).ok, true, 'extraction antérieure au champ : pas de rejet rétroactif');
const usd = checkDeviseFcfa('usd');
assert.equal(usd.ok, false, 'une extraction en USD doit être rejetée');
assert.ok(usd.reasons[0].includes('USD') || usd.reasons[0].includes('usd'));

// Cas réel ETIT 2025 : compte de résultat en FCFA, flux de trésorerie en USD.
// Rapport 345 523 000 000 / 594 122 000 = 581,6 = le taux USD/XOF de l'exercice.
const etit2025 = checkResultatNetCoherence(345_523_000_000, 594_122_000);
assert.equal(etit2025.ok, false, 'attendu rejet sur la divergence FCFA/USD');
assert.ok(
  etit2025.reasons[0].includes('581.6'),
  `attendu le rapport 581.6 dans la raison, eu: ${etit2025.reasons[0]}`,
);

// Cas nominal : les autres émetteurs ont un rapport de 1,0.
assert.equal(checkResultatNetCoherence(36_520_000_000, 36_520_000_000).ok, true);
// Écart légitime (intérêts minoritaires) sous la tolérance de 2 %.
assert.equal(checkResultatNetCoherence(10_101_000_000, 10_000_000_000).ok, true);
// Écart de 10 % : au-delà de la tolérance, on refuse de servir les deux ensemble.
assert.equal(checkResultatNetCoherence(10_000_000_000, 9_000_000_000).ok, false);
// Données manquantes : le contrôle ne doit pas bloquer.
assert.equal(checkResultatNetCoherence(null, 594_122_000).ok, true);
assert.equal(checkResultatNetCoherence(345_523_000_000, null).ok, true);

console.log('✓ fullGuardrails devise + cohérence inter-tables OK');

// Tests cascade états financiers. Exécuter : cd frontend && npx tsx lib/financials/statementRows.test.mjs
import assert from 'node:assert';
import {
  INCOME_ROWS,
  BALANCE_ROWS,
  getRowValue,
  visibleRows,
} from './statementRows.ts';
import { formatStatementValue } from './formatters.ts';

/* ── Une banque ne présente ni coût des ventes ni marge brute ─────────────── */
const bankKeys = INCOME_ROWS.banque.map((r) => r.key);
assert.ok(!bankKeys.includes('cout_ventes'), 'banque: coût des ventes ne doit pas figurer');
assert.ok(!bankKeys.includes('marge_brute'), 'banque: marge brute ne doit pas figurer');
assert.ok(!bankKeys.includes('depenses_rd'), 'banque: R&D ne doit pas figurer');
assert.ok(bankKeys.includes('pnb'), 'banque: le PNB doit figurer dans le compte de résultat');

// Le bilan bancaire ignore stocks/fournisseurs et intègre dépôts + crédits.
const bankBal = BALANCE_ROWS.banque.map((r) => r.key);
assert.ok(!bankBal.includes('stocks'), 'banque: pas de stocks');
assert.ok(!bankBal.includes('fournisseurs'), 'banque: pas de fournisseurs');
assert.ok(bankBal.includes('depots_clientele') && bankBal.includes('credits_clientele'));

/* ── Assurance : primes et provisions techniques intégrées ────────────────── */
const assurKeys = INCOME_ROWS.assurance.map((r) => r.key);
assert.ok(assurKeys.includes('primes_acquises') && assurKeys.includes('charges_sinistres'));
assert.ok(!assurKeys.includes('marge_brute'), 'assurance: pas de marge brute');
assert.ok(BALANCE_ROWS.assurance.map((r) => r.key).includes('provisions_techniques'));

/* ── Le général garde sa cascade industrielle ─────────────────────────────── */
assert.ok(INCOME_ROWS.general.map((r) => r.key).includes('marge_brute'));

/* ── getRowValue lit colonnes standard ET lignes_specifiques ──────────────── */
const s = {
  periode: '2025',
  resultat_net: 1000,
  lignes_specifiques: { pnb: 5000, coefficient_exploitation: 62.5 },
};
assert.equal(getRowValue({ key: 'resultat_net', label: 'RN' }, s), 1000);
assert.equal(getRowValue({ key: 'pnb', label: 'PNB', specific: true }, s), 5000);
assert.equal(getRowValue({ key: 'absent', label: 'x' }, s), null);
assert.equal(getRowValue({ key: 'k', label: 'S', section: true }, s), null);

/* ── visibleRows : masque les postes vides et les sections orphelines ─────── */
const rows = [
  { key: '__a__', label: 'ACTIF', section: true },
  { key: 'total_actifs', label: 'Total actifs' },
  { key: 'stocks', label: 'Stocks' }, // jamais renseigné
  { key: '__vide__', label: 'SECTION VIDE', section: true },
  { key: 'inexistant', label: 'Inexistant' },
];
const vis = visibleRows(rows, [{ periode: '2025', total_actifs: 42 }]);
assert.deepEqual(vis.map((r) => r.key), ['__a__', 'total_actifs']);

/* ── Unités : actions ≠ FCFA, BPA non abrégé ──────────────────────────────── */
assert.equal(formatStatementValue(45_200_000, 'count'), (45200000).toLocaleString('fr-FR'));
assert.ok(!formatStatementValue(45_200_000, 'count').includes('FCFA'));
// (assertion stricte remplacée par le regex ci-dessous — espaces insécables FR)
// BPA : montant exact suffixé FCFA, jamais abrégé (« 1 250 FCFA », pas « 1,3 K FCFA »).
const bpa = formatStatementValue(1250, 'perShare');
assert.ok(/^1.250 FCFA$/u.test(bpa.replace(/\s/gu, ' ')), `BPA mal formaté : ${bpa}`);
assert.ok(!bpa.includes('K'), 'BPA ne doit pas être abrégé en K');
assert.equal(formatStatementValue(62.5, 'pct'), '62,5 %');
assert.equal(formatStatementValue(null, 'xof'), '—');

console.log('✓ statementRows.test.mjs : tous les tests passent');

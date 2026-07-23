import assert from 'node:assert';
import {
  buildChartRows, planAxes, peutAjouter, normalizeRows, SERIES_CATALOG, DEFAULT_SELECTION,
} from './chartBuilder.ts';

// --- buildChartRows : cas réel CIEC (valeurs vérifiées Madis/Sika/Zone Bourse) ---
const income = [
  { periode: '2024', revenu_total: 263_294_000_000, resultat_exploitation: 16_591_000_000, resultat_net: 10_101_000_000, benefice_par_action: 180.38, dividende_par_action: 158.4 },
  { periode: '2023', revenu_total: 257_218_000_000, resultat_exploitation: 16_460_000_000, resultat_net: 10_633_000_000, benefice_par_action: 189.88, dividende_par_action: 171 },
];
const balance = [
  { periode: '2024', total_actifs: 2_019_136_000_000, total_capitaux_propres: 150_000_000_000, dette_court_terme: 10_000_000_000, dette_long_terme: 49_052_000_000 },
];
const cashflow = [
  { periode: '2024', flux_exploitation: 30_000_000_000, flux_investissement: -12_000_000_000, flux_financement: -8_000_000_000 },
];

const rows = buildChartRows(income, balance, cashflow);
assert.equal(rows.length, 2);
assert.equal(rows[0].periode, '2023', 'trié par période croissante même si l’entrée est décroissante');

const r24 = rows[1];
assert.equal(r24.revenu, 263_294_000_000);
assert.ok(Math.abs(r24.margeNette - 3.836) < 0.01, `marge nette 2024 ≈ 3,84 %, eu ${r24.margeNette}`);
assert.ok(Math.abs(r24.margeRex - 6.302) < 0.01, `marge d'exploitation ≈ 6,30 %, eu ${r24.margeRex}`);
assert.ok(Math.abs(r24.roe - 6.734) < 0.01, `ROE = RN/CP ≈ 6,73 %, eu ${r24.roe}`);
// Croissance CA 2024 vs 2023 : (263 294 − 257 218) / 257 218 = +2,36 % — le taux
// même que publie la fiche Madis, preuve que la dérivation est la bonne.
assert.ok(Math.abs(r24.croissanceCa - 2.3622) < 0.01, `croissance CA ≈ +2,36 %, eu ${r24.croissanceCa}`);
assert.equal(r24.dettesFin, 59_052_000_000, 'dettes = CT + LT');
assert.equal(r24.fluxInvestissement, -12_000_000_000);

// 2023 : pas de bilan ni de flux fournis, pas d'exercice précédent.
const r23 = rows[0];
assert.equal(r23.roe, null, 'ROE null sans capitaux propres — jamais inventé');
assert.equal(r23.croissanceCa, null, 'pas de croissance sans exercice précédent');
assert.equal(r23.dettesFin, null);
assert.ok(Math.abs(r23.margeNette - 4.134) < 0.01);

// Dénominateur nul -> null, pas Infinity.
const zero = buildChartRows(
  [{ periode: '2024', revenu_total: 0, resultat_exploitation: null, resultat_net: 5, benefice_par_action: null, dividende_par_action: null }],
  [], [],
);
assert.equal(zero[0].margeNette, null, 'CA nul -> marge null');

// --- planAxes : 2 classes max, dans l'ordre de sélection ---
assert.deepEqual(planAxes(['revenu', 'rn', 'margeNette']),
  { gauche: 'fcfa', droite: 'pct', refuses: [] },
  'sélection par défaut : montants à gauche, % à droite');

assert.deepEqual(planAxes(['bpa', 'dividende']),
  { gauche: 'fcfa_action', droite: null, refuses: [] });

// 3e classe refusée : montants + % déjà en place, le BPA ne rentre pas.
assert.deepEqual(planAxes(['revenu', 'margeNette', 'bpa']),
  { gauche: 'fcfa', droite: 'pct', refuses: ['bpa'] });

assert.deepEqual(planAxes([]), { gauche: null, droite: null, refuses: [] });

// --- peutAjouter pilote l'état des cases ---
assert.equal(peutAjouter(['revenu', 'margeNette'], 'bpa'), false, '3e classe -> case désactivée');
assert.equal(peutAjouter(['revenu', 'margeNette'], 'rn'), true, 'même classe que l’axe gauche -> ok');
assert.equal(peutAjouter(['revenu', 'margeNette'], 'roe'), true, 'même classe que l’axe droit -> ok');
assert.equal(peutAjouter(['revenu'], 'bpa'), true, 'axe droit libre -> ok');
assert.equal(peutAjouter([], 'margeNette'), true);
assert.equal(peutAjouter([], 'inconnu'), false);

// --- cohérence du catalogue ---
assert.equal(new Set(SERIES_CATALOG.map((s) => s.id)).size, SERIES_CATALOG.length, 'ids uniques');
for (const id of DEFAULT_SELECTION) {
  assert.ok(SERIES_CATALOG.some((s) => s.id === id), `défaut ${id} présent au catalogue`);
}
assert.deepEqual(planAxes(DEFAULT_SELECTION).refuses, [], 'la sélection par défaut tient sur 2 axes');
for (const s of SERIES_CATALOG) {
  assert.ok(s.unit !== 'fcfa' || s.render === 'bar', `montant ${s.id} en barres`);
  assert.ok(s.unit === 'fcfa' || s.render === 'line', `ratio/par-action ${s.id} en ligne`);
}

console.log('✓ chartBuilder OK');

// --- normalizeRows : base 100, leve la limite des unites ---

const serie = [
  { periode: '2022', revenu: 200_000_000_000, rn: 8_000_000_000, bpa: 100, margeNette: 4, rex: null, totalActif: null, capitauxPropres: null, dettesFin: null, fluxExploitation: null, fluxInvestissement: null, fluxFinancement: null, dividende: null, margeRex: null, roe: null, croissanceCa: null },
  { periode: '2023', revenu: 220_000_000_000, rn: 12_000_000_000, bpa: 150, margeNette: null, rex: null, totalActif: null, capitauxPropres: null, dettesFin: null, fluxExploitation: null, fluxInvestissement: null, fluxFinancement: null, dividende: null, margeRex: null, roe: null, croissanceCa: null },
];
const norm = normalizeRows(serie, ['revenu', 'rn', 'bpa']);
// 2022 = base 100 partout.
assert.equal(norm[0].revenu, 100);
assert.equal(norm[0].rn, 100);
assert.equal(norm[0].bpa, 100);
// 2023 = indice relatif : CA 220/200 = 110, RN 12/8 = 150, BPA 150/100 = 150.
const proche = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `attendu ${b}, eu ${a}`);
proche(norm[1].revenu, 110);
proche(norm[1].rn, 150);
proche(norm[1].bpa, 150);
// Une serie non selectionnee garde sa valeur d'origine (seules les series
// tracees sont rebasees ; les autres ne sont de toute facon pas rendues).
assert.equal(norm[0].margeNette, 4, 'serie non selectionnee inchangee');
assert.notEqual(norm[0].revenu, serie[0].revenu, 'serie selectionnee bien rebasee');

// Base negative (perte de depart) : le sens de variation est conserve.
const perte = [
  { periode: '2022', rn: -4_000_000_000, revenu: null, bpa: null, margeNette: null, rex: null, totalActif: null, capitauxPropres: null, dettesFin: null, fluxExploitation: null, fluxInvestissement: null, fluxFinancement: null, dividende: null, margeRex: null, roe: null, croissanceCa: null },
  { periode: '2023', rn: 2_000_000_000, revenu: null, bpa: null, margeNette: null, rex: null, totalActif: null, capitauxPropres: null, dettesFin: null, fluxExploitation: null, fluxInvestissement: null, fluxFinancement: null, dividende: null, margeRex: null, roe: null, croissanceCa: null },
];
const np = normalizeRows(perte, ['rn']);
assert.equal(np[0].rn, -100, 'perte de depart -> -100');
assert.equal(np[1].rn, 50, 'retour a +2 Md sur base |4 Md| = +50');

// Serie entierement nulle : reste nulle, pas de division par zero.
const vide = normalizeRows(serie, ['roe']);
assert.equal(vide[0].roe, null);
assert.equal(vide[1].roe, null);

console.log('✓ chartBuilder normalisation OK');

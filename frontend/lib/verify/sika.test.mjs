import assert from 'node:assert';
import { parseNombreSika, parseSikaTable, comparerASika, suffixesSika } from './sika.ts';

// --- parseNombreSika : format français de Sika ---
assert.equal(parseNombreSika('197 630'), 197630, 'espace insécable comme séparateur de milliers');
assert.equal(parseNombreSika('1 236,34'), 1236.34, 'virgule décimale');
assert.equal(parseNombreSika('-11,37%'), -11.37, 'pourcentage signé');
assert.equal(parseNombreSika('15 509'), 15509);
assert.equal(parseNombreSika(''), null);
assert.equal(parseNombreSika('-'), null);
assert.equal(parseNombreSika('ND'), null);
assert.equal(parseNombreSika('n/a'), null, 'texte non numérique -> null, jamais NaN');

// --- parseSikaTable : tableau réel de PALC relevé sur la fiche Sika ---
const palc = parseSikaTable([
  ['', '2021', '2022', '2023', '2024', '2025'],
  ["Chiffre d'affaires", '195 659', '232 713', '206 244', '172 183', '197 630'],
  ['Croissance CA', '', '18,94%', '-11,37%', '-16,52%', '14,78%'],
  ['Résultat net', '42 473', '41 693', '19 352', '15 862', '15 509'],
  ['Croissance RN', '', '-1,84%', '-53,58%', '-18,04%', '-2,23%'],
  ['BNPA', '2 747,41', '2 696,96', '1 252,00', '1 026,00', '1 003,00'],
  ['PER', '3,22', '3,28', '7,07', '8,63', '8,82'],
  ['Dividende', '1 236,34', '1 213,63', '563,00', '451,00', '441,40'],
]);
assert.equal(palc.length, 5, '5 exercices');
const p2025 = palc.find((y) => y.annee === '2025');
assert.equal(p2025.chiffreAffaires, 197_630_000_000, 'CA converti des millions en FCFA bruts');
assert.equal(p2025.resultatNet, 15_509_000_000);
assert.equal(p2025.bnpa, 1003, 'le BNPA est par action : jamais converti');
assert.equal(p2025.dividende, 441.4, 'le dividende est par action : jamais converti');
// « Croissance CA » ne doit pas être confondu avec « Chiffre d'affaires ».
assert.equal(palc.find((y) => y.annee === '2022').chiffreAffaires, 232_713_000_000);

// Accents et casse ne doivent pas casser l'appariement.
const sansAccent = parseSikaTable([
  ['', '2025'],
  ['CHIFFRE D AFFAIRES', '100'],
  ['Resultat Net', '10'],
]);
assert.equal(sansAccent[0].resultatNet, 10_000_000, 'libellé sans accent apparié');

assert.deepEqual(parseSikaTable([]), [], 'tableau vide -> série vide');

// --- comparerASika ---
// PALC : notre base colle à Sika à l'arrondi près -> aucun écart signalé.
const aucun = comparerASika('PALC',
  [{ periode: '2025', revenu_total: 197_629_996_000, resultat_net: 15_508_655_000 }], palc);
assert.deepEqual(aucun, [], `arrondi au million ne doit pas alerter, eu: ${JSON.stringify(aucun)}`);

// CFAC : cas réel où l'extraction lisait les comptes sociaux.
const cfacSika = parseSikaTable([
  ['', '2025'],
  ["Chiffre d'affaires", '180 545'],
  ['Résultat net', '8 416'],
]);
const cfac = comparerASika('CFAC',
  [{ periode: '2025', revenu_total: 81_126_957_415, resultat_net: 2_367_384_402 }], cfacSika);
assert.equal(cfac.length, 2, 'CA et résultat net doivent tous deux alerter');
assert.ok(cfac.every((e) => e.ecartPct > 50), `écarts massifs attendus, eu: ${JSON.stringify(cfac)}`);
assert.equal(cfac[0].code, 'CFAC');

// Année absente chez Sika : ignorée, pas signalée comme écart.
assert.deepEqual(
  comparerASika('X', [{ periode: '2019', revenu_total: 1, resultat_net: 1 }], palc), [],
);
// Valeurs manquantes : jamais d'alerte ni de division par zéro.
assert.deepEqual(
  comparerASika('X', [{ periode: '2025', revenu_total: null, resultat_net: null }], palc), [],
);

// --- suffixesSika ---
assert.equal(suffixesSika('PALC')[0], 'ci');
assert.equal(suffixesSika('ETIT')[0], 'tg');
assert.equal(suffixesSika('BOABF')[0], 'bf', 'BF prime sur la lettre finale F');
assert.equal(suffixesSika('SNTS')[0], 'sn');
assert.equal(suffixesSika('BOAM')[0], 'ml');
assert.equal(suffixesSika('BOAN')[0], 'ne');
assert.equal(suffixesSika('LNBB')[0], 'bj');
assert.equal(new Set(suffixesSika('PALC')).size, 7, 'les 7 pays, sans doublon');

console.log('✓ verify/sika OK');

// --- Arrondi Sika au million : ne doit pas produire de faux positifs ---
// BNBC 2024 : notre 7 313 440 FCFA, Sika affiche « 7 » (million). 4,5 % d'écart
// relatif apparent, mais 313 440 FCFA en absolu — les deux chiffres concordent.
const bnbc = parseSikaTable([['', '2024'], ['Résultat net', '7']]);
assert.deepEqual(
  comparerASika('BNBC', [{ periode: '2024', revenu_total: null, resultat_net: 7_313_440 }], bnbc),
  [],
  'l’arrondi au million de Sika ne doit pas alerter sur les petites sociétés',
);
// Au-delà d'un demi-million ET de 1 %, l'écart reste signalé.
const gros = parseSikaTable([['', '2024'], ['Résultat net', '10']]);
assert.equal(
  comparerASika('X', [{ periode: '2024', revenu_total: null, resultat_net: 12_000_000 }], gros).length,
  1,
  'un écart réel de 2 M doit rester signalé',
);

console.log('✓ verify/sika tolérance arrondi OK');

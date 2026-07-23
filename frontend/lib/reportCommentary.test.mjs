import assert from 'node:assert';
import { sectorCommentary, eventCommentary, mediane } from './reportCommentary.ts';

// --- mediane ---
assert.equal(mediane([]), null);
assert.equal(mediane([5]), 5);
assert.equal(mediane([1, 2, 3]), 2);
assert.equal(mediane([1, 2, 3, 4]), 2.5);
assert.equal(mediane([3, 1, 2]), 2, 'doit trier avant de médianer');

// --- secteur : cas réel « Services financiers » de la capture ---
// 16 titres, moyenne +35,89 %, dispersion 39,16 %, ETIT +125,8 %, ORGT −21,5 %.
const perfsFin = [125.8, 104.5, 92.3, 48.3, 42.4, 31.3, 25.9, 23.3, 21.3, 18, 12, 8, 5, 2, -8, -21.5];
const fin = sectorCommentary({
  periodeLabel: '3 mois',
  perfs: perfsFin,
  nbTitresTotal: 16,
  averagePerf: 33.16,
  dispersion: 39.16,
  best: { code: 'ETIT', perf: 125.8 },
  worst: { code: 'ORGT', perf: -21.5 },
  nbEvenements: 0,
});
assert.ok(fin.length >= 3, `attendu au moins 3 constats, eu ${fin.length}`);
assert.ok(fin[0].includes('14 titres en hausse et 2 en baisse'), `ampleur attendue, eu: ${fin[0]}`);
// La moyenne (33,16) dépasse largement la médiane (22,3) -> le constat doit le dire.
assert.ok(
  fin.some((c) => c.includes('tirée vers le haut') && c.includes('médiane')),
  `attendu le constat moyenne/médiane, eu: ${fin.join(' | ')}`,
);
// Dispersion (39,16) > moyenne (33,16) -> sélection de titres.
assert.ok(
  fin.some((c) => c.includes('n’évoluent pas en bloc')),
  `attendu la lecture de dispersion, eu: ${fin.join(' | ')}`,
);
// Amplitude ETIT/ORGT = 147,3 points.
assert.ok(fin.some((c) => c.includes('147,3 points')), `amplitude attendue, eu: ${fin.join(' | ')}`);
// Typographie française : virgule décimale, pas de point.
assert.ok(!fin.join(' ').match(/\d\.\d/), 'aucun point décimal ne doit subsister');

// --- secteur : mouvement homogène et groupé ---
const homogene = sectorCommentary({
  periodeLabel: '1 mois',
  perfs: [4, 5, 6, 5.5],
  nbTitresTotal: 4,
  averagePerf: 5.125,
  dispersion: 0.7,
  best: { code: 'AAA', perf: 6 },
  worst: { code: 'BBB', perf: 4 },
  nbEvenements: 0,
});
assert.ok(homogene[0].includes('quasi générale'), `4/4 en hausse, eu: ${homogene[0]}`);
assert.ok(homogene.some((c) => c.includes('sont proches')), 'moyenne ≈ médiane');
assert.ok(homogene.some((c) => c.includes('comme un bloc')), 'dispersion < moyenne');

// --- secteur : couverture partielle signalée ---
const partiel = sectorCommentary({
  periodeLabel: '3 mois',
  perfs: [10, -5],
  nbTitresTotal: 6,
  averagePerf: 2.5,
  dispersion: 7.5,
  best: { code: 'AAA', perf: 10 },
  worst: { code: 'BBB', perf: -5 },
  nbEvenements: 2,
});
assert.ok(
  partiel.some((c) => c.includes('4 titres') && c.includes('exclus')),
  `attendu le signalement des titres exclus, eu: ${partiel.join(' | ')}`,
);
assert.ok(
  partiel.some((c) => c.includes('aucun lien de cause à effet')),
  'les événements ne doivent pas être présentés comme explicatifs',
);

// --- secteur : aucune donnée ---
const vide = sectorCommentary({
  periodeLabel: '1 semaine', perfs: [], nbTitresTotal: 3,
  averagePerf: null, dispersion: null, best: null, worst: null, nbEvenements: 0,
});
assert.equal(vide.length, 1);
assert.ok(vide[0].includes('historique suffisant'));

// --- événement ---
const ev = eventCommentary({
  impacts: [
    { code: 'AAA', rendementAnormalPct: 2.5 },
    { code: 'BBB', rendementAnormalPct: -1.2 },
    { code: 'CCC', rendementAnormalPct: -4.8 },
    { code: 'DDD', rendementAnormalPct: null },
  ],
  nbTitresLies: 4,
  fenetreSeances: 5,
});
assert.ok(ev[0].includes('3 titres liés') && ev[0].includes('1 a fait mieux'), `eu: ${ev[0]}`);
assert.ok(ev[0].includes('5 séances'), `la fenêtre doit être explicite, eu: ${ev[0]}`);
assert.ok(ev[1].includes('CCC'), `le plus marqué en valeur absolue est CCC, eu: ${ev[1]}`);
assert.ok(ev.some((c) => c.includes('1 titre lié') && c.includes('sans historique')), `eu: ${ev.join(' | ')}`);
assert.ok(
  ev[ev.length - 1].includes('ne lui sont pas attribués'),
  'la non-causalité doit être explicite',
);

const evVide = eventCommentary({
  impacts: [{ code: 'AAA', rendementAnormalPct: null }], nbTitresLies: 1, fenetreSeances: 5,
});
assert.equal(evVide.length, 1);
assert.ok(evVide[0].includes('Aucun rendement'));

console.log('✓ reportCommentary OK');

import assert from 'node:assert/strict';
import test from 'node:test';
import { construireNarratif } from './narratif.ts';
import { construireSquelette, validerProse, extraireNombres, empreinteDe } from './prose.ts';

/**
 * La prose est le seul endroit du dossier où un modèle de langage écrit. Ces
 * tests fixent ce qu'il a le droit de faire : reformuler. Rien d'autre.
 *
 * Lancer : npx tsx --test lib/dossier/prose.test.mjs
 */

function dossierNeic() {
  return {
    genere_le: '2026-09-14',
    identite: { code: 'NEIC', designation: 'NEI CEDA CI', secteur: null, pays: 'CI', actions: 12_765_825, flottant: null,
      notation: { note: 'A-', agence: 'BloomField Investment', long_terme: null, court_terme: null, perspective: 'Stable', date_notation: '2025-12-01', annees_stables: 3 } },
    chiffres_cles: { exercice: '2025', cours: 2750, date_cours: '2026-09-11', variation_veille_pct: -2.65, capitalisation: null,
      chiffre_affaires: 5_142_000_000, resultat_net: 2_036_000_000, capitaux_propres: null, dette: null,
      croissance_ca_1an: -0.238, croissance_ca_2ans: -0.397, variation_capitaux_propres_1an: 0.58 },
    trajectoire: [],
    dividende: { montant: 140.4, base_fiscale: 'net', source: 'richbourse', exercice: 2025, ex_date: '2026-09-09', payment_date: null,
      rendement: 0.0511, payout: 0.88, historique: [], exercices_sans_dividende: 2 },
    detachement: { ex_date: '2026-09-09', dividende: 140.4, cours_veille: 2980, cours_ex: 2630, baisse_fcfa: 350, part_expliquee: 0.401, recul_hors_dividende: -0.0738 },
    technique: { date_signal: '2026-09-11', signal: 'HOLD', score_total: 0.01, confiance: 0.6, explication: null, rsi: 54.4, ma20: null, ma50: null, macd_line: 140.28, macd_signal: 167.69,
      serie: [{ date: '2026-09-11', cours: 2750, volume: 1925 }] },
    ratios: { bpa: 159.54, per: 17.24, pb: 6.1, ps: 6.83, capitalisation: null, roe: 0.354, roa: 0.348, margeNette: 0.396, gearing: 0.017, rendementDiv: 0.0511, payout: 0.88 },
    qualite_resultat: { periode: '2025', resultat_exploitation: 1_213_000_000, resultat_avant_impots: 2_467_000_000, resultat_net: 2_036_000_000, marge_exploitation: 0.24, part_non_operationnelle: 0.508 },
    niveaux: { resistance: 3000, support: 2180, dernier: 2750, cassureHaut: false, cassureBas: false, objectif1: 3410, objectif2: 3820, objectifBas1: 1770, objectifBas2: 1360, invalidation: 1975 },
    lacunes: ['Le taux de distribution rapporte un dividende NET à un bénéfice par action brut.'],
  };
}

function squeletteNeic() {
  const d = dossierNeic();
  return construireSquelette(d, construireNarratif(d));
}

test('aucun `fait` ne contient de chiffre : la prose est sans chiffre à la source', () => {
  const n = construireNarratif(dossierNeic());
  for (const a of [...n.forces, ...n.risques]) {
    assert.doesNotMatch(a.fait, /\d/, `chiffre dans le fait : ${a.fait}`);
  }
});

test('le squelette ne porte que les numéros de panneaux et l’année d’exercice', () => {
  const sq = squeletteNeic();
  assert.deepEqual([...sq.chiffres].sort((a, b) => a - b), [10, 11, 12, 2025]);
  const texte = sq.sections.map((s) => s.texte).join(' ');
  assert.ok(!texte.includes('2750') && !texte.includes('5,11') && !texte.includes('1 925'), 'cours, rendement, volume doivent rester aux panneaux');
});

test('le squelette passe son propre contrôle', () => {
  const sq = squeletteNeic();
  assert.deepEqual(validerProse(sq.sections, sq), sq.sections);
});

test('le squelette cite chaque force et chaque risque, et les panneaux 10, 11, 12', () => {
  const d = dossierNeic();
  const n = construireNarratif(d);
  const lecture = construireSquelette(d, n).sections[0].texte;
  for (const a of [...n.forces, ...n.risques]) assert.ok(lecture.includes(a.fait), `manque : ${a.fait}`);
  assert.match(lecture, /panneau 10/);
  assert.match(lecture, /panneau 11/);
  assert.match(lecture, /panneau 12/);
});

test('une reformulation fidèle est acceptée', () => {
  const sq = squeletteNeic();
  const candidate = [
    { titre: sq.sections[0].titre, texte: "Sur l'exercice 2025, NEI CEDA CI présente un exercice bénéficiaire, une rentabilité élevée et un endettement faible (panneau 10) ; en regard, un bénéfice majoritairement non opérationnel et une liquidité faible appellent la vigilance (panneau 11). Les réserves sont au panneau 12." },
    { titre: sq.sections[1].titre, texte: 'Le canal des vingt dernières séances encadre le cours entre support et résistance. La dernière clôture est à l’intérieur. Les niveaux décrivent la géométrie du canal, pas une prévision ; les valeurs sont dans le tableau.' },
  ];
  assert.ok(validerProse(candidate, sq));
});

test('un chiffre inventé (le cours, le rendement) fait rejeter la sortie', () => {
  const sq = squeletteNeic();
  const base = validerProse(sq.sections, sq);
  const avecCours = [{ ...base[0], texte: base[0].texte + ' Le cours est de 2 750 FCFA.' }, base[1]];
  assert.equal(validerProse(avecCours, sq), null);
  const avecRendement = [{ ...base[0], texte: base[0].texte + ' Le rendement atteint 5,11 %.' }, base[1]];
  assert.equal(validerProse(avecRendement, sq), null);
});

test('une affirmation causale fait rejeter la sortie', () => {
  const sq = squeletteNeic();
  const base = validerProse(sq.sections, sq);
  const causal = [base[0], { ...base[1], texte: base[1].texte + ' Le recul est dû à la baisse du dividende.' }];
  assert.equal(validerProse(causal, sq), null);
});

test('titres modifiés, section manquante ou texte trop court : rejet', () => {
  const sq = squeletteNeic();
  const base = validerProse(sq.sections, sq);
  assert.equal(validerProse([{ ...base[0], titre: 'Synthèse' }, base[1]], sq), null);
  assert.equal(validerProse([base[0]], sq), null);
  assert.equal(validerProse([base[0], { ...base[1], texte: 'Trop court.' }], sq), null);
  assert.equal(validerProse('pas un tableau', sq), null);
});

test('l’empreinte change quand une force apparaît ou disparaît', () => {
  const d1 = dossierNeic();
  const d2 = dossierNeic();
  d2.technique.serie[0].volume = 50_000; // la liquidité n'est plus faible
  const e1 = construireSquelette(d1, construireNarratif(d1)).empreinte;
  const e2 = construireSquelette(d2, construireNarratif(d2)).empreinte;
  assert.notEqual(e1, e2);
  assert.equal(e1, empreinteDe(construireSquelette(d1, construireNarratif(d1)).sections));
});

test('sans canal, la section scénarios le dit et ne cite aucun niveau', () => {
  const d = dossierNeic();
  d.niveaux = null;
  const sq = construireSquelette(d, construireNarratif(d));
  assert.match(sq.sections[1].texte, /aucun canal/);
  assert.doesNotMatch(sq.sections[1].texte, /\d/);
});

test('extraireNombres recolle les milliers et lit la virgule décimale', () => {
  assert.deepEqual(extraireNombres('2 750 FCFA, 5,11 % et 12'), [2750, 5.11, 12]);
});

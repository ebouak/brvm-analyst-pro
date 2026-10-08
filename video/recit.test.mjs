// node --test video/  — tests du récit de la vidéo de séance (module pur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELES, rangOuvre, choisirModele, dit, montantDit, proportionDite, nomDit,
  faitsIndice, angles, composerRecit, chiffresAutorises, chiffresEtrangers, dateDite,
} from './recit.mjs';

const NOMS = [
  'BANK OF AFRICA NIGER', 'BANK OF AFRICA SENEGAL', 'SONATEL SENEGAL', 'ECOBANK COTE D\'IVOIRE',
  'Ecobank Transnational Incorporated TOGO', 'LOTERIE NATIONALE DU BENIN', 'TRACTAFRIC MOTORS COTE D\'IVOIRE',
  'ONATEL BURKINA FASO', 'TOTALENERGIES MARKETING COTE D\'IVOIRE', 'TOTALENERGIES MARKETING SENEGAL',
  'SOCIETE GENERALE COTE D\'IVOIRE', 'BANQUE INTERNATIONALE POUR L’INDUSTRIE ET LE COMMERCE DU BENIN', 'CIE COTE D\'IVOIRE',
];

/** Séance de synthèse (valeurs inventées pour le test, pas de la production). */
function seance(sur = {}) {
  const historique = Array.from({ length: 20 }, (_, i) => ({
    date: i === 19 ? '2026-10-07' : `2026-09-${String(i + 1).padStart(2, '0')}`,
    valeur: 500 + (i % 2 ? 1 : -1) * 0.5,
  }));
  historique[5].valeur = 510; // un écart antérieur plus fort : la séance n'est PAS un record
  historique[19].valeur = historique[18].valeur * 1.0056;
  return {
    seance: '2026-10-07',
    composite: { valeur: historique[19].valeur, variation_pct: 0.56 },
    hausses: 23, baisses: 15, stables: 10, valeurs: 48,
    capitaux: 2.72e9, estime: false, partB: 47.4,
    lourde: { code: 'SNTS', designation: 'SONATEL SENEGAL', part_pct: 35.2, variation_pct: -0.02 },
    meilleures: [{ code: 'PRSC', designation: 'TRACTAFRIC MOTORS COTE D\'IVOIRE', variation_pct: 4.96 }],
    pires: [{ code: 'ONTBF', designation: 'ONATEL BURKINA FASO', variation_pct: -5.94 }],
    secteurs: [{ secteur: 'Services financiers', valeurs: 17, hausses: 10, part_pct: 42.8 }],
    historique,
    designations: NOMS,
    ...sur,
  };
}

test('rotation : deux séances consécutives n’ont jamais le même modèle, week-end compris', () => {
  assert.equal(rangOuvre('2026-10-12') - rangOuvre('2026-10-09'), 1, 'vendredi → lundi = +1');
  const jours = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'];
  for (let i = 1; i < jours.length; i++) {
    assert.notEqual(choisirModele(jours[i]), choisirModele(jours[i - 1]), `${jours[i - 1]} → ${jours[i]}`);
  }
  // un jour férié en semaine (saut de 2 rangs) ne doit pas non plus répéter
  assert.notEqual(choisirModele('2026-10-09'), choisirModele('2026-10-13'));
  assert.deepEqual(new Set(jours.map((j) => choisirModele(j))), new Set(MODELES));
});

test('rotation : un modèle forcé l’emporte, un modèle inconnu est ignoré', () => {
  assert.equal(choisirModele('2026-10-07', 'papier'), 'papier');
  assert.equal(choisirModele('2026-10-07', 'inconnu'), choisirModele('2026-10-07'));
});

test('nombres dits : virgule en lettres, zéros de queue retirés, valeur absolue', () => {
  assert.equal(dit(4.96), '4 virgule 96');
  assert.equal(dit(-5.9), '5 virgule 9');
  assert.equal(dit(0.5), '0 virgule 5');
  assert.equal(dit(547.91), '547 virgule 91');
  assert.equal(dit(12), '12');
  assert.equal(montantDit(2.72e9), '2 virgule 72 milliards');
  assert.equal(montantDit(850.4e6), '850 millions');
});

test('proportions : repère dit quand il est proche, chiffre exact sinon', () => {
  assert.equal(proportionDite(47.4), 'près de la moitié');
  assert.equal(proportionDite(35.2), 'un peu plus d’un tiers');
  assert.equal(proportionDite(50.3), 'environ la moitié');
  assert.equal(proportionDite(66.5), 'environ les deux tiers');
  assert.equal(proportionDite(66), 'près des deux tiers');
  assert.equal(proportionDite(42.8), '42 virgule 8 pour cent');
});

test('noms dits : pays retiré, sauf s’il départage ou fait partie du nom', () => {
  assert.equal(nomDit('SONATEL SENEGAL', NOMS), 'Sonatel');
  assert.equal(nomDit('ONATEL BURKINA FASO', NOMS), 'Onatel');
  assert.equal(nomDit('BANK OF AFRICA SENEGAL', NOMS), 'Bank of Africa Sénégal');
  assert.equal(nomDit('ECOBANK COTE D\'IVOIRE', NOMS), 'Ecobank Côte d\'Ivoire', 'ne pas confondre avec le groupe ETI');
  assert.equal(nomDit('TOTALENERGIES MARKETING SENEGAL', NOMS), 'TotalEnergies Marketing Sénégal');
  assert.equal(nomDit('LOTERIE NATIONALE DU BENIN', NOMS), 'Loterie Nationale du Bénin');
  assert.equal(nomDit('SOCIETE GENERALE COTE D\'IVOIRE', NOMS), 'Société Générale');
  assert.equal(nomDit('CIE COTE D\'IVOIRE', NOMS), 'CIE');
  assert.equal(nomDit('BANQUE INTERNATIONALE POUR L’INDUSTRIE ET LE COMMERCE DU BENIN', NOMS),
    'Banque Internationale pour l\'Industrie et le Commerce du Bénin');
});

test('faits de l’indice : rien si la dernière date n’est pas la séance ou si le sens contredit', () => {
  const d = seance();
  assert.ok(faitsIndice(d.historique, d.seance, 0.56));
  assert.equal(faitsIndice(d.historique, '2026-10-08', 0.56), null, 'séance absente de l’historique');
  assert.equal(faitsIndice(d.historique, d.seance, -0.56), null, 'sens contraire à la variation publiée');
  assert.equal(faitsIndice(d.historique.slice(0, 3), d.seance, 0.56), null, 'trop court');
});

test('faits de l’indice : série et plus forte variation mesurées sur la fenêtre', () => {
  const h = Array.from({ length: 20 }, (_, i) => ({ date: `d${i}`, valeur: 100 + i * 0.1 }));
  h[19] = { date: 'S', valeur: h[18].valeur + 2 };
  const f = faitsIndice(h, 'S', 1.9);
  assert.equal(f.serie, 19);
  assert.equal(f.serie_plafonnee, true, 'toute la fenêtre monte : la série réelle est peut-être plus longue');
  assert.equal(f.record, true);
  // une série plafonnée n'est jamais annoncée avec un ordinal (elle pourrait être plus longue)
  const a = angles(seance({ historique: h, seance: 'S', composite: { valeur: h[19].valeur, variation_pct: 1.9 } }), f);
  assert.ok(!a.some((x) => x.id === 'serie'));
  assert.equal(a[0].id, 'record');
});

test('angle : l’indice monte mais la majorité recule → divergence en tête, scène largeur en premier', () => {
  const r = composerRecit(seance({ hausses: 12, baisses: 26, stables: 10, lourde: { code: 'SNTS', designation: 'SONATEL SENEGAL', part_pct: 20, variation_pct: 1 } }), { modele: 'nuit' });
  assert.equal(r.angle, 'divergence');
  assert.equal(r.temps[1].type, 'largeur');
  assert.match(r.temps[0].texte, /majorité des valeurs recule/);
});

test('angle : une valeur à plus d’un tiers des échanges ouvre la vidéo', () => {
  const r = composerRecit(seance(), { modele: 'papier' });
  assert.equal(r.angle, 'concentration');
  assert.equal(r.temps[1].type, 'lourde');
  assert.match(r.temps[1].texte, /Sonatel/);
  assert.match(r.temps[1].texte, /un peu plus d’un tiers/);
});

test('composition : ouverture d’abord, fin ensuite, chaque modèle a son propre déroulé', () => {
  const ordres = MODELES.map((m) => composerRecit(seance(), { modele: m }).temps.map((t) => t.type));
  for (const o of ordres) {
    assert.equal(o[0], 'ouverture');
    assert.equal(o[o.length - 1], 'fin');
  }
  assert.equal(new Set(ordres.map((o) => o.join())).size, MODELES.length, 'trois déroulés distincts');
});

test('composition : déterministe — même séance, même texte', () => {
  assert.equal(composerRecit(seance()).texte, composerRecit(seance()).texte);
});

test('composition : la date dite porte le jour de la semaine', () => {
  assert.equal(dateDite('2026-10-07'), 'mercredi 7 octobre');
  assert.equal(dateDite('2026-10-01'), 'jeudi 1er octobre');
});

test('composition : capitaux estimés → « environ », jamais un montant présenté comme exact', () => {
  const r = composerRecit(seance({ estime: true }), { modele: 'nuit' });
  assert.match(r.temps.find((t) => t.type === 'capitaux').texte, /^Environ 2 virgule 72 milliards/);
});

test('composition : sans valeur en hausse, le palmarès ne cite que la baisse', () => {
  const r = composerRecit(seance({ meilleures: [] }), { modele: 'nuit' });
  const p = r.temps.find((t) => t.type === 'palmares').texte;
  assert.doesNotMatch(p, /hausse|En tête/);
  assert.match(p, /Onatel/);
});

test('accords : une seule valeur au singulier', () => {
  const r = composerRecit(seance({ hausses: 1, baisses: 1, stables: 1, valeurs: 3 }), { modele: 'mosaique' });
  const l = r.temps.find((t) => t.type === 'largeur').texte;
  assert.doesNotMatch(l, /1 valeurs|1 hausses|1 baisses/);
});

test('garde-fou : aucun chiffre étranger dans les trois modèles, et un intrus est bien détecté', () => {
  for (const m of MODELES) {
    const d = seance();
    const r = composerRecit(d, { modele: m });
    assert.deepEqual(chiffresEtrangers(r.texte, chiffresAutorises(d, r.faits)), [], m);
  }
  const d = seance();
  assert.deepEqual(chiffresEtrangers('Le BRVM Composite gagne 3 virgule 14 pour cent.', chiffresAutorises(d, null)), ['3 virgule 14']);
});

/* ── Script détaillé (2026-10-08) ─────────────────────────────────────── */

function seanceDetaillee(sur = {}) {
  return seance({
    indices: [
      { code: 'BRVMC', valeur: 547.91, variation_pct: 0.56 },
      { code: 'BRVM30', valeur: 265.31, variation_pct: 0.52 },
      { code: 'BRVMPRES', valeur: 203.22, variation_pct: 0.14 },
      { code: 'BRVMSPUB', valeur: 276.3, variation_pct: 3.76 },
      { code: 'BRVMCBASE', valeur: 267.37, variation_pct: 0.06 },
      { code: 'BRVMFINS', valeur: 245.92, variation_pct: 0.19 },
    ],
    volume: 412345,
    lourde: { code: 'SNTS', designation: 'SONATEL SENEGAL', part_pct: 35.2, variation_pct: -0.02, cours: 25500 },
    seconde: { code: 'SGBC', designation: 'SOCIETE GENERALE COTE D\'IVOIRE', part_pct: 11.4 },
    meilleures: [
      { code: 'PRSC', designation: 'TRACTAFRIC MOTORS COTE D\'IVOIRE', variation_pct: 4.96 },
      { code: 'CIEC', designation: 'CIE COTE D\'IVOIRE', variation_pct: 3.2 },
      { code: 'SNTS', designation: 'SONATEL SENEGAL', variation_pct: 2.9 },
    ],
    pires: [
      { code: 'ONTBF', designation: 'ONATEL BURKINA FASO', variation_pct: -5.94 },
      { code: 'BOAN', designation: 'BANK OF AFRICA NIGER', variation_pct: -3.1 },
    ],
    ...sur,
  });
}
const texteDe = (r, type) => r.temps.find((t) => t.type === type)?.texte ?? '';

test('détail : l’indice cite le BRVM 30, le BRVM Prestige et l’écart au plus haut de la fenêtre', () => {
  const r = composerRecit(seanceDetaillee(), { modele: 'nuit' });
  const t = texteDe(r, 'indice');
  assert.match(t, /BRVM 30 gagne 0 virgule 52 pour cent/);
  assert.match(t, /BRVM Prestige gagne 0 virgule 14 pour cent/);
  assert.match(t, /sous son plus haut de la période|à son plus haut de la période/);
});

test('détail : le palmarès nomme les trois hausses et les deux baisses, chacune avec sa variation', () => {
  const t = texteDe(composerRecit(seanceDetaillee(), { modele: 'nuit' }), 'palmares');
  for (const x of ['Tractafric Motors, plus 4 virgule 96', 'CIE, plus 3 virgule 2', 'Sonatel, plus 2 virgule 9',
    'Onatel, moins 5 virgule 94', 'Bank of Africa Niger, moins 3 virgule 1']) {
    assert.ok(t.includes(x), `${x} manquant dans : ${t}`);
  }
});

test('détail : les indices sectoriels donnent le plus fort et le plus faible', () => {
  const t = texteDe(composerRecit(seanceDetaillee(), { modele: 'papier' }), 'secteurs');
  assert.match(t, /celui des services publics mène, plus 3 virgule 76 pour cent/);
  assert.match(t, /celui de la consommation de base ferme la marche, plus 0 virgule 06 pour cent/);
});

test('détail : cours de clôture, valeur suivante et volume', () => {
  const r = composerRecit(seanceDetaillee(), { modele: 'nuit' });
  assert.match(texteDe(r, 'lourde'), /Son cours termine à 25500 francs CFA/);
  assert.match(texteDe(r, 'lourde'), /Vient ensuite Société Générale/);
  assert.match(texteDe(r, 'capitaux'), /412345 titres/);
});

test('détail : les trois modèles contiennent la scène des secteurs', () => {
  for (const m of MODELES) {
    assert.ok(composerRecit(seanceDetaillee(), { modele: m }).temps.some((t) => t.type === 'secteurs'), m);
  }
});

test('détail : aucun chiffre étranger avec toutes les nouvelles données', () => {
  for (const m of MODELES) {
    const d = seanceDetaillee();
    const r = composerRecit(d, { modele: m });
    assert.deepEqual(chiffresEtrangers(r.texte, chiffresAutorises(d, r.faits)), [], m);
  }
});

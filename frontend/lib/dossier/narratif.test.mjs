import assert from 'node:assert/strict';
import test from 'node:test';
import { construireNarratif } from './narratif.ts';

/**
 * Le narratif est déterministe : mêmes chiffres, mêmes phrases. Ces tests
 * fixent les seuils qui décident si un fait devient une force ou un risque —
 * une dérive silencieuse ici changerait le sens d'un rapport envoyé à un
 * porteur de titres sans qu'aucun rendu n'échoue.
 *
 * Lancer : npx tsx --test lib/dossier/narratif.test.mjs
 */

/** Dossier minimal, tout à null : rien ne doit être affirmé. */
function vide() {
  return {
    genere_le: '2026-09-14',
    identite: { code: 'TEST', designation: null, secteur: null, pays: null, actions: null, flottant: null, notation: null },
    chiffres_cles: {
      exercice: null, cours: null, date_cours: null, variation_veille_pct: null, capitalisation: null,
      chiffre_affaires: null, resultat_net: null, capitaux_propres: null, dette: null,
      croissance_ca_1an: null, croissance_ca_2ans: null, variation_capitaux_propres_1an: null,
    },
    trajectoire: [],
    dividende: {
      montant: null, base_fiscale: null, source: null, exercice: null, ex_date: null, payment_date: null,
      rendement: null, payout: null, historique: [], exercices_sans_dividende: 0,
    },
    detachement: null,
    technique: {
      date_signal: null, signal: null, score_total: null, confiance: null, explication: null,
      rsi: null, ma20: null, ma50: null, macd_line: null, macd_signal: null, serie: [],
    },
    ratios: null,
    qualite_resultat: null,
    niveaux: null,
    lacunes: [],
  };
}

/** Profil NEIC au 2026-09-11, tel que lu en base — la référence de ce module. */
function neic() {
  const d = vide();
  d.chiffres_cles.resultat_net = 2_036_000_000;
  d.chiffres_cles.croissance_ca_1an = -0.238;
  d.chiffres_cles.croissance_ca_2ans = -0.397;
  d.chiffres_cles.variation_capitaux_propres_1an = 0.58;
  d.ratios = { bpa: 159.54, per: 17.24, pb: 6.1, ps: 6.83, capitalisation: null, roe: 0.354, roa: 0.348, margeNette: 0.396, gearing: 0.017, rendementDiv: 0.0511, payout: 0.88 };
  d.qualite_resultat = { periode: '2025', resultat_exploitation: 1_213_000_000, resultat_avant_impots: 2_467_000_000, resultat_net: 2_036_000_000, marge_exploitation: 0.24, part_non_operationnelle: 0.508 };
  d.dividende.montant = 140.4;
  d.dividende.base_fiscale = 'net';
  d.dividende.rendement = 0.0511;
  d.dividende.exercices_sans_dividende = 2;
  d.detachement = { ex_date: '2026-09-09', dividende: 140.4, cours_veille: 2980, cours_ex: 2630, baisse_fcfa: 350, part_expliquee: 0.401, recul_hors_dividende: -0.0738 };
  d.technique.serie = [{ date: '2026-09-11', cours: 2750, volume: 1925 }];
  return d;
}

test('un dossier vide ne produit aucune appréciation et se déclare incomplet', () => {
  const n = construireNarratif(vide());
  assert.deepEqual(n.forces, []);
  assert.deepEqual(n.risques, []);
  assert.equal(n.incomplet, true);
});

test('chaque appréciation porte le chiffre qui la fonde', () => {
  const n = construireNarratif(neic());
  for (const a of [...n.forces, ...n.risques]) {
    assert.match(a.texte, /\d/, `sans chiffre : ${a.texte}`);
  }
});

test('NEIC : un bénéfice majoritairement non opérationnel est un risque, pas une force', () => {
  const n = construireNarratif(neic());
  const r = n.risques.find((a) => a.texte.includes('51 %'));
  assert.ok(r, 'le risque « 51 % non opérationnel » doit être présent');
  assert.match(r.texte, /ne vient pas de l'exploitation/);
  assert.ok(!n.forces.some((a) => a.texte.includes('opérationnel')), 'aucune force ne doit vanter l\'origine du bénéfice');
});

test('NEIC : le détachement partiel est nommé avec les deux montants et la date en français', () => {
  const n = construireNarratif(neic());
  const r = n.risques.find((a) => a.texte.startsWith('Le détachement'));
  assert.ok(r);
  assert.match(r.texte, /09\/09\/2026/);
  assert.match(r.texte, /40 %/);
  assert.match(r.texte, /350 FCFA/);
  assert.match(r.texte, /140,40/);
});

test('NEIC : le dividende est qualifié de sa base fiscale', () => {
  const n = construireNarratif(neic());
  const f = n.forces.find((a) => a.texte.startsWith('Dividende'));
  assert.match(f.texte, /140,40 FCFA net/);
  assert.match(f.texte, /5,11 %/);
});

test('base fiscale inconnue : la réserve est écrite dans la phrase elle-même', () => {
  const d = neic();
  d.dividende.base_fiscale = 'inconnu';
  const f = construireNarratif(d).forces.find((a) => a.texte.startsWith('Dividende'));
  assert.match(f.texte, /base non précisée par la source/);
});

test('un détachement expliqué à 95 % ne déclenche pas de risque', () => {
  const d = neic();
  d.detachement.part_expliquee = 0.95;
  assert.ok(!construireNarratif(d).risques.some((a) => a.texte.startsWith('Le détachement')));
});

test('part non opérationnelle négative proche de zéro : force, en valeur absolue', () => {
  const d = neic();
  d.qualite_resultat.part_non_operationnelle = -0.1;
  const n = construireNarratif(d);
  assert.ok(n.forces.some((a) => a.texte.startsWith("Bénéfice d'origine opérationnelle")));
  assert.ok(!n.risques.some((a) => a.texte.includes('exploitation')));
});

test('la notation est signalée comme qualité de crédit, jamais comme argument de valorisation', () => {
  const d = neic();
  d.identite.notation = { note: 'A-', agence: 'BloomField Investment', long_terme: null, court_terme: null, perspective: 'Stable', date_notation: '2025-12-01', annees_stables: 3 };
  const f = construireNarratif(d).forces.find((a) => a.texte.startsWith('Notation'));
  assert.match(f.texte, /stable depuis 3 exercices/);
  assert.match(f.texte, /qualité de crédit, non valorisation/);
});

test('un exercice déficitaire bascule du côté des risques', () => {
  const d = neic();
  d.chiffres_cles.resultat_net = -500_000_000;
  const n = construireNarratif(d);
  assert.ok(n.risques.some((a) => a.texte.startsWith('Exercice déficitaire')));
  assert.ok(!n.forces.some((a) => a.texte.startsWith('Exercice bénéficiaire')));
});

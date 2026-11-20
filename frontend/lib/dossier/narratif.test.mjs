import assert from 'node:assert/strict';
import test from 'node:test';
import { construireNarratif } from './narratif.ts';
import { construireSquelette, chargerProse } from './prose.ts';

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
  const r = n.risques.find((a) => a.texte.includes('hors exploitation'));
  assert.ok(r, 'le risque « produits hors exploitation » doit être présent');
  assert.match(r.texte, /1,25 Md FCFA/); // 2 467 M − 1 213 M, en montant
  assert.ok(!r.texte.includes('%'), 'aucun pourcentage : le dénominateur peut être quasi nul');
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

test('STAC : exploitation en perte, résultat avant impôts quasi nul : montant, jamais un pourcentage délirant', () => {
  const d = neic();
  d.qualite_resultat = { periode: '2025', resultat_exploitation: -772_000_000, resultat_avant_impots: 4_300_000, resultat_net: -772_000_000, marge_exploitation: null, part_non_operationnelle: 178.828 };
  const r = construireNarratif(d).risques.find((a) => a.texte.includes('hors exploitation'));
  assert.ok(r);
  assert.match(r.texte, /776,3 M FCFA/);
  assert.ok(!r.texte.includes('%'));
  assert.ok(!r.fait.match(/\d/));
});

test('un dividende ancien (exercice plus d un an avant le dernier publie) n est pas un point d appui', () => {
  const d = neic();
  d.chiffres_cles.exercice = '2025';
  d.dividende.exercice = 2021;
  assert.ok(!construireNarratif(d).forces.some((a) => a.texte.startsWith('Dividende')));
});

test('un dividende de l exercice precedent reste un point d appui', () => {
  const d = neic();
  d.chiffres_cles.exercice = '2025';
  d.dividende.exercice = 2024;
  /* Daté : sans date de paiement, un dividende 2024 serait « ancien » après le
     30/06/2026 (règle unique lib/hebdo/rendementDividende.ts). */
  d.dividende.payment_date = '2025-07-15';
  d.chiffres_cles.date_cours = '2026-05-15';
  assert.ok(construireNarratif(d).forces.some((a) => a.texte.startsWith('Dividende')));
});

/* ── Règle unique du rendement (lib/hebdo/rendementDividende.ts) ──────────
   Cas d'origine : FTSC, exercice 2024, 1 726,56 FCFA net payé le 30/09/2025,
   cours ~1 600 en novembre 2026. Le dossier écrivait « Dividende de
   1 726,56 FCFA net, soit ~108 % du cours ». */
function ftsc() {
  const d = vide();
  d.identite.code = 'FTSC';
  d.chiffres_cles.exercice = '2024';
  d.chiffres_cles.cours = 1600;
  d.chiffres_cles.date_cours = '2026-11-19';
  d.dividende.montant = 1726.56;
  d.dividende.base_fiscale = 'net';
  d.dividende.exercice = 2024;
  d.dividende.ex_date = '2025-09-25';
  d.dividende.payment_date = '2025-09-30';
  d.dividende.historique = [{ exercice: 2022, montant: 0 }, { exercice: 2023, montant: 0 }, { exercice: 2024, montant: 1726.56 }];
  return d;
}

test('FTSC : un dividende payé il y a plus de douze mois ne devient pas un rendement, même si le dossier en porte un', () => {
  const d = ftsc();
  d.dividende.rendement = 1726.56 / 1600; // dossier construit sans la règle
  const n = construireNarratif(d);
  const tout = [...n.forces, ...n.risques].map((a) => a.texte).join(' | ');
  assert.ok(!/du cours/.test(tout), tout);
  assert.ok(!tout.includes('1 726,56') || !tout.includes('%'), tout);
  assert.ok(!n.forces.some((a) => a.texte.startsWith('Dividende')));
});

test('FTSC : rendement retiré par build (rendement_non_calcule) => aucune force de dividende', () => {
  const d = ftsc();
  d.dividende.rendement = null;
  d.dividende.rendement_non_calcule = 'dividende_ancien';
  assert.ok(!construireNarratif(d).forces.some((a) => a.texte.startsWith('Dividende')));
});

test('dividende anormal (plus de 3 fois la médiane des exercices antérieurs) : pas de force de rendement', () => {
  const d = ftsc();
  d.chiffres_cles.date_cours = '2025-10-15'; // payé il y a 15 jours : pas ancien
  d.dividende.historique = [{ exercice: 2022, montant: 100 }, { exercice: 2023, montant: 110 }, { exercice: 2024, montant: 1726.56 }];
  d.dividende.rendement = 0.2; // sous 25 % : seul l'historique le trahit
  d.chiffres_cles.cours = 1726.56 / 0.2;
  assert.ok(!construireNarratif(d).forces.some((a) => a.texte.startsWith('Dividende')));
});

test('dividende récent et normal : la force de rendement est inchangée', () => {
  const d = vide();
  d.chiffres_cles.exercice = '2025';
  d.chiffres_cles.cours = 25000;
  d.chiffres_cles.date_cours = '2026-11-19';
  d.dividende.montant = 1500;
  d.dividende.base_fiscale = 'net';
  d.dividende.exercice = 2025;
  d.dividende.payment_date = '2026-05-20';
  d.dividende.rendement = 0.06;
  d.dividende.historique = [{ exercice: 2023, montant: 1400 }, { exercice: 2024, montant: 1450 }, { exercice: 2025, montant: 1500 }];
  const f = construireNarratif(d).forces.find((a) => a.texte.startsWith('Dividende'));
  assert.ok(f);
  assert.match(f.texte, /^Dividende de 1.500,00 FCFA net, soit 6,00 % du cours$/);
});

test('FTSC : la prose polie d avant la règle est écartée, le dossier retombe sur le squelette sans chiffre', async () => {
  /* Avant : force « un dividende net versé » présente (règle non appliquée). */
  const avant = ftsc();
  avant.dividende.exercice = 2025; avant.dividende.payment_date = '2026-09-30'; avant.dividende.rendement = 0.05;
  avant.dividende.historique = [];
  avant.chiffres_cles.cours = 1726.56 / 0.05;
  const skAvant = construireSquelette(avant, construireNarratif(avant));
  assert.match(skAvant.sections[0].texte, /dividende net versé/);

  const apres = ftsc();
  apres.dividende.rendement = null; apres.dividende.rendement_non_calcule = 'dividende_ancien';
  apres.lacunes = ['Le dernier dividende enregistré a été payé il y a plus de douze mois.'];
  const sk = construireSquelette(apres, construireNarratif(apres));
  assert.notEqual(sk.empreinte, skAvant.empreinte);
  const texte = sk.sections.map((x) => x.texte).join(' ');
  assert.ok(!/dividende net versé/.test(texte), texte);
  assert.ok(!/%/.test(texte));
  assert.ok(sk.sections.every((x) => x.texte.length > 40));

  const sb = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { genere_le: '2026-11-14', sections: skAvant.sections, empreinte: skAvant.empreinte } }) }) }) }) }) }) };
  const p = await chargerProse(sb, 'FTSC', sk);
  assert.equal(p.source, 'squelette');
  assert.deepEqual(p.sections, sk.sections);
});

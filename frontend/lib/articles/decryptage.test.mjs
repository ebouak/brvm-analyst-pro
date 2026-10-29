import assert from 'node:assert/strict';
import test from 'node:test';
import { composerDecryptage, jaugePilier } from './decryptage.ts';

/**
 * Le décryptage suit le skill thesis-tracker et le gabarit « Décryptage » :
 * piliers avec marge de sécurité, risques, invalidation, journal, catalyseurs.
 * Ces tests fixent le contrat de données, le recalcul sur le résultat part du
 * groupe et l'absence de recommandation — un décryptage qui dirait « acheter »
 * serait un conseil en investissement publié sous notre nom.
 *
 * Lancer : npx tsx --test lib/articles/decryptage.test.mjs
 */
const pilier = (cle, libelle, statut, mesure, unite = '%', precedente = null, tendance = null) => ({
  cle, libelle, statut, mesure, unite, precedente, tendance, seuil: `Seuil ${libelle}.`,
});
const dossier = {
  identite: { code: 'SNTS', designation: 'SONATEL', secteur: 'Télécommunications', actions: 1e9, notation: { note: 'AAA', agence: 'GCR Ratings', date_notation: '2026-06-30' } },
  chiffres_cles: { exercice: '2025', cours: 4200, date_cours: '2026-10-28', variation_veille_pct: -5.08, capitalisation: 4.2e12, resultat_net: 413_588e6, capitaux_propres: 1_399_263e6, dette: 402_686e6, tresorerie: 536_105e6, croissance_ca_1an: 0.0826 },
  ratios: { bpa: 413.588, per: 10.155, pb: 3.0 },
  trajectoire: [
    { exercice: '2024', chiffre_affaires: 1_776_443e6, resultat_net: 393_662e6 },
    { exercice: '2025', chiffre_affaires: 1_923_122e6, resultat_net: 413_588e6 },
  ],
  qualite_resultat: { resultat_exploitation: 669_792e6 },
  dividende: { montant: 174, base_fiscale: 'net', exercice: 2025, rendement: 0.0414, ex_date: '2026-05-22', payment_date: '2026-05-26', historique: [{ exercice: 2024, montant: 165.5 }, { exercice: 2025, montant: 174 }] },
  technique: { serie: [{ date: '2026-10-27', cours: 4425 }, { date: '2026-10-28', cours: 4200 }] },
  suivi: {
    performance: { haut52: 4700 },
    intermediaire: null,
    piliers: [
      pilier('croissance', 'Croissance du chiffre d’affaires', 'tenu', 0.0826),
      pilier('rentabilite', 'Rentabilité des capitaux propres', 'tenu', 0.296),
      pilier('endettement', 'Endettement', 'tenu', 0.288),
      pilier('valorisation', 'Valorisation (PER)', 'tenu', 10.155, 'x', 18.5),
    ],
    rendez_vous: [],
    medianes: {
      groupe: 'sociétés non financières', nbSocietes: 32,
      lignes: [
        { libelle: 'PER', unite: 'x', valeur: 10.88, mediane: 18.5, lecture: 'favorable' },
        { libelle: 'Cours / valeur comptable', unite: 'x', valeur: 3.2, mediane: 3.46, lecture: 'neutre' },
        { libelle: 'ROE', unite: '%', valeur: 29.56, mediane: 19.3, lecture: 'favorable' },
        { libelle: 'Dette nette / EBITDA', unite: 'x', valeur: -0.14, mediane: 0.83, lecture: 'favorable' },
      ],
    },
    liquidite: { classe: 'A', score: 100, spread_pct: 0.11, spread_source: 'carnet' },
  },
};
const narratif = { forces: [], risques: [{ texte: 'Le marché paie 3,0 fois les capitaux propres' }], incomplet: false };
const faits = [{ slug: 'seance-snts-2026-10-28', titre: 'BRVM : Sonatel signe un record', type: 'seance_hors_norme', date_fait: '2026-10-28' }];
const seances = [
  { date_marche: '2026-10-23', cours_jour: 4385, variation_pct: 4.4, volume: 356560, valeur_echangee: 1.55e9 },
  { date_marche: '2026-10-26', cours_jour: 4700, variation_pct: 7.18, volume: 323351, valeur_echangee: 1.52e9 },
  { date_marche: '2026-10-27', cours_jour: 4425, variation_pct: -5.85, volume: 309660, valeur_echangee: 1.42e9 },
  { date_marche: '2026-10-28', cours_jour: 4200, variation_pct: -5.08, volume: 3123435, valeur_echangee: 12.85e9 },
];
const editorial = {
  code: 'SNTS', verifie_le: '2026-10-29',
  comptes: {
    exercice: '2025', source: { label: 'Communiqué', url: 'https://exemple.test/fy' },
    resultat_part_groupe: 341_963e6, resultat_part_groupe_prec: 328_750e6, fonds_propres_groupe: 1_160_715e6,
    resultat_exploitation_prec: 619_523e6, resultat_avant_impot_prec: 596_255e6,
    impot_societes: 235_398e6, impot_societes_prec: 202_593e6,
    impots_taxes_exploitation: 182_495e6, impots_taxes_exploitation_prec: 148_927e6,
    free_cash_flow: 422.5e9, capex: 288.6e9, capex_variation: -0.039, dividende_brut: 193.3,
    ecarts_conversion: -64_079e6, resultat_global: 346_646e6,
    filiales: [{ pays: 'Mali', interet: 0.694 }, { pays: 'Sierra Leone', interet: 0.5 }], impot_intermediaire: null,
  },
  risques: [{ titre: 'Mobile money', texte: 'PI-SPI.', sources: [] }],
  catalyseurs: [
    { tri: '2026-11-02', date: '2 nov. 2026', titre: 'PI-SPI', texte: 'Entrée en vigueur.' },
    { tri: '2026-01-01', date: 'Janv. 2026', titre: 'Passé', texte: 'Déjà arrivé.' },
  ],
  journal: [], sources: [{ label: 'Communiqué', url: 'https://exemple.test/fy' }],
};
const extras = { seances, operations: [{ date_effet: '2026-10-26', type: 'fractionnement', ratio: 10 }], notations: [], editorial };
const a = composerDecryptage(dossier, narratif, faits, 'Sonatel', '2026-10-29T08:00:00Z', extras);
const d = a.chiffres.decryptage;

test('produit le contrat de données du gabarit, et le Markdown qui en dérive', () => {
  assert.equal(d.version, 1);
  assert.equal(d.kicker, 'Décryptage · SNTS · Télécommunications · Séance du 28 octobre 2026');
  for (const s of ['Les piliers de la thèse', 'Face aux comparables', 'Ce qui fragilise la thèse', 'Ce qui invaliderait la thèse', 'Journal récent', 'Catalyseurs à surveiller', 'Méthode']) {
    assert.ok(a.corps_md.includes(`## ${s}`), s);
  }
});

test('recalcule PER et P/B sur la part du groupe quand les comptes sont fournis', () => {
  assert.ok(d.chapo.includes('le PER sur le résultat part du groupe est de 12,3x (10,2x sur le résultat consolidé'), d.chapo);
  assert.equal(d.stats.find((s) => s.label === 'PER (BPA groupe)').valeur, '12,3x');
  assert.equal(d.vigilance.chiffre, '3,62x');
  assert.ok(d.invalidation.lignes.some((l) => l.invalidee_si === "Au-dessus de la médiane, soit environ 6 330 F à BPA constant"), JSON.stringify(d.invalidation.lignes));
});

test('ignore des comptes éditoriaux d’un autre exercice', () => {
  const autre = { ...editorial, comptes: { ...editorial.comptes, exercice: '2024' } };
  const x = composerDecryptage(dossier, narratif, faits, 'Sonatel', '2026-10-29T08:00:00Z', { ...extras, editorial: autre }).chiffres.decryptage;
  assert.equal(x.stats.find((s) => s.label.startsWith('PER')).valeur, '10,2x');
  assert.equal(x.vigilance?.chiffre ?? null, null);
});

test('mesure la marge de sécurité de chaque pilier sur son échelle propre', () => {
  assert.equal(jaugePilier(pilier('endettement', 'E', 'tenu', 0.288), null), 42);
  assert.equal(jaugePilier(pilier('valorisation', 'V', 'tenu', 12.28), 18.5), 34);
  assert.equal(jaugePilier(pilier('rentabilite', 'R', 'tenu', 0.296), null), 97);
  assert.equal(jaugePilier(pilier('rentabilite', 'R', 'non_tenu', 0.1), null), 0);
  assert.equal(jaugePilier(pilier('endettement', 'E', 'non_applicable', null), null), null);
});

test('raconte le fractionnement et la baisse cumulée depuis le plus haut', () => {
  assert.equal(d.cours.titre, 'Le fractionnement par 10 et les séances suivantes');
  assert.deepEqual(d.cours.serie.map((p) => p.ajuste), [true, false, false, false]);
  assert.equal(d.cours.conclusion, 'Sur ces 2 séances, la baisse cumulée est de 10,6 %.');
});

test('écarte les catalyseurs passés et relie les faits à un pilier', () => {
  assert.deepEqual(d.catalyseurs.map((c) => c.titre), ['PI-SPI']);
  assert.ok(d.journal[0].texte.includes('Pilier concerné : marché (cours et liquidité).'));
});

test('ne recommande jamais et n’emploie pas d’emoji', () => {
  assert.ok(a.corps_md.includes('pas un conseil en investissement'));
  assert.ok(!/\b(achetez|vendez|à acheter|objectif de cours|conviction)\b/i.test(a.corps_md));
  assert.ok(!/[✅❌]/u.test(JSON.stringify(d)));
  assert.equal(a.slug, 'decryptage-snts-2026-10-29');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { composerDecryptage } from './decryptage.ts';

/**
 * Le décryptage suit le skill thesis-tracker : piliers, ce qui soutient, ce
 * qui fragilise, ce qui invaliderait, journal, catalyseurs. Ces tests fixent la
 * structure et l'absence de recommandation — un décryptage qui dirait
 * « acheter » serait un conseil en investissement publié sous notre nom.
 *
 * Lancer : npx tsx --test lib/articles/decryptage.test.mjs
 */
const pilier = (cle, libelle, statut, mesure, unite = '%') => ({
  cle, libelle, statut, mesure, unite, precedente: null, tendance: null, seuil: `Seuil ${libelle}.`,
});
const dossier = {
  identite: { code: 'SNTS', designation: 'SONATEL' },
  chiffres_cles: { cours: 4200, date_cours: '2026-10-28', capitalisation: 4.2e12 },
  trajectoire: [{ exercice: '2025', chiffre_affaires: 1.92e12, resultat_net: 4.1359e11 }],
  dividende: { historique: [{ exercice: 2024, montant: 166 }, { exercice: 2025, montant: 174 }], rendement: 0.0414 },
  technique: { serie: [{ date: '2026-10-27', cours: 4425 }, { date: '2026-10-28', cours: 4200 }] },
  suivi: {
    piliers: [
      pilier('rentabilite', 'Rentabilité des capitaux propres', 'tenu', 0.296),
      pilier('valorisation', 'Valorisation (PER)', 'non_tenu', 25, 'x'),
      pilier('endettement', 'Endettement', 'non_applicable', null),
    ],
    rendez_vous: [{ date: '2026-11-03', libelle: 'Détachement du dividende de l’exercice 2025' }],
    medianes: { groupe: 'non financières', nbSocietes: 32, lignes: [{ libelle: 'ROE', unite: '%', valeur: 29.56, mediane: 19.3, nbPairs: 31, position: 'au-dessus', lecture: 'favorable' }] },
    liquidite: { classe: 'A', score: 100, spread_pct: 0.11, spread_source: 'carnet' },
  },
};
const narratif = { forces: [{ texte: 'Rentabilité élevée : 29,6 %' }], risques: [{ texte: 'Valeur non décotée' }], incomplet: false };
const faits = [{ slug: 'seance-snts-2026-10-28', titre: 'BRVM : Sonatel signe un record', type: 'seance_hors_norme', date_fait: '2026-10-28' }];

const a = composerDecryptage(dossier, narratif, faits, 'Sonatel', '2026-10-29T08:00:00Z');

test('suit la structure du skill thesis-tracker', () => {
  for (const s of ['La thèse en une phrase', 'Tableau de bord de la thèse', 'Ce qui soutient la thèse', 'Ce qui la fragilise', 'Ce qui invaliderait la thèse', 'Journal des faits récents', 'Calendrier des catalyseurs']) {
    assert.ok(a.corps_md.includes(`## ${s}`), s);
  }
});

test('compte les piliers mesurables, pas les sans-objet', () => {
  assert.equal(a.titre, 'Décryptage — Sonatel : 1 pilier de thèse tenu sur 2');
  assert.equal(a.chiffres.image.chiffre, '1/2');
});

test('rend la thèse réfutable : seuil des seuls piliers tenus', () => {
  const invalide = a.corps_md.split('## Ce qui invaliderait la thèse')[1].split('##')[0];
  assert.ok(invalide.includes('Rentabilité des capitaux propres'));
  assert.ok(!invalide.includes('Valorisation'));
});

test('relie chaque fait récent à un pilier, et date les catalyseurs', () => {
  assert.ok(a.corps_md.includes('| 28 octobre 2026 | [BRVM : Sonatel signe un record](/actualites/seance-snts-2026-10-28) | Marché : cours et liquidité |'));
  assert.ok(a.corps_md.includes('| 3 novembre 2026 | Détachement du dividende de l’exercice 2025 |'));
});

test('ne multiplie pas par cent des pourcentages déjà en %', () => {
  assert.ok(a.corps_md.includes('| ROE | 29,6 % | 19,3 % | Favorable |'));
});

test('ne recommande jamais', () => {
  assert.ok(a.corps_md.includes('pas un conseil en investissement'));
  assert.ok(!/\b(achetez|vendez|à acheter|objectif de cours|conviction)\b/i.test(a.corps_md));
  assert.equal(a.slug, 'decryptage-snts-2026-10-29');
});

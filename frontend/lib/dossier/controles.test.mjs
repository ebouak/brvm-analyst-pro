import assert from 'node:assert/strict';
import test from 'node:test';
import { controlerDossier } from './controles.ts';

/** Dossier minimal cohérent (forme de DossierValeur, champs utiles seulement). */
const dossier = (sur = {}) => ({
  chiffres_cles: {
    exercice: '2025', cours: 44_980, capitalisation: 4_498_000_000_000,
    croissance_ca_1an: 0.083, croissance_ca_2ans: 0.187, ...(sur.chiffres_cles ?? {}),
  },
  identite: { actions: 100_000_000, ...(sur.identite ?? {}) },
  trajectoire: sur.trajectoire ?? [{ exercice: '2024' }, { exercice: '2025' }],
  qualite_resultat: sur.qualite_resultat === undefined ? { periode: '2025' } : sur.qualite_resultat,
  suivi: { intermediaire: sur.intermediaire === undefined ? { periode: '2026-S1', periodePrecedente: '2025-S1' } : sur.intermediaire },
});

test('un dossier cohérent ne lève aucune anomalie', () => {
  assert.deepEqual(controlerDossier(dossier()), []);
});

test('le dossier SNTS du 10/10/2026 aurait été BLOQUÉ (exercice « 2026-T1 », trajectoire mêlée, qualité lue sur T1)', () => {
  const a = controlerDossier(dossier({
    chiffres_cles: { exercice: '2026-T1', croissance_ca_1an: -0.52 },
    trajectoire: [{ exercice: '2025' }, { exercice: '2025-S1' }, { exercice: '2026-T1' }],
    qualite_resultat: { periode: '2026-T1' },
  }));
  assert.ok(a.some((x) => x.includes('2026-T1') && x.includes('annuel')), a.join(' | '));
  assert.ok(a.some((x) => x.includes('trajectoire')), a.join(' | '));
  assert.ok(a.some((x) => x.includes('qualité')), a.join(' | '));
});

test('une comparaison intermédiaire de deux durées différentes est bloquée', () => {
  const a = controlerDossier(dossier({ intermediaire: { periode: '2026-T1', periodePrecedente: '2026-S1' } }));
  assert.equal(a.length, 1);
  assert.match(a[0], /intermédiaire/);
});

test('une croissance au-delà de ±200 % est à vérifier (erreur d’unité ou de période)', () => {
  assert.equal(controlerDossier(dossier({ chiffres_cles: { croissance_ca_1an: 3.4 } })).length, 1);
  assert.equal(controlerDossier(dossier({ chiffres_cles: { croissance_ca_1an: 1.5 } })).length, 0);
});

test('capitalisation incohérente avec cours × actions', () => {
  assert.equal(controlerDossier(dossier({ chiffres_cles: { capitalisation: 4_498_000_000 } })).length, 1);
});

test('des données absentes ne sont pas des incohérences', () => {
  const a = controlerDossier(dossier({
    chiffres_cles: { exercice: null, cours: null, capitalisation: null, croissance_ca_1an: null, croissance_ca_2ans: null },
    trajectoire: [], qualite_resultat: null, intermediaire: null,
  }));
  assert.deepEqual(a, []);
});

import assert from 'node:assert';
import { computeFreshness, estEnSeance, dernierJourOuvreAttendu } from './freshness.ts';

// Toutes les dates en UTC (la BRVM cote en GMT = UTC, Abidjan est à UTC+0).

// --- estEnSeance : lun-ven 09-16 GMT ---
assert.equal(estEnSeance(new Date('2026-07-21T10:00:00Z')), true, 'mardi 10h = en séance');
assert.equal(estEnSeance(new Date('2026-07-21T08:00:00Z')), false, 'mardi 8h = avant ouverture');
assert.equal(estEnSeance(new Date('2026-07-21T17:00:00Z')), false, 'mardi 17h = après clôture');
assert.equal(estEnSeance(new Date('2026-07-19T10:00:00Z')), false, 'dimanche = jamais en séance');
assert.equal(estEnSeance(new Date('2026-07-18T10:00:00Z')), false, 'samedi = jamais en séance');

// --- dernierJourOuvreAttendu : dernier jour de semaine <= la date ---
assert.equal(dernierJourOuvreAttendu(new Date('2026-07-19T10:00:00Z')), '2026-07-17', 'dimanche -> vendredi');
assert.equal(dernierJourOuvreAttendu(new Date('2026-07-18T10:00:00Z')), '2026-07-17', 'samedi -> vendredi');
assert.equal(dernierJourOuvreAttendu(new Date('2026-07-21T10:00:00Z')), '2026-07-21', 'mardi -> mardi');

// --- computeFreshness ---
const mardi10h = new Date('2026-07-21T10:00:00Z');

// Séance du jour à jour, collecte il y a 8 min → frais (heartbeat en séance).
let f = computeFreshness('2026-07-21T09:52:00Z', '2026-07-21', mardi10h);
assert.equal(f.etat, 'frais');
assert.ok(f.ageMinutes >= 7 && f.ageMinutes <= 9);

// Mardi 14h, collecte il y a 3h (180 min) EN SÉANCE → décrochage → perime,
// même si la séance du jour est déjà en base.
const mardi14h = new Date('2026-07-21T14:00:00Z');
f = computeFreshness('2026-07-21T11:00:00Z', '2026-07-21', mardi14h);
assert.equal(f.etat, 'perime', 'stall en séance prime sur date_marche à jour');

// Dimanche, dernière séance = vendredi, collecte vendredi 17h → frais
// (pas d'alarme le week-end : la base a bien la dernière séance attendue).
const dimanche = new Date('2026-07-19T12:00:00Z');
f = computeFreshness('2026-07-17T17:00:00Z', '2026-07-17', dimanche);
assert.equal(f.etat, 'frais', 'week-end avec la clôture de vendredi = frais');

// Mardi 8h (avant ouverture), dernière séance = lundi, collecte lundi 15h →
// recent (la séance du jour n'existe pas encore, normal).
const mardi8h = new Date('2026-07-21T08:00:00Z');
f = computeFreshness('2026-07-20T15:00:00Z', '2026-07-20', mardi8h);
assert.equal(f.etat, 'recent', 'avant ouverture, séance de la veille = recent, pas d’alarme');

// Aucune collecte tracée → inconnu.
f = computeFreshness(null, '2026-07-21', mardi10h);
assert.equal(f.etat, 'inconnu');
assert.equal(f.ageMinutes, null);

// Collecte présente mais dernière séance absente → l'état se calcule quand même.
f = computeFreshness('2026-07-21T09:52:00Z', null, mardi10h);
assert.equal(f.etat, 'frais', 'heartbeat en séance suffit sans date_marche');

console.log('✓ freshness OK');

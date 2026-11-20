import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decisionPorte, decisionVeille, estOuvre, evaluerCloture, jourVeille, objetExiste } from './cloture.mjs';
import { marqueurBucket } from './chaineWhatsapp.mjs';

const S = '2026-11-19';
const run = (o = {}) => ({
  id: 'r1',
  status: 'success',
  finished_at: `${S}T22:10:00Z`,
  ...o,
  metadata: { date_marche: S, nb_actions: 46, ...(o.metadata ?? {}) },
});

test('clôture : run réussi, bonne séance, après 15:00, 46 actions → confirmée', () => {
  const r = evaluerCloture(S, [run()]);
  assert.equal(r.confirmee, true);
  assert.equal(r.run_id, 'r1');
});

test('clôture : run réussi terminé AVANT 15:00 UTC → refusée', () => {
  const r = evaluerCloture(S, [run({ finished_at: `${S}T14:59:59Z` })]);
  assert.equal(r.confirmee, false);
  assert.match(r.raison, /avant 15:00/);
});

test('clôture : 15:00:00 pile compte comme après la clôture', () => {
  assert.equal(evaluerCloture(S, [run({ finished_at: `${S}T15:00:00Z` })]).confirmee, true);
});

test('clôture : moins de 20 actions écrites → refusée', () => {
  const r = evaluerCloture(S, [run({ metadata: { nb_actions: 19 } })]);
  assert.equal(r.confirmee, false);
  assert.match(r.raison, /19 action/);
});

test('clôture : nb_actions absent → refusée (jamais supposé)', () => {
  const r = evaluerCloture(S, [{ id: 'x', status: 'success', finished_at: `${S}T20:00:00Z`, metadata: { date_marche: S } }]);
  assert.equal(r.confirmee, false);
});

test('clôture : run d\'une autre séance (BDFIN pas encore à jour) → refusée', () => {
  const r = evaluerCloture(S, [run({ metadata: { date_marche: '2026-11-18' } })]);
  assert.equal(r.confirmee, false);
  assert.match(r.raison, /2026-11-18/);
});

test('clôture : runs failed / partial / running ignorés', () => {
  const r = evaluerCloture(S, [run({ status: 'failed' }), run({ status: 'partial' }), run({ status: 'running', finished_at: null })]);
  assert.equal(r.confirmee, false);
});

test('clôture : un run incomplet puis un run complet → confirmée par le complet', () => {
  const r = evaluerCloture(S, [run({ id: 'a', metadata: { nb_actions: 3 } }), run({ id: 'b', finished_at: `${S}T23:00:00Z` })]);
  assert.equal(r.confirmee, true);
  assert.equal(r.run_id, 'b');
});

test('clôture : aucune donnée / séance invalide → refusée', () => {
  assert.equal(evaluerCloture(S, []).confirmee, false);
  assert.equal(evaluerCloture(S, null).confirmee, false);
  assert.equal(evaluerCloture(null, [run()]).confirmee, false);
});

test('porte : génération seule → générer sans publier', () => {
  assert.deepEqual(decisionPorte({ generationSeule: true }).a_publier, false);
  assert.equal(decisionPorte({ generationSeule: true }).generer, true);
});

test('porte : séance déjà publiée → rien', () => {
  const d = decisionPorte({ dejaPubliee: true, cloture: { confirmee: true, raison: 'x' } });
  assert.equal(d.a_publier, false);
  assert.equal(d.generer, false);
});

test('porte : clôture non confirmée → rien, motif repris', () => {
  const d = decisionPorte({ dejaPubliee: false, cloture: { confirmee: false, raison: 'trop tôt' } });
  assert.equal(d.a_publier, false);
  assert.match(d.raison, /trop tôt/);
});

test('porte : clôture confirmée, pas encore publiée → publier', () => {
  const d = decisionPorte({ dejaPubliee: false, cloture: { confirmee: true, raison: 'ok' } });
  assert.equal(d.a_publier, true);
  assert.equal(d.generer, true);
});

test('revérification du marqueur : libre (200) → true, déjà là (409) → false, panne → lève', async () => {
  const appels = [];
  const fetchImpl = (statut, corps = '{}') => async (url, init) => (appels.push([url, init.headers['x-upsert']]), new Response(corps, { status: statut }));
  const base = { urlSupabase: 'https://sb', entetes: {}, seance: S, chemin: `publication/${S}/facebook.json` };
  assert.equal(await marqueurBucket({ ...base, fetchImpl: fetchImpl(200) }).creer(), true);
  assert.equal(await marqueurBucket({ ...base, fetchImpl: fetchImpl(409) }).creer(), false);
  assert.equal(await marqueurBucket({ ...base, fetchImpl: fetchImpl(400, '{"error":"Duplicate"}') }).creer(), false);
  await assert.rejects(marqueurBucket({ ...base, fetchImpl: fetchImpl(500, 'boom') }).creer());
  assert.equal(appels[0][0], `https://sb/storage/v1/object/seance-video/publication/${S}/facebook.json`);
  assert.equal(appels[0][1], 'false', 'création seule, jamais upsert');
});

test('marqueur : chemin par défaut inchangé (Chaîne)', async () => {
  let vu;
  await marqueurBucket({ urlSupabase: 'https://sb', entetes: {}, seance: S, fetchImpl: async (u) => ((vu = u), new Response('{}')) }).creer();
  assert.equal(vu, `https://sb/storage/v1/object/seance-video/chaine/${S}.json`);
});

test('objetExiste : 200 → vrai, 400 not_found → faux, 500 → lève', async () => {
  const f = (s, c = '') => async () => new Response(c, { status: s });
  const o = { urlSupabase: 'https://sb', entetes: {}, chemin: 'x.json' };
  assert.equal(await objetExiste({ ...o, fetchImpl: f(200, '{}') }), true);
  assert.equal(await objetExiste({ ...o, fetchImpl: f(400, '{"statusCode":"404","error":"not_found"}') }), false);
  assert.equal(await objetExiste({ ...o, fetchImpl: f(404) }), false);
  await assert.rejects(objetExiste({ ...o, fetchImpl: f(500, 'boom') }));
});

test('veille : jour visé = maintenant − 23 h (cron en retard)', () => {
  assert.equal(jourVeille(new Date('2026-11-19T23:05:00Z')), '2026-11-19');
  assert.equal(jourVeille(new Date('2026-11-20T06:00:00Z')), '2026-11-19');
});

test('veille : jours ouvrés', () => {
  assert.equal(estOuvre('2026-11-19'), true); // jeudi
  assert.equal(estOuvre('2026-11-21'), false); // samedi
  assert.equal(estOuvre('2026-11-19', ['2026-11-19']), false); // fermé au calendrier
});

test('veille : Chaîne publiée ou jour fermé → pas d\'alerte', () => {
  assert.equal(decisionVeille({ jour: S, ouvre: true, chainePubliee: true }).alerter, false);
  assert.equal(decisionVeille({ jour: S, ouvre: false }).alerter, false);
});

test('veille : jour ouvré sans Chaîne → alerte AVEC la raison', () => {
  const a = decisionVeille({ jour: S, ouvre: true, chainePubliee: false, termine: false, cloture: { confirmee: false, raison: 'aucun run' } });
  assert.equal(a.alerter, true);
  assert.match(a.message, /aucun run/);
  const b = decisionVeille({ jour: S, ouvre: true, chainePubliee: false, termine: false, cloture: { confirmee: true, raison: 'clôture confirmée' } });
  assert.match(b.message, /video-seance/);
  const c = decisionVeille({ jour: S, ouvre: true, chainePubliee: false, termine: true, cloture: { confirmee: true, raison: 'ok' } });
  assert.match(c.message, /non configurée/);
});

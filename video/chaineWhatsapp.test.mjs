// node --test video/  — Chaîne WhatsApp : légende (pure) et publication (fetch simulé).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legendeWhatsapp, publierChaine } from './chaineWhatsapp.mjs';

/** Séance de synthèse (valeurs inventées pour le test, pas de la production). */
const seance = (sur = {}) => ({
  seance: '2026-10-23',
  date_fr: '23/10/2026',
  composite: { valeur: 312.345, variation_pct: 0.45 },
  hausses: 18,
  baisses: 22,
  stables: 7,
  valeurs: 47,
  capitaux_fcfa: 2.55e9,
  capitaux_estimes: false,
  plus_forte_hausse: { code: 'AAAA', variation_pct: 7.5 },
  plus_forte_baisse: { code: 'BBBB', variation_pct: -7.4 },
  ...sur,
});

test('légende : mêmes nombres que seance.json, mise en forme WhatsApp', () => {
  const t = legendeWhatsapp(seance());
  assert.match(t, /\*BRVM — séance du 23\/10\/2026\*/);
  assert.match(t, /\+0,45 % à 312,35 points/);
  assert.match(t, /18 hausses · 🔴 22 baisses · ⚪ 7 stables \(47 valeurs\)/);
  assert.match(t, /💰 2,55 Md FCFA échangés/);
  assert.match(t, /\*AAAA\* \+7,50 %/);
  assert.match(t, /\*BBBB\* −7,40 %/);
  assert.match(t, /pas un conseil en investissement/);
  assert.match(t, /https:\/\/wa\.me\/33743657271\?text=AIDE/);
  assert.ok(t.length <= 4096);
});

test('légende : capitaux estimés annoncés comme tels ; composite absent omis', () => {
  const t = legendeWhatsapp(seance({ capitaux_estimes: true, composite: null }));
  assert.match(t, /Environ 2,55 Md FCFA/);
  assert.match(t, /capitaux estimés/);
  assert.doesNotMatch(t, /Composite/);
});

function marqueurFactice(existe = false) {
  const etat = { existe, retire: false };
  return {
    etat,
    creer: async () => (etat.existe ? false : ((etat.existe = true), true)),
    retirer: async () => {
      etat.existe = false;
      etat.retire = true;
    },
  };
}
const waha = { url: 'https://wa.example/', cle: 'k', session: 'default' };

test('publication : envoie la vidéo par URL à la Chaîne', async () => {
  const appels = [];
  const fetchImpl = async (url, init) => (appels.push({ url, corps: JSON.parse(init.body), cle: init.headers['X-Api-Key'] }), new Response('{}', { status: 201 }));
  const r = await publierChaine({ m: seance(), urlVideo: 'https://b/v.mp4', waha, chaineId: '1@newsletter', marqueur: marqueurFactice(), fetchImpl });
  assert.equal(r, 'publie');
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, 'https://wa.example/api/sendVideo');
  assert.equal(appels[0].corps.chatId, '1@newsletter');
  assert.equal(appels[0].corps.file.url, 'https://b/v.mp4');
  assert.equal(appels[0].corps.convert, false);
  assert.match(appels[0].corps.caption, /séance du 23\/10\/2026/);
});

test('relance : marqueur déjà présent → aucun envoi', async () => {
  let appels = 0;
  const r = await publierChaine({ m: seance(), urlVideo: 'u', waha, chaineId: 'c', marqueur: marqueurFactice(true), fetchImpl: async () => (appels++, new Response('{}')) });
  assert.equal(r, 'deja-publie');
  assert.equal(appels, 0);
});

test('échec : lève ET retire le marqueur pour permettre une relance', async () => {
  const mq = marqueurFactice();
  await assert.rejects(
    publierChaine({ m: seance(), urlVideo: 'u', waha, chaineId: 'c', marqueur: mq, fetchImpl: async () => new Response('boom', { status: 500 }) }),
    /HTTP 500/,
  );
  assert.equal(mq.etat.retire, true);
  assert.equal(mq.etat.existe, false);
});

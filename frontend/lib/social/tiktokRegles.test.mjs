import assert from 'node:assert/strict';
import test from 'node:test';
import { choixInitial, declaration, etiquetteCommerciale, postInfo, validerChoix, MESSAGE_MARQUE_PRIVEE, MESSAGE_SANS_OPTION } from './tiktokRegles.ts';

/** Lancer : npx tsx --test lib/social/tiktokRegles.test.mjs */
const info = {
  creator_nickname: 'WESTBOURSE', creator_username: 'westbourse7', creator_avatar_url: null,
  privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
  comment_disabled: false, duet_disabled: true, stitch_disabled: false, max_video_post_duration_sec: 600,
};

test('rien n’est pré-choisi : visibilité absente, interactions et déclaration commerciale décochées', () => {
  const c = choixInitial('Séance du 30 octobre');
  assert.equal(c.visibilite, null);
  assert.deepEqual([c.commentaires, c.duo, c.collage, c.commercial, c.votreMarque, c.contenuDeMarque], [false, false, false, false, false, false]);
  assert.equal(validerChoix(c, info, 'video', 60).ok, false);
});

test('la visibilité doit être choisie parmi celles que TikTok propose', () => {
  const c = { ...choixInitial('t'), visibilite: 'FOLLOWER_OF_CREATOR' };
  assert.equal(validerChoix(c, info, 'video', 60).ok, false);
  assert.equal(validerChoix({ ...c, visibilite: 'PUBLIC_TO_EVERYONE' }, info, 'video', 60).ok, true);
});

test('déclaration commerciale : au moins une option, contenu de marque jamais privé, libellés imposés', () => {
  const base = { ...choixInitial('t'), visibilite: 'PUBLIC_TO_EVERYONE', commercial: true };
  assert.deepEqual(validerChoix(base, info, 'video', 60), { ok: false, raison: MESSAGE_SANS_OPTION });
  assert.equal(etiquetteCommerciale({ ...base, votreMarque: true }, 'video'), "Your video will be labeled as 'Promotional content'");
  assert.equal(etiquetteCommerciale({ ...base, votreMarque: true, contenuDeMarque: true }, 'photo'), "Your photo will be labeled as 'Paid partnership'");
  assert.deepEqual(validerChoix({ ...base, contenuDeMarque: true, visibilite: 'SELF_ONLY' }, info, 'video', 60), { ok: false, raison: MESSAGE_MARQUE_PRIVEE });
  assert.equal(declaration({ ...base, contenuDeMarque: true }).texte, "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.");
  assert.equal(declaration(base).texte, "By posting, you agree to TikTok's Music Usage Confirmation.");
});

test('interactions désactivées par le compte et durée maximale refusées', () => {
  const c = { ...choixInitial('t'), visibilite: 'PUBLIC_TO_EVERYONE' };
  assert.equal(validerChoix({ ...c, duo: true }, info, 'video', 60).ok, false);
  assert.equal(validerChoix(c, info, 'video', 900).ok, false);
});

test('post_info reflète exactement le choix, photo sans duo ni collage', () => {
  const c = { ...choixInitial('Titre', 'Desc'), visibilite: 'PUBLIC_TO_EVERYONE', commentaires: true, commercial: true, votreMarque: true };
  assert.deepEqual(postInfo(c, 'video'), {
    title: 'Titre', privacy_level: 'PUBLIC_TO_EVERYONE', disable_comment: false,
    brand_content_toggle: false, brand_organic_toggle: true, disable_duet: true, disable_stitch: true,
  });
  const p = postInfo(c, 'photo');
  assert.equal(p.description, 'Desc');
  assert.equal('disable_duet' in p, false);
});

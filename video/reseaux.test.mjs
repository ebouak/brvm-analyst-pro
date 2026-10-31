import assert from 'node:assert/strict';
import test from 'node:test';
import { commentaireLinkedIn, echapperLinkedIn } from './reseaux.mjs';

/** Lancer : node --test reseaux.test.mjs */
test('échappe les caractères réservés de LinkedIn, comme scraper/src/social/texte.ts', () => {
  assert.equal(echapperLinkedIn('BRVM (séance) #1 *x*'), 'BRVM \\(séance\\) \\#1 \\*x\\*');
});

test('la légende de la vidéo devient un commentaire LinkedIn aux vrais hashtags', () => {
  const legende = ['BRVM — seance du 28 octobre 2026.', 'BRVM Composite −0,70 % a 312,45 points.', '#BRVM #Bourse #UEMOA'].join('\n');
  const c = commentaireLinkedIn(legende);
  assert.ok(c.includes('BRVM Composite −0,70 % a 312,45 points.'));
  assert.ok(c.includes('{hashtag|\\#|BRVM} {hashtag|\\#|Bourse} {hashtag|\\#|UEMOA}'));
  assert.ok(!c.includes('\n#BRVM'));
});

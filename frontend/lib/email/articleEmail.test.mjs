import assert from 'node:assert/strict';
import test from 'node:test';
import { articleEmailHtml, sujetArticle, libelleCampagne, peutRelancer } from './articleEmail.ts';

/** Lancer : npx tsx --test lib/email/articleEmail.test.mjs */
const base = 'https://www.westbourse.com';
const decryptage = {
  slug: 'decryptage-snts-2026-10-29',
  type: 'decryptage',
  titre: 'Sonatel : 6 piliers tenus sur 6',
  chapo: 'Au cours de 4 200 F, le PER est de 12,3x.',
  date_fait: '2026-10-29',
  chiffres: {
    decryptage: {
      version: 1,
      stats: [{ label: 'PER (BPA groupe)', valeur: '12,3x', sous: 'médiane 18,5x', ton: 'neutre' }],
      verdict: [{ ton: 'up', titre: 'Fondamentaux solides', texte: 'ROE de 29,6 %.' }],
      avertissement: 'Ceci n’est pas un conseil en investissement.',
    },
  },
};

test('reprend titre, chiffres clés, verdict et lien de l’article publié', () => {
  const html = articleEmailHtml(decryptage, base);
  assert.ok(html.includes('https://www.westbourse.com/actualites/decryptage-snts-2026-10-29'));
  assert.ok(html.includes('/api/articles/decryptage-snts-2026-10-29/image'));
  assert.ok(html.includes('12,3x') && html.includes('Fondamentaux solides'));
  assert.ok(html.includes('Lire le décryptage complet'));
  assert.ok(html.includes('pas un conseil en investissement'));
  assert.equal(sujetArticle(decryptage), 'Décryptage · Sonatel : 6 piliers tenus sur 6');
});

test('échappe le contenu : aucun balisage ne passe du titre au courriel', () => {
  const html = articleEmailHtml({ ...decryptage, type: 'dividende_annonce', chiffres: null, titre: '<script>x</script> "a"' }, base);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;') && html.includes('&quot;a&quot;'));
  assert.ok(html.includes('Lire l&#39;article'));
});

test('seul un échec total peut être relancé', () => {
  const c = (statut, envoyes) => ({ statut, destinataires: 12, envoyes, lance_le: '2026-10-29T12:00:00Z' });
  assert.equal(peutRelancer(null), true);
  assert.equal(peutRelancer(c('echec', 0)), true);
  assert.equal(peutRelancer(c('partiel', 8)), false);
  assert.equal(peutRelancer(c('envoye', 12)), false);
  assert.equal(peutRelancer(c('en_cours', null)), false);
  assert.equal(libelleCampagne(c('envoye', 12)), 'Envoyé le 29 octobre 2026 à 12 abonnés');
  assert.equal(libelleCampagne(c('partiel', 8)), 'Envoi partiel le 29 octobre 2026 : 8 sur 12');
});

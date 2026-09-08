// frontend/lib/agent/prompt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../whatsappAgent/systemPrompt.ts';

const WATCHLIST = [
  { code: 'SNTS', cours: 15000, variationPct: 1.25, signal: 'ACHAT', confiance: 0.72 },
];

/* Ce qui compte ici n'est pas la formulation mais le CONTRAT : les trois
   garde-fous doivent survivre a toute variante de canal ou d'outillage. Un
   test sur la prose casserait a la premiere reformulation ; un test sur les
   invariants tient. */
test('les trois garde-fous sont presents sur tous les canaux', () => {
  for (const ctx of [
    { watchlist: [] },
    { watchlist: WATCHLIST, canal: 'telegram', outils: true },
    { watchlist: WATCHLIST, canal: 'whatsapp' },
  ]) {
    const p = buildSystemPrompt(ctx);
    assert.match(p, /JAMAIS de conseil en investissement/, 'interdiction de conseil');
    assert.match(p, /n'inventes AUCUN chiffre/, 'interdiction d inventer');
    assert.match(p, /lecture seule/, 'lecture seule');
  }
});

test('le canal ne change QUE la mise en forme', () => {
  const wa = buildSystemPrompt({ watchlist: WATCHLIST, canal: 'whatsapp' });
  const tg = buildSystemPrompt({ watchlist: WATCHLIST, canal: 'telegram' });

  // WhatsApp a sa syntaxe propre ; Telegram est appele sans parse_mode, donc
  // tout symbole s'y afficherait tel quel.
  assert.match(wa, /\*gras\*/, 'WhatsApp annonce son formatage');
  assert.ok(!/\*gras\*/.test(tg), 'Telegram ne doit PAS proposer de formatage');
  assert.match(tg, /AUCUN symbole de mise en forme/);
  assert.match(tg, /agent Telegram/);
  assert.match(wa, /agent WhatsApp/);
});

test('sans le drapeau outils, aucune mention d outils', () => {
  const p = buildSystemPrompt({ watchlist: WATCHLIST });
  assert.ok(!/OUTILS/.test(p), 'un agent sans outils ne doit pas croire en avoir');
});

test('avec outils, la watchlist est annoncee comme un apercu et non une limite', () => {
  const p = buildSystemPrompt({ watchlist: WATCHLIST, outils: true });
  assert.match(p, /OUTILS/);
  // Le defaut corrige : un modele outille qui repond « je n'ai pas acces »
  // alors qu'un appel de fonction lui donnerait la reponse.
  assert.match(p, /ne limite pas ce que tu peux consulter/);
  assert.match(p, /AVANT de répondre que tu ne sais pas/);
});

test('la sortie par defaut reste identique a celle d avant le parametrage', () => {
  // Appel historique, sans canal ni outils : le chemin WhatsApp en production
  // ne doit rien voir changer.
  const p = buildSystemPrompt({ watchlist: WATCHLIST });
  assert.match(p, /agent WhatsApp de WESTBOURSE/);
  assert.match(p, /moins de 600 caractères/);
  /* \s et non une espace litterale : toLocaleString('fr-FR') separe les
     milliers par une espace INSECABLE (U+202F). Une regex avec une espace
     ordinaire echoue sur une sortie pourtant correcte — et le meme piege
     guette quiconque comparerait ces chaines ailleurs. */
  assert.match(p, /SNTS : 15\s000 FCFA, \+1\.25 % aujourd'hui, signal ACHAT \(confiance 72 %\)\./);
});

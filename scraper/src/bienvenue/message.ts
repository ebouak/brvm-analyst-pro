/**
 * Emails de bienvenue — CE QUI est écrit. Fonction pure, testée.
 *
 * Un lien, JAMAIS la vidéo en pièce jointe : 15 Mo en pièce jointe, c'est
 * lourd, souvent classé indésirable, et illisible sur mobile. L'affiche est
 * une image cliquable qui ouvre la leçon 0 sur le site ; la vidéo est servie
 * depuis notre stockage, sans lecteur tiers.
 *
 * AUCUN CHIFFRE DE MARCHÉ : un email d'accueil ne se périme pas, et n'a pas
 * à devenir une seconde source de cours à tenir juste.
 *
 * Deux versions du même contenu : HTML (l'affiche) et texte brut (pour les
 * messageries qui n'affichent pas les images, et pour les lecteurs d'écran).
 */
import type { Motif } from './selection.js';

export interface Liens {
  /** Page publique de la leçon 0. */
  lecon: string;
  /** Affiche de la vidéo (image publique). */
  affiche: string;
  /** Comparateur de SGI. */
  sgi: string;
}

export interface MessageBienvenue {
  sujet: string;
  texte: string;
  html: string;
}

const ACCROCHE: Record<Motif, { sujet: string; titre: string; intro: string }> = {
  inscription: {
    sujet: 'Bienvenue sur WESTBOURSE — votre leçon 0 est offerte',
    titre: 'Bienvenue sur WESTBOURSE',
    intro: 'Votre compte est créé. Pour bien commencer, une vidéo courte explique qui fait quoi sur le marché financier régional de l’UMOA : le régulateur, la Bourse, les intermédiaires, les émetteurs et les investisseurs.',
  },
  abonnement: {
    sujet: 'Votre abonnement WESTBOURSE est actif — commencez par la leçon 0',
    titre: 'Votre abonnement est actif',
    intro: 'Merci pour votre confiance. Avant d’explorer les analyses et la formation complète, la leçon 0 pose le décor : qui fait quoi sur le marché financier régional de l’UMOA.',
  },
};

const echappe = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function composer(motif: Motif, liens: Liens): MessageBienvenue {
  const a = ACCROCHE[motif];
  const texte = [
    a.titre,
    '',
    a.intro,
    '',
    `Regarder la leçon 0 : ${liens.lecon}`,
    '',
    `Pour investir en direct, tout commence par une SGI agréée. Comparez-les : ${liens.sgi}`,
    '',
    'Contenu pédagogique — pas un conseil en investissement.',
    'WESTBOURSE',
  ].join('\n');

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6f8">
<div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#102a43">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:.2em;color:#52667a">WESTBOURSE</p>
  <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25">${echappe(a.titre)}</h1>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.55">${echappe(a.intro)}</p>
  <a href="${echappe(liens.lecon)}" style="display:block;text-decoration:none">
    <img src="${echappe(liens.affiche)}" alt="Leçon 0 — Qui fait quoi sur le marché financier de l’UMOA (vidéo)" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;border:0">
  </a>
  <p style="margin:18px 0 26px;text-align:center">
    <a href="${echappe(liens.lecon)}" style="display:inline-block;background:#006fba;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">Regarder la leçon 0</a>
  </p>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.55">Pour investir en direct, tout commence par une SGI agréée. <a href="${echappe(liens.sgi)}" style="color:#006fba">Comparez-les sur WESTBOURSE</a>.</p>
  <p style="margin:0;font-size:12px;color:#52667a">Contenu pédagogique — pas un conseil en investissement.</p>
</div></body></html>`;

  return { sujet: a.sujet, texte, html };
}

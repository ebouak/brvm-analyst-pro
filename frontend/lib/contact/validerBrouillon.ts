/**
 * Contrôle d'un brouillon de réponse AVANT qu'il ne puisse partir chez un
 * visiteur — appliqué au brouillon IA ET, côté serveur, au texte final édité.
 *
 * Chaque règle vient d'un défaut réellement envoyé (relevé du 2026-10-21) :
 *  - 22/09 : la réponse commençait par « Voici une version mise à jour de votre
 *    réponse, incluant l'appel à l'action… » — préambule d'assistant collé ;
 *  - 22/09 et 28/09 : signature personnelle (deux téléphones, deux adresses
 *    postales, un Gmail personnel) envoyée à des inconnus ;
 *  - 28/09 : Markdown brut (`**WestBourse**`, lignes en `>`).
 * Un texte refusé n'est jamais « réparé » en silence : la raison est affichée.
 */

export const LONGUEUR_MAX = 4000;
export const ADRESSE_SUPPORT = 'support@westbourse.com';
const DOMAINES_AUTORISES = ['westbourse.com', 'amf-umoa.org', 'brvm.org'];

export type Verdict = { ok: true; texte: string } | { ok: false; raison: string };

function domaineAutorise(hote: string): boolean {
  const h = hote.toLowerCase().replace(/\.$/, '');
  return DOMAINES_AUTORISES.some((d) => h === d || h.endsWith(`.${d}`));
}

export function validerBrouillon(brut: string): Verdict {
  const texte = String(brut ?? '').replace(/\r\n/g, '\n').trim();
  if (!texte) return { ok: false, raison: 'Brouillon vide.' };
  if (texte.length > LONGUEUR_MAX) {
    return { ok: false, raison: `Trop long (${texte.length} caractères, maximum ${LONGUEUR_MAX}).` };
  }

  // Préambule ou méta-texte d'assistant : regardé au début, là où il se colle.
  const debut = texte.slice(0, 300).toLowerCase();
  if (
    /^(voici|voilà|bien sûr|certainement|absolument)\b/.test(debut) ||
    /version (mise à jour|améliorée|révisée|corrigée)|proposition de réponse|réponse proposée|en tant qu'(ia|assistant)/.test(debut)
  ) {
    return { ok: false, raison: "Le texte contient une phrase d'assistant (« Voici une version… ») au lieu de la réponse." };
  }
  if (/^-{3,}\s*$/m.test(texte) || /^objet\s*:/im.test(texte)) {
    return { ok: false, raison: 'Le texte contient un séparateur ou une ligne « Objet : » copiés.' };
  }

  // Markdown : un client email l'afficherait tel quel.
  if (/\*\*|__|`/.test(texte) || /^\s{0,3}#{1,6}\s/m.test(texte) || /^\s{0,3}>/m.test(texte) || /^\s*\|.*\|\s*$/m.test(texte)) {
    return { ok: false, raison: 'Mise en forme Markdown (**, #, >, tableau) : elle apparaîtrait telle quelle.' };
  }

  // Téléphones : préfixe international, ou 10 chiffres groupés par deux.
  // Un montant (« 20 000 000 ») est groupé par trois : il passe.
  if (/\+\d[\d\s.\-]{7,}\d/.test(texte) || /\b0\d(?:[\s.\-]?\d{2}){4}\b/.test(texte)) {
    return { ok: false, raison: 'Un numéro de téléphone figure dans le texte.' };
  }

  const emails = texte.match(/[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+/g) ?? [];
  const autre = emails.find((e) => e.toLowerCase() !== ADRESSE_SUPPORT);
  if (autre) return { ok: false, raison: `Adresse email non autorisée (seule ${ADRESSE_SUPPORT} peut figurer).` };

  const liens = texte.match(/\bhttps?:\/\/[^\s<>()"']+|\bwww\.[^\s<>()"']+/gi) ?? [];
  for (const brutLien of liens) {
    const lien = brutLien.replace(/[.,;:!?»]+$/, '');
    let hote = '';
    try {
      hote = new URL(lien.startsWith('http') ? lien : `https://${lien}`).hostname;
    } catch {
      return { ok: false, raison: `Lien illisible : ${lien}` };
    }
    if (!domaineAutorise(hote)) {
      return { ok: false, raison: `Lien hors des domaines autorisés (${DOMAINES_AUTORISES.join(', ')}) : ${hote}` };
    }
  }

  return { ok: true, texte };
}

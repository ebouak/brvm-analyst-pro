/**
 * Textes FIXES de l'assistant WhatsApp : aucun chiffre de marché, rien de
 * généré. Les quotas ne citent pas leur valeur : elle vit dans les drapeaux
 * et la changer ne doit pas rendre un texte faux.
 */

export type Palier = 'inconnu' | 'lie' | 'premium';

const SITE = 'https://www.westbourse.com';
const LIEN_COMPTE = `${SITE}/signup?next=%2Fparametres%2Falertes`;
const ILLIMITE = 'Toujours sans limite : *COURS SNTS*, *DIV SNTS*, *PALMARES*, *AIDE*.';

/** Le modèle écrit parfois du Markdown (**gras**) : WhatsApp attend *gras*. */
export function versWhatsapp(texte: string): string {
  return texte.replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^#{1,6}\s+/gm, '').slice(0, 4096);
}

export function texteQuota(palier: Palier): string {
  if (palier === 'inconnu') {
    return [
      'Vous avez utilisé votre question du jour à l’assistant.',
      ILLIMITE,
      '',
      `Pour davantage de questions chaque jour, créez un compte gratuit puis liez ce WhatsApp : ${LIEN_COMPTE}`,
    ].join('\n');
  }
  if (palier === 'lie') {
    return [
      'Vous avez utilisé vos questions du jour à l’assistant.',
      ILLIMITE,
      '',
      `*Premium* : davantage de questions, votre portefeuille et vos alertes ici même : ${SITE}/pricing`,
    ].join('\n');
  }
  return ['Vous avez atteint la limite quotidienne de questions à l’assistant. Elle se renouvelle demain.', ILLIMITE].join('\n');
}

export const TEXTE_PLAFOND_INCONNU = [
  'L’assistant est très sollicité aujourd’hui : réessayez demain.',
  ILLIMITE,
  '',
  `Les comptes inscrits restent prioritaires : ${LIEN_COMPTE}`,
].join('\n');

export const PIED_PREMIER =
  '\n\n_Réponse générée par IA à partir des données WESTBOURSE, pas un conseil en investissement. Tapez *EFFACER* pour effacer cet échange. Confidentialité : westbourse.com/confidentialite_';

export const TEXTE_EFFACE = 'C’est fait : l’historique de cette conversation est effacé.';

export const TEXTE_VOCAL_INCOMPRIS = 'Je n’ai pas pu comprendre cette note vocale. Pouvez-vous écrire votre question ?';

export const TEXTE_VOCAL_TROP_LONG = 'Cette note vocale est trop longue pour moi. Pouvez-vous la raccourcir ou écrire votre question ?';

export function texteSansChiffre(code: string | null): string {
  const lien = code ? `${SITE}/societes/${code}` : `${SITE}/actions`;
  return `Je préfère ne pas vous donner un chiffre que je ne peux pas vérifier. Les données à jour sont ici : ${lien}`;
}

export function consigneReecriture(refuses: string[]): string {
  return `[Contrôle automatique] Ta réponse contient des nombres absents des données des outils : ${refuses.join(', ')}. Réécris-la sans ces nombres et sans en ajouter d'autres.`;
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** EFFACER / OUBLIE / SUPPRIMER (éventuellement suivi de « mes messages », « historique »). */
export function estDemandeEffacer(texte: string): boolean {
  const t = sansAccent(texte.trim().replace(/^[/!]\s*/, '')).replace(/[.!]+$/, '');
  return /^(effacer|efface|oublie|oublier|supprimer)( (mes messages|l'historique|l’historique|historique|la conversation))?$/.test(t);
}

/** Premier code de valeur cité dans les retours d'outils, pour le lien de repli. */
export function codeCite(sources: string[]): string | null {
  for (const s of sources) {
    const m = /"code":"([A-Z]{3,6})"/.exec(s);
    if (m) return m[1]!;
  }
  return null;
}

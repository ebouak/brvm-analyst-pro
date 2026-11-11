/**
 * Orchestration du filtre de sortie de l'assistant IA (audit lot B).
 *
 * Choix : réponse COMPLÈTE avant diffusion, puis UNE réécriture, puis repli.
 * L'assistant diffusait le texte au fil de l'eau ; un filtre appliqué à la fin
 * d'un flux arrive trop tard : la recommandation a déjà été affichée (et peut
 * avoir été copiée). La route attend donc la réponse entière, la contrôle,
 * et ne transmet au navigateur qu'un texte qui a passé le filtre.
 *
 *  1. première rédaction ;
 *  2. si elle contient une recommandation : une seule réécriture, avec la
 *     consigne qui cite les extraits fautifs ;
 *  3. si la réécriture échoue ou recommande encore : réponse prudente fixe
 *     (aucun chiffre, renvoi vers une SGI ou un conseiller agréé).
 *
 * `generer` est injecté : la logique est testable sans fournisseur réel.
 */
import {
  REPONSE_PRUDENTE,
  consigneReecriture,
  detecterRecommandation,
  type MotifDetecte,
} from './filtreRecommandation';

export interface MessageConversation {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type IssueReponse = 'conforme' | 'reecrite' | 'repli';

export interface ReponseConforme {
  texte: string;
  issue: IssueReponse;
  /** Motifs détectés sur la première rédaction (vide si conforme). */
  motifs: MotifDetecte[];
}

/**
 * Renvoie null si AUCUN fournisseur n'a produit la première rédaction : c'est
 * une panne, pas une recommandation, et l'appelant la signale comme telle.
 */
export async function repondreSansRecommandation(
  messages: MessageConversation[],
  generer: (messages: MessageConversation[]) => Promise<string | null>,
): Promise<ReponseConforme | null> {
  const premiere = await generer(messages);
  if (premiere == null) return null;

  const verdict = detecterRecommandation(premiere);
  if (!verdict.recommandation) return { texte: premiere, issue: 'conforme', motifs: [] };

  const seconde = await generer([
    ...messages,
    { role: 'assistant', content: premiere },
    { role: 'user', content: consigneReecriture(verdict.motifs) },
  ]).catch(() => null);

  if (seconde != null && !detecterRecommandation(seconde).recommandation) {
    return { texte: seconde, issue: 'reecrite', motifs: verdict.motifs };
  }
  return { texte: REPONSE_PRUDENTE, issue: 'repli', motifs: verdict.motifs };
}

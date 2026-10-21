import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSystemPrompt } from '@/lib/whatsappAgent/systemPrompt';
import { callAgentLlm, type ChatMessage } from '@/lib/whatsappAgent/callAgentLlm';
import { OUTILS, executerOutil } from '@/lib/agent/outils';
import { FICHE_PRODUIT } from './ficheProduit';
import { validerBrouillon } from './validerBrouillon';

/**
 * Brouillon de réponse à un message du formulaire de contact. Il n'est JAMAIS
 * envoyé tel quel : l'exploitant le relit, le corrige et clique « Envoyer »
 * (décision du 2026-10-21).
 *
 * Outils : marché seulement. L'auteur du message n'est pas authentifié — un
 * outil de compte (portefeuille, alertes) n'a aucun sens ici, et il est refusé
 * à l'exécution même si un modèle le réclamait.
 */
const OUTILS_MARCHE = new Set([
  'cours_valeur',
  'historique_valeur',
  'dividendes_valeur',
  'actualites_valeur',
  'liquidite_valeur',
  'palmares_seance',
]);

export interface MessageContact {
  prenom: string | null;
  page: string | null;
  message: string;
}

export type ResultatBrouillon = { brouillon: string } | { brouillon: ''; raison: string };

export async function genererBrouillon(db: SupabaseClient, m: MessageContact): Promise<ResultatBrouillon> {
  const systeme = [
    buildSystemPrompt({ watchlist: [], canal: 'email', outils: true }),
    FICHE_PRODUIT,
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: systeme },
    {
      role: 'user',
      content: `Message reçu via le formulaire de contact${m.page ? ` (page ${m.page})` : ''}, de ${
        m.prenom ? `« ${m.prenom} »` : 'un visiteur sans prénom'
      } :\n<<<\n${m.message}\n>>>\n\nRédige le brouillon de réponse.`,
    },
  ];

  const outils = {
    definitions: OUTILS.filter((o) => OUTILS_MARCHE.has(o.function.name)),
    executer: (nom: string, args: Record<string, unknown>) =>
      OUTILS_MARCHE.has(nom)
        ? executerOutil(db, '', nom, args)
        : Promise.resolve({ erreur: 'Outil indisponible dans ce contexte.' }),
  };

  let raison = 'Aucun fournisseur LLM disponible.';
  for (let essai = 0; essai < 2; essai++) {
    const sortie = await callAgentLlm(messages, outils);
    if (!sortie) return { brouillon: '', raison };
    const verdict = validerBrouillon(sortie);
    if (verdict.ok) return { brouillon: verdict.texte };
    raison = verdict.raison;
    // Une seule seconde chance, avec la raison du refus.
    messages.push(
      { role: 'assistant', content: sortie },
      { role: 'user', content: `Ce brouillon est refusé : ${verdict.raison} Réécris-le entièrement en respectant les règles.` },
    );
  }
  return { brouillon: '', raison };
}

import 'server-only';
import { createHmac } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { executerOutil } from '@/lib/agent/outils';
import { passerelleWhatsapp } from './passerelle';
import { issueCommande, rendreCommande, type Commande, type IssueCommande } from './commandes';

/**
 * Répond à une commande rapide WhatsApp (lot A). Les chiffres viennent des
 * outils de l'agent (lib/agent/outils.ts) : une seule source pour l'agent et
 * les commandes. Ne lève jamais — le webhook doit toujours être acquitté.
 *
 * Au-delà de LIMITE_HEURE commandes par conversation, AUCUNE réponse : répondre
 * à chaque excès amplifierait l'envoi, et un volume sortant anormal fait bannir
 * un numéro non officiel. Journal sans contenu ni numéro (migration 0161).
 */

const LIMITE_HEURE = 30;

const OUTIL: Record<Exclude<Commande['type'], 'aide'>, string> = {
  cours: 'cours_valeur',
  dividendes: 'dividendes_valeur',
  palmares: 'palmares_seance',
};

async function journaliser(commande: Commande['type'], resultat: IssueCommande | 'limite'): Promise<void> {
  const { error } = await getServiceClient().from('whatsapp_commandes').insert({ commande, resultat });
  if (error) console.warn('[whatsapp] journal des commandes indisponible :', error.code ?? error.message);
}

export async function repondreCommande(chatId: string, cmd: Commande): Promise<void> {
  try {
    const cle = createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha').update(`commande:${chatId}`).digest('hex');
    const { allowed } = await checkRateLimit({ route: 'whatsapp-commande', ip: cle, maxHits: LIMITE_HEURE, windowSeconds: 3600 });
    if (!allowed) {
      await journaliser(cmd.type, 'limite');
      return;
    }

    let res: Record<string, unknown> | null = null;
    if (cmd.type !== 'aide') {
      const args = cmd.type === 'palmares' ? { critere: cmd.critere } : { code: cmd.valeur };
      // Aucun de ces trois outils ne lit de donnée utilisateur : pas d'identifiant à passer.
      res = (await executerOutil(getServiceClient(), '', OUTIL[cmd.type], args)) as Record<string, unknown> | null;
    }

    const texte = rendreCommande(cmd, res, { chaineUrl: process.env.WHATSAPP_CHAINE_URL || null });
    const envoi = await passerelleWhatsapp().envoyerTexte(chatId, texte);
    if (!envoi.ok) console.warn('[whatsapp] réponse à une commande non envoyée :', envoi.erreur);
    await journaliser(cmd.type, envoi.ok ? issueCommande(cmd, res) : 'erreur');
  } catch (e) {
    console.error('[whatsapp] commande non traitée :', (e as Error).message);
  }
}

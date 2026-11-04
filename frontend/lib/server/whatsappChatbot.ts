import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkFeature, getFlag } from '@/lib/server/featureGate';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { isAdminEmail } from '@/lib/server/admin-emails';
import { transcrireAudio, AUDIO_MAX_OCTETS } from '@/lib/server/transcription';
import { buildSystemPrompt } from '@/lib/whatsappAgent/systemPrompt';
import { getWatchlistContext } from '@/lib/whatsappAgent/watchlistContext';
import { callAgentLlm, type ChatMessage } from '@/lib/whatsappAgent/callAgentLlm';
import { executerOutilChatbot, outilsChatbot } from '@/lib/agent/outilsChatbot';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { userParChat } from '@/lib/whatsapp/liaisons';
import { urlFichierPublique, type FichierWaha } from '@/lib/whatsapp/waha';
import { masquerDonneesPersonnelles } from '@/lib/whatsapp/chatbot/chiffres';
import { repondreChatbot, type DepsChatbot, type IssueChatbot, type MessageLlm, type OptionsChatbot } from '@/lib/whatsapp/chatbot/repondre';
import { texteQuota, TEXTE_EFFACE, TEXTE_VOCAL_INCOMPRIS, TEXTE_VOCAL_TROP_LONG } from '@/lib/whatsapp/chatbot/textes';

/**
 * Branchement serveur de l'assistant WhatsApp ouvert à tous (spec 2026-11-04).
 * Le cœur (lib/whatsapp/chatbot/repondre.ts) est pur ; ici vivent la base, la
 * cascade LLM, la passerelle et la transcription. Rien ne lève vers la route.
 */

const HISTORIQUE = 10;
const FENETRE_MS = 72 * 3600 * 1000;
const entier = (v: string | undefined, defaut: number) => {
  const n = Number(v ?? defaut);
  return Number.isInteger(n) && n >= 0 ? n : defaut;
};

/** Pseudonyme de la conversation (HMAC) : la mémoire n'est jamais indexée par le numéro. */
export function hacherChat(chatId: string): string {
  return createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha').update(`conversation:${chatId}`).digest('hex');
}

/** Drapeau non déclaré ou illisible ⇒ coupé. */
export async function chatbotActif(): Promise<boolean> {
  const f = await getFlag('whatsapp_chatbot').catch(() => null);
  return !!f && f.acces !== 'disabled';
}

async function memoriser(db: SupabaseClient, chatHash: string, userId: string | null, lignes: MessageLlm[]): Promise<void> {
  const t0 = Date.now();
  // Horodatages distincts : l'ordre de relecture ne dépend pas d'une égalité.
  const { error } = await db.from('whatsapp_conversations').insert(
    lignes.map((l, i) => ({ user_id: userId, chat_hash: chatHash, role: l.role, contenu: l.content, created_at: new Date(t0 + i).toISOString() })),
  );
  if (error) throw new Error('memoire');
}

function depsChatbot(chatId: string): DepsChatbot {
  const db = getServiceClient();
  const h = hacherChat(chatId);
  let profil: { email: string | null; isPremium: boolean } | null = null;

  return {
    identifier: async () => {
      const userId = await userParChat(db, chatId).catch(() => null);
      if (!userId) return { palier: 'inconnu', userId: null, perso: false };
      const [{ data: p }, { data: prefs }] = await Promise.all([
        db.from('profiles').select('is_premium, email').eq('id', userId).maybeSingle(),
        db.from('notification_prefs').select('agent_optin').eq('user_id', userId).maybeSingle(),
      ]);
      profil = { email: (p?.email as string | null) ?? null, isPremium: Boolean(p?.is_premium) };
      const premium = profil.isPremium || isAdminEmail(profil.email);
      return { palier: premium ? 'premium' : 'lie', userId, perso: premium && Boolean(prefs?.agent_optin) };
    },
    quota: async (id) => {
      if (!id.userId) return (await checkRateLimit({ route: 'whatsapp-ia', ip: h, maxHits: 1, windowSeconds: 86_400 })).allowed;
      return (await checkFeature('whatsapp_agent', { id: id.userId, email: profil?.email ?? null, isPremium: profil?.isPremium ?? false })).allowed;
    },
    budget: async (id) => {
      const reserver = async (usage: string, plafond: number) => {
        const { data, error } = await db.rpc('jev_reserver_budget', { p_usage: usage, p_plafond: plafond });
        if (error) throw new Error('budget');
        return data === true;
      };
      try {
        if (id.palier === 'inconnu' && !(await reserver('whatsapp_ia_inconnu', entier(process.env.WHATSAPP_IA_PLAFOND_INCONNU_JOUR, 150)))) {
          return 'plafond_inconnu';
        }
        return (await reserver('whatsapp_ia', entier(process.env.WHATSAPP_IA_PLAFOND_JOUR, 300))) ? 'ok' : 'refuse';
      } catch {
        return 'erreur';
      }
    },
    historique: async () => {
      const { data, error } = await db
        .from('whatsapp_conversations')
        .select('role, contenu')
        .eq('chat_hash', h)
        .gte('created_at', new Date(Date.now() - FENETRE_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(HISTORIQUE);
      if (error) throw new Error('historique');
      return (data ?? []).reverse().map((r) => ({ role: r.role as 'user' | 'assistant', content: r.contenu as string }));
    },
    systeme: async (id) => {
      const watchlist = id.perso && id.userId ? await getWatchlistContext(db, id.userId).catch(() => []) : [];
      return buildSystemPrompt({ watchlist, canal: 'whatsapp', outils: true, premium: id.perso, chatbot: true });
    },
    llm: async (messages, id) => {
      const sources: string[] = [];
      const texte = await callAgentLlm(messages as ChatMessage[], {
        definitions: outilsChatbot(id.perso),
        executer: async (nom, args) => {
          const r = await executerOutilChatbot(db, id.userId, id.perso, nom, args);
          sources.push(JSON.stringify(r));
          return r;
        },
      });
      return { texte, sources };
    },
    enregistrer: (id, lignes) => memoriser(db, h, id.userId, lignes),
    envoyer: async (t) => (await passerelleWhatsapp().envoyerTexte(chatId, t)).ok,
    journal: (e) => console.warn('[whatsapp-chatbot]', e),
  };
}

export function repondreChatbotWhatsapp(chatId: string, texte: string, o?: OptionsChatbot): Promise<IssueChatbot> {
  return repondreChatbot(texte, depsChatbot(chatId), o).catch((e) => {
    console.error('[whatsapp-chatbot] non traité :', (e as Error).message);
    return 'console' as const;
  });
}

/** Réponse sans IA (commande, Jev) gardée en mémoire : l'assistant suit le fil. */
export async function memoriserEchange(chatId: string, question: string, reponse: string): Promise<void> {
  try {
    const db = getServiceClient();
    const userId = await userParChat(db, chatId).catch(() => null);
    await memoriser(db, hacherChat(chatId), userId, [
      { role: 'user', content: masquerDonneesPersonnelles(question) },
      { role: 'assistant', content: reponse },
    ]);
  } catch {
    console.warn('[whatsapp-chatbot] memoire_non_ecrite');
  }
}

/** Commande EFFACER : toute la mémoire de cette conversation. */
export async function effacerConversation(chatId: string): Promise<void> {
  const { error } = await getServiceClient().from('whatsapp_conversations').delete().eq('chat_hash', hacherChat(chatId));
  if (error) console.error('[whatsapp-chatbot] effacement impossible :', error.code ?? error.message);
  await passerelleWhatsapp()
    .envoyerTexte(chatId, error ? 'L’effacement a échoué. Réessayez dans un instant.' : TEXTE_EFFACE)
    .catch(() => null);
}

export type IssueVocal = { etat: 'texte'; texte: string } | { etat: 'repondu' };

/**
 * Note vocale : décompte d'UNE question IA, puis téléchargement immédiat (WAHA
 * garde le fichier 180 s) et transcription. L'audio n'est jamais stocké.
 */
export async function traiterVocal(chatId: string, fichier: FichierWaha): Promise<IssueVocal> {
  const deps = depsChatbot(chatId);
  const repondre = async (t: string): Promise<IssueVocal> => {
    await deps.envoyer(t).catch(() => false);
    return { etat: 'repondu' };
  };
  try {
    const id = await deps.identifier();
    if (!(await deps.quota(id).catch(() => true))) return repondre(texteQuota(id.palier));
    const url = urlFichierPublique(fichier.url, process.env.WAHA_URL ?? '');
    if (!url) return repondre(TEXTE_VOCAL_INCOMPRIS);
    const r = await fetch(url, { headers: { 'X-Api-Key': process.env.WAHA_API_KEY ?? '' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) {
      deps.journal(`vocal_http_${r.status}`);
      return repondre(TEXTE_VOCAL_INCOMPRIS);
    }
    if (Number(r.headers.get('content-length') ?? 0) > AUDIO_MAX_OCTETS) return repondre(TEXTE_VOCAL_TROP_LONG);
    const octets = Buffer.from(await r.arrayBuffer());
    if (octets.length > AUDIO_MAX_OCTETS) return repondre(TEXTE_VOCAL_TROP_LONG);
    const texte = await transcrireAudio(octets, fichier.mimetype).catch((e) => {
      deps.journal(`transcription_${(e as Error).message}`);
      return null;
    });
    return texte ? { etat: 'texte', texte } : repondre(TEXTE_VOCAL_INCOMPRIS);
  } catch (e) {
    deps.journal(`vocal_${(e as Error).message}`);
    return repondre(TEXTE_VOCAL_INCOMPRIS);
  }
}

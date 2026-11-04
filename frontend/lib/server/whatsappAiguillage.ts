import 'server-only';
import { createHmac } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createPublicClient } from '@/lib/supabase/public';
import { getFlag } from '@/lib/server/featureGate';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { appelerJev } from '@/lib/jev/client';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { repondreCommande } from '@/lib/whatsapp/repondreCommande';
import type { DepsAiguillage } from '@/lib/whatsapp/aiguillage/aiguiller';
import type { Decision } from '@/lib/whatsapp/aiguillage/decider';
import type { SocieteIdentite } from '@/lib/whatsapp/aiguillage/requete';
import { TEXTE_REFUS_CONSEIL, TEXTE_SALUTATION, texteClarification } from '@/lib/whatsapp/aiguillage/textes';

const QUOTA_HEURE = 30;
const plafondJour = () => {
  const n = Number(process.env.WHATSAPP_JEV_PLAFOND_JOUR ?? 300);
  return Number.isInteger(n) && n >= 0 ? n : 300;
};

/** Identités des sociétés cotées (code, nom, secteur, pays), relues au plus toutes les 6 h. */
const identitesSocietes = unstable_cache(
  async (): Promise<SocieteIdentite[]> => {
    const { data, error } = await createPublicClient()
      .from('brvm_instruments')
      .select('code, designation, secteur, pays')
      .eq('type', 'action')
      .eq('actif', true)
      .order('code');
    if (error || !data?.length) throw new Error('societes_indisponibles');
    return data.map((r) => ({ code: r.code as string, nom: (r.designation as string) ?? (r.code as string), secteur: r.secteur ?? null, pays: r.pays ?? null }));
  },
  ['whatsapp-identites-societes-v1'],
  { revalidate: 6 * 3600 },
);

export function depsAiguillageWhatsapp(): DepsAiguillage {
  return {
    // Drapeau non déclaré ⇒ coupé (prudence) ; sans clé TypeSafe ⇒ coupé (rien ne serait réservé pour rien).
    actif: async () => {
      if (!process.env.TYPESAFE_API_KEY) return false;
      const f = await getFlag('whatsapp_jev');
      return !!f && f.acces !== 'disabled';
    },
    societes: () => identitesSocietes(),
    quota: async (chatId) => {
      const cle = createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha').update(`jev:${chatId}`).digest('hex');
      return (await checkRateLimit({ route: 'whatsapp-jev', ip: cle, maxHits: QUOTA_HEURE, windowSeconds: 3600 })).allowed;
    },
    reserverBudget: async () => {
      const { data, error } = await getServiceClient().rpc('jev_reserver_budget', { p_usage: 'whatsapp', p_plafond: plafondJour() });
      if (error) return 'erreur';
      return data === true ? 'ok' : 'refuse';
    },
    jev: (corps, signal) => appelerJev(corps, signal),
    journaliser: async (e) => {
      const { error } = await getServiceClient().from('whatsapp_aiguillages').insert(e);
      if (error) throw new Error('journal');
    },
    journal: (evenement) => console.warn('[whatsapp-jev]', evenement),
  };
}

/**
 * Exécute une décision qui se suffit à elle-même. Renvoie le texte envoyé, ou null si le message
 * doit suivre le chemin actuel (agent, console) ou si l'envoi a échoué :
 * un message n'est jamais perdu.
 */
export async function appliquerDecision(chatId: string, d: Decision): Promise<string | null> {
  const envoyer = async (texte: string) => ((await passerelleWhatsapp().envoyerTexte(chatId, texte)).ok ? texte : null);
  switch (d.type) {
    case 'commande':
      return repondreCommande(chatId, d.commande);
    case 'clarification':
      return envoyer(texteClarification(d.intention, d.codes));
    case 'refus_conseil':
      return envoyer(TEXTE_REFUS_CONSEIL);
    case 'salutation':
      return envoyer(TEXTE_SALUTATION);
    default:
      return null;
  }
}

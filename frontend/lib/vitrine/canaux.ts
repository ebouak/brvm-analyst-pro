import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { getFlag } from '@/lib/server/featureGate';

/**
 * Lectures de la section « La BRVM vient à vous » (§3.13). Toute erreur rend
 * null : la carte retombe sur la séance ou retire la ligne, la page ne tombe pas.
 */

export interface BriefPublie { dateMarche: string; contenu: string; envoyeLe: string | null }

/** Dernier brief de séance publié (table brief_daily, lecture publique). */
export async function chargerBrief(): Promise<BriefPublie | null> {
  try {
    const { data, error } = await createPublicClient()
      .from('brief_daily')
      .select('date_marche, contenu, sent_at')
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.contenu) return null;
    return { dateMarche: String(data.date_marche), contenu: String(data.contenu), envoyeLe: (data.sent_at as string | null) ?? null };
  } catch {
    return null;
  }
}

/**
 * Questions à l'assistant WhatsApp par jour avec un compte gratuit lié, lues
 * dans `feature_flags` (`whatsapp_agent.quota_free`). null si la fonction est
 * coupée, réservée ou illisible : la ligne disparaît plutôt que d'annoncer un
 * quota supposé.
 */
export async function quotaWhatsappGratuit(): Promise<number | null> {
  try {
    const f = await getFlag('whatsapp_agent');
    if (!f || f.acces !== 'free' || f.quota_free == null || f.quota_free <= 0) return null;
    return f.quota_free;
  } catch {
    return null;
  }
}

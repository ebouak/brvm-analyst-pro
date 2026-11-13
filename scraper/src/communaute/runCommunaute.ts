/**
 * Relevé automatique de la communauté : nombre de membres du canal Telegram
 * public (`getChatMemberCount`, bot déjà administrateur du canal). Écrit une
 * ligne datée du jour dans `communaute_releves` (source 'auto', migration 0218).
 *
 * TikTok, Facebook et LinkedIn sont saisis à la main dans /admin/reseaux tant
 * qu'aucune autorisation d'API ne permet de les lire. Un échec lève : le run
 * passe au rouge plutôt que de laisser l'accueil afficher un chiffre qui vieillit
 * sans que personne le sache (il disparaît de toute façon après 45 jours).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';

export function lireNombreMembres(corps: unknown): number {
  const r = corps as { ok?: boolean; result?: unknown; description?: string };
  if (!r?.ok || typeof r.result !== 'number' || !Number.isInteger(r.result) || r.result < 0) {
    throw new Error(`Telegram : réponse inattendue${r?.description ? ` (${r.description})` : ''}`);
  }
  return r.result;
}

export async function runCommunaute(opts: { mock?: boolean } = {}): Promise<{ telegram: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const canal = process.env.TELEGRAM_CANAL || '@westbourse7';
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN absent');
  const resp = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(canal)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  // L'URL porte le jeton du bot : seule la description de Telegram est relayée.
  const membres = lireNombreMembres(await resp.json().catch(() => null));
  const releve_le = new Date().toISOString().slice(0, 10);
  if (opts.mock) {
    logger.info({ canal, membres, releve_le }, 'mock : relevé Telegram non écrit');
    return { telegram: membres };
  }
  const { error } = await getSupabase()
    .from('communaute_releves')
    .upsert({ reseau: 'telegram', releve_le, abonnes: membres, source: 'auto' }, { onConflict: 'reseau,releve_le' });
  if (error) throw new Error(`communaute_releves (migration 0218 appliquée ?) : ${error.message}`);
  logger.info({ canal, membres, releve_le }, 'relevé Telegram enregistré');
  return { telegram: membres };
}

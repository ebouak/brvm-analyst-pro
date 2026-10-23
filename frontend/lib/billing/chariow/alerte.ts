import 'server-only';
import { alerterExploitant as alerte } from '@/lib/server/alerteExploitant';

/**
 * Alerte d'EXPLOITATION (conversation Telegram de l'exploitant,
 * TELEGRAM_CHAT_ID) pour un paiement qui demande un regard humain : vente
 * orpheline, montant incohérent, licence révoquée.
 *
 * Aucune donnée client : ni nom, ni email, ni téléphone — seulement des
 * références (sal_…, identifiant de transaction) et le motif.
 * Un canal non configuré est ignoré ; l'alerte ne fait jamais échouer le webhook.
 * Implémentation commune : lib/server/alerteExploitant.ts (préfixe « 💳 Chariow »).
 */
export async function alerterExploitant(texte: string): Promise<void> {
  await alerte(texte, '💳 Chariow');
}

/**
 * Relance des messages du formulaire de contact restés sans réponse
 * (spec docs/superpowers/specs/2026-10-21-contact-reponses-design.md §3.5).
 *
 * Pourquoi : au 2026-10-21, 4 visiteurs sur 7 n'avaient jamais eu la réponse
 * que l'accusé de réception leur promettait « sous 2 jours ouvrés ». Rien ne le
 * signalait. On relance dès qu'UN jour ouvré est passé.
 *
 * Le message Telegram ne contient AUCUNE donnée personnelle (ni prénom, ni
 * adresse, ni contenu) : un nombre, une ancienneté et le lien de la console.
 *
 * ⚠️ DUPLICATION ASSUMÉE : `joursOuvresEcoules` / `enRetard` sont copiés de
 * frontend/lib/contact/delai.ts (deux paquets TS distincts, comme
 * src/hebdo/pure/). Toute correction est à reporter des deux côtés.
 */
import { getSupabase } from '../persistence/supabase.js';
import { sendTelegramText } from '../alerts/channels.js';

const JOUR_MS = 24 * 60 * 60 * 1000;
export const SEUIL_RETARD_JOURS = 1;
export const LIEN_CONSOLE = 'https://www.westbourse.com/admin/contact';

export function joursOuvresEcoules(depuis: Date, maintenant: Date): number {
  let t = depuis.getTime();
  const fin = maintenant.getTime();
  if (!(fin > t)) return 0;
  let ms = 0;
  while (t < fin) {
    const d = new Date(t);
    const minuitSuivant = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    const bout = Math.min(minuitSuivant, fin);
    const jour = d.getUTCDay();
    if (jour !== 0 && jour !== 6) ms += bout - t;
    t = bout;
  }
  return ms / JOUR_MS;
}

export function composerRappel(
  enAttente: { created_at: string }[],
  maintenant: Date,
): { enRetard: number; texte: string } | null {
  const anciennetes = enAttente
    .map((m) => joursOuvresEcoules(new Date(m.created_at), maintenant))
    .filter((j) => j > SEUIL_RETARD_JOURS);
  if (anciennetes.length === 0) return null;
  const n = anciennetes.length;
  const max = Math.max(...anciennetes);
  const texte = [
    `${n} message${n > 1 ? 's' : ''} du formulaire sans réponse depuis plus d'un jour ouvré`,
    `(le plus ancien : ${max.toFixed(1).replace('.', ',')} jours ouvrés).`,
    "L'accusé de réception promet une réponse sous 2 jours ouvrés.",
    LIEN_CONSOLE,
  ].join('\n');
  return { enRetard: n, texte };
}

export async function runRappelContact(opts: { mock: boolean }): Promise<{
  enAttente: number;
  enRetard: number;
  envoye: boolean;
}> {
  if (opts.mock) {
    const r = composerRappel([{ created_at: new Date(Date.now() - 5 * JOUR_MS).toISOString() }], new Date());
    console.log('[contact:rappel] (mock)\n' + (r?.texte ?? 'rien à signaler'));
    return { enAttente: 1, enRetard: r?.enRetard ?? 0, envoye: false };
  }

  const { data, error } = await getSupabase()
    .from('contact_messages')
    .select('created_at')
    .in('statut', ['nouveau', 'envoi']);
  // Une table illisible est une PANNE, pas « rien à signaler » : un rappel
  // muet est exactement le défaut que ce job doit empêcher.
  if (error) throw new Error(`contact_messages illisible : ${error.message}`);

  const enAttente = data ?? [];
  const rappel = composerRappel(enAttente, new Date());
  if (!rappel) return { enAttente: enAttente.length, enRetard: 0, envoye: false };

  const res = await sendTelegramText({
    subject: 'Contact WESTBOURSE — messages en attente',
    body: rappel.texte,
    operateur: true,
  });
  if (!res || res.status !== 'sent') {
    throw new Error(`relance Telegram non envoyée : ${res ? res.error ?? res.status : 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID absent'}`);
  }
  return { enAttente: enAttente.length, enRetard: rappel.enRetard, envoye: true };
}

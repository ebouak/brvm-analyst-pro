/**
 * Contrôle des réponses du formulaire de contact
 * (spec docs/superpowers/specs/2026-10-21-contact-reponses-design.md §3.5).
 *
 * Deux garanties, demandées le 2026-10-21 :
 *  1. TOUTE demande reçoit une réponse — au 21/10, 4 visiteurs sur 7 n'avaient
 *     jamais eu la réponse promise « sous 2 jours ouvrés », et rien ne le disait ;
 *  2. le destinataire a REÇU la réponse — « envoyé » ne prouve pas « reçu »
 *     (adresse mal saisie, boîte pleine, filtre anti-spam).
 *
 * Signale, par Telegram exploitant :
 *  - les demandes sans réponse depuis plus d'un jour ouvré ;
 *  - les réponses rejetées ou signalées comme spam (une alerte par réponse) ;
 *  - les réponses sans confirmation de remise après 24 h — le signe que le
 *    webhook Resend ne fonctionne pas : sans ce contrôle, il tomberait en panne
 *    EN SILENCE et la garantie 2 ne vaudrait plus rien ;
 *  - les envois restés bloqués « en cours ».
 *
 * Le message ne contient AUCUNE donnée personnelle : des nombres et le lien de
 * la console.
 *
 * ⚠️ DUPLICATION ASSUMÉE : `joursOuvresEcoules` est copié de
 * frontend/lib/contact/delai.ts (deux paquets TS distincts, comme
 * src/hebdo/pure/). Toute correction est à reporter des deux côtés.
 */
import { getSupabase } from '../persistence/supabase.js';
import { sendTelegramText } from '../alerts/channels.js';

const JOUR_MS = 24 * 60 * 60 * 1000;
export const SEUIL_RETARD_JOURS = 1;
export const DELAI_CONFIRMATION_MS = 24 * 60 * 60 * 1000;
/** Au-delà, une remise non confirmée n'est plus signalée chaque jour. */
export const FENETRE_CONFIRMATION_MS = 7 * JOUR_MS;
export const LIEN_CONSOLE = 'https://www.westbourse.com/admin/contact';

export type Livraison = 'envoye' | 'retarde' | 'remis' | 'rejete' | 'spam';

export interface LigneContact {
  id: string;
  statut: 'nouveau' | 'envoi' | 'repondu' | 'clos' | 'spam';
  created_at: string;
  repondu_at: string | null;
  livraison: Livraison | null;
  livraison_alerte_at: string | null;
}

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

export interface Rappel {
  texte: string;
  enRetard: number;
  bloques: number;
  nonConfirmes: number;
  /** Réponses rejetées / spam à signaler maintenant — marquées ensuite pour ne pas re-signaler. */
  nonRemisIds: string[];
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function composerRappel(lignes: LigneContact[], maintenant: Date): Rappel | null {
  const t = maintenant.getTime();

  const anciennetes = lignes
    .filter((l) => l.statut === 'nouveau')
    .map((l) => joursOuvresEcoules(new Date(l.created_at), maintenant))
    .filter((j) => j > SEUIL_RETARD_JOURS);
  const bloques = lignes.filter((l) => l.statut === 'envoi').length;
  const nonRemisIds = lignes
    .filter((l) => l.statut === 'repondu' && (l.livraison === 'rejete' || l.livraison === 'spam') && !l.livraison_alerte_at)
    .map((l) => l.id);
  const nonConfirmes = lignes.filter((l) => {
    if (l.statut !== 'repondu' || !l.repondu_at) return false;
    // Seules les réponses SUIVIES (« envoye » posé à l'envoi depuis 0159) peuvent
    // être « non confirmées » ; null = envoyée avant le suivi, jamais confirmable.
    if (l.livraison !== 'envoye' && l.livraison !== 'retarde') return false;
    const age = t - new Date(l.repondu_at).getTime();
    return age > DELAI_CONFIRMATION_MS && age < FENETRE_CONFIRMATION_MS;
  }).length;

  if (!anciennetes.length && !bloques && !nonRemisIds.length && !nonConfirmes) return null;

  const lignesTexte: string[] = [];
  if (anciennetes.length) {
    const max = Math.max(...anciennetes);
    lignesTexte.push(
      `• ${pluriel(anciennetes.length, 'demande')} sans réponse depuis plus d'un jour ouvré ` +
        `(la plus ancienne : ${max.toFixed(1).replace('.', ',')} jours ouvrés). L'accusé promet une réponse sous 2 jours ouvrés.`,
    );
  }
  if (nonRemisIds.length) {
    lignesTexte.push(
      `• ${pluriel(nonRemisIds.length, 'réponse')} qui n'est pas arrivée (adresse rejetée ou signalée comme spam) : ` +
        `vérifiez l'adresse ou joignez la personne autrement.`,
    );
  }
  if (nonConfirmes) {
    lignesTexte.push(
      `• ${pluriel(nonConfirmes, 'réponse')} en remise non confirmée après 24 h : vérifiez que le webhook Resend ` +
        `(/api/webhooks/resend) reçoit bien les événements.`,
    );
  }
  if (bloques) {
    lignesTexte.push(`• ${pluriel(bloques, 'envoi')} resté bloqué « en cours » : rouvrez le message dans la console.`);
  }

  return {
    texte: [...lignesTexte, LIEN_CONSOLE].join('\n'),
    enRetard: anciennetes.length,
    bloques,
    nonConfirmes,
    nonRemisIds,
  };
}

export async function runRappelContact(opts: { mock: boolean }): Promise<{
  examines: number;
  enRetard: number;
  nonRemis: number;
  nonConfirmes: number;
  bloques: number;
  envoye: boolean;
}> {
  if (opts.mock) {
    const r = composerRappel(
      [
        { id: 'm1', statut: 'nouveau', created_at: new Date(Date.now() - 5 * JOUR_MS).toISOString(), repondu_at: null, livraison: null, livraison_alerte_at: null },
        { id: 'm2', statut: 'repondu', created_at: new Date(Date.now() - 3 * JOUR_MS).toISOString(), repondu_at: new Date(Date.now() - 2 * JOUR_MS).toISOString(), livraison: 'rejete', livraison_alerte_at: null },
      ],
      new Date(),
    );
    console.log('[contact:rappel] (mock)\n' + (r?.texte ?? 'rien à signaler'));
    return { examines: 2, enRetard: r?.enRetard ?? 0, nonRemis: r?.nonRemisIds.length ?? 0, nonConfirmes: r?.nonConfirmes ?? 0, bloques: r?.bloques ?? 0, envoye: false };
  }

  const db = getSupabase();
  const depuis = new Date(Date.now() - FENETRE_CONFIRMATION_MS).toISOString();
  const { data, error } = await db
    .from('contact_messages')
    .select('id, statut, created_at, repondu_at, livraison, livraison_alerte_at')
    .or(`statut.in.(nouveau,envoi),repondu_at.gte.${depuis},and(livraison.in.(rejete,spam),livraison_alerte_at.is.null)`);
  // Une table illisible est une PANNE, pas « rien à signaler » : un contrôle
  // muet est exactement le défaut que ce job doit empêcher.
  if (error) throw new Error(`contact_messages illisible : ${error.message}`);

  const lignes = (data ?? []) as LigneContact[];
  const rappel = composerRappel(lignes, new Date());
  const bilan = {
    examines: lignes.length,
    enRetard: rappel?.enRetard ?? 0,
    nonRemis: rappel?.nonRemisIds.length ?? 0,
    nonConfirmes: rappel?.nonConfirmes ?? 0,
    bloques: rappel?.bloques ?? 0,
    envoye: false,
  };
  if (!rappel) return bilan;

  const res = await sendTelegramText({
    subject: 'Contact WESTBOURSE — contrôle des réponses',
    body: rappel.texte,
    operateur: true,
  });
  if (!res || res.status !== 'sent') {
    throw new Error(`alerte Telegram non envoyée : ${res ? res.error ?? res.status : 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID absent'}`);
  }

  // Une réponse non remise n'est signalée qu'UNE fois — marquée APRÈS l'envoi
  // de l'alerte, pour qu'un échec Telegram la fasse signaler au passage suivant.
  if (rappel.nonRemisIds.length) {
    const { error: e2 } = await db
      .from('contact_messages')
      .update({ livraison_alerte_at: new Date().toISOString() })
      .in('id', rappel.nonRemisIds);
    if (e2) throw new Error(`marquage des alertes impossible : ${e2.message}`);
  }
  return { ...bilan, envoye: true };
}

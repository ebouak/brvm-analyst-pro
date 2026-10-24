import 'server-only';
import { sendWhatsAppReply } from '@/lib/whatsappAgent/sendWhatsapp';
import { chatIdDepuisTelephone } from './waha';

/**
 * Interface d'envoi WhatsApp UNIQUE. Aujourd'hui la passerelle non officielle
 * WAHA (serveur westbourse-wa) ; demain l'API officielle Meta, sans toucher aux
 * fonctionnalités qui l'utilisent. Choix : WHATSAPP_PASSERELLE (`waha` | `meta`),
 * à défaut `waha` dès que WAHA_URL est défini.
 *
 * N'y figure que ce que les DEUX passerelles savent faire. La publication sur une
 * Chaîne (non officielle seulement) vivra à part, en P4.
 * Aucun contenu de message n'est journalisé.
 */

export interface ResultatEnvoi {
  ok: boolean;
  /** Identifiant du message côté passerelle, quand elle le renvoie. */
  id?: string;
  erreur?: string;
}

export interface EtatSession {
  /** La passerelle a-t-elle répondu ? false = injoignable (serveur arrêté, réseau…). */
  joignable: boolean;
  /** WORKING quand tout va bien ; SCAN_QR_CODE, FAILED, STOPPED… sinon. */
  statut: string | null;
  /** Identifiant du compte associé, ex. 33743657271@c.us. */
  compte: string | null;
}

export interface Passerelle {
  nom: 'waha' | 'meta';
  /** `destinataire` : identifiant de conversation (…@c.us, …@lid) ou téléphone. */
  envoyerTexte(destinataire: string, texte: string): Promise<ResultatEnvoi>;
  /** Image PNG en mémoire (récap du portefeuille) — jamais d'URL publique. */
  envoyerImage(destinataire: string, png: Buffer, legende: string): Promise<ResultatEnvoi>;
  etatSession(): Promise<EtatSession>;
}

const DELAI_MS = 10_000;

function configWaha() {
  const url = process.env.WAHA_URL?.replace(/\/+$/, '');
  const cle = process.env.WAHA_API_KEY;
  const session = process.env.WAHA_SESSION || 'default';
  return url && cle ? { url, cle, session } : null;
}

const waha: Passerelle = {
  nom: 'waha',
  async envoyerTexte(destinataire, texte) {
    const cfg = configWaha();
    if (!cfg) return { ok: false, erreur: 'WAHA_URL ou WAHA_API_KEY absent' };
    const chatId = destinataire.includes('@') ? destinataire : chatIdDepuisTelephone(destinataire);
    if (!chatId) return { ok: false, erreur: 'destinataire illisible' };
    try {
      const r = await fetch(`${cfg.url}/api/sendText`, {
        method: 'POST',
        headers: { 'X-Api-Key': cfg.cle, 'Content-Type': 'application/json' },
        // linkPreview : WhatsApp affiche l'aperçu illustré du premier lien (image de partage du site).
        body: JSON.stringify({ session: cfg.session, chatId, text: texte.slice(0, 4096), linkPreview: true }),
        signal: AbortSignal.timeout(DELAI_MS),
        cache: 'no-store',
      });
      if (!r.ok) return { ok: false, erreur: `WAHA HTTP ${r.status}` };
      const corps = (await r.json().catch(() => null)) as { id?: unknown } | null;
      const id = typeof corps?.id === 'string' ? corps.id : (corps?.id as { _serialized?: string } | undefined)?._serialized;
      return { ok: true, ...(id ? { id } : {}) };
    } catch (e) {
      return { ok: false, erreur: (e as Error).name === 'TimeoutError' ? 'WAHA injoignable (délai dépassé)' : 'WAHA injoignable' };
    }
  },
  async envoyerImage(destinataire, png, legende) {
    const cfg = configWaha();
    if (!cfg) return { ok: false, erreur: 'WAHA_URL ou WAHA_API_KEY absent' };
    const chatId = destinataire.includes('@') ? destinataire : chatIdDepuisTelephone(destinataire);
    if (!chatId) return { ok: false, erreur: 'destinataire illisible' };
    try {
      const r = await fetch(`${cfg.url}/api/sendImage`, {
        method: 'POST',
        headers: { 'X-Api-Key': cfg.cle, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: cfg.session,
          chatId,
          file: { mimetype: 'image/png', filename: 'westbourse-recap.png', data: png.toString('base64') },
          caption: legende.slice(0, 1024),
        }),
        signal: AbortSignal.timeout(30_000),
        cache: 'no-store',
      });
      return r.ok ? { ok: true } : { ok: false, erreur: `WAHA HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, erreur: (e as Error).name === 'TimeoutError' ? 'WAHA injoignable (délai dépassé)' : 'WAHA injoignable' };
    }
  },
  async etatSession() {
    const cfg = configWaha();
    if (!cfg) return { joignable: false, statut: null, compte: null };
    try {
      const r = await fetch(`${cfg.url}/api/sessions/${encodeURIComponent(cfg.session)}`, {
        headers: { 'X-Api-Key': cfg.cle },
        signal: AbortSignal.timeout(DELAI_MS),
        cache: 'no-store',
      });
      if (!r.ok) return { joignable: r.status !== 502 && r.status !== 503, statut: r.status === 404 ? 'ABSENTE' : null, compte: null };
      const d = (await r.json().catch(() => ({}))) as { status?: string; me?: { id?: string } | null };
      return { joignable: true, statut: d.status ?? null, compte: d.me?.id ?? null };
    } catch {
      return { joignable: false, statut: null, compte: null };
    }
  },
};

const meta: Passerelle = {
  nom: 'meta',
  async envoyerTexte(destinataire, texte) {
    // L'API officielle attend un numéro E.164 sans « + » ni suffixe.
    const numero = destinataire.replace(/@.*$/, '').replace(/[^\d]/g, '');
    const ok = await sendWhatsAppReply(numero, texte);
    return ok ? { ok } : { ok, erreur: 'Cloud API : envoi refusé ou non configuré' };
  },
  async envoyerImage() {
    // L'API officielle exige un média téléversé au préalable : non branché.
    return { ok: false, erreur: 'image non prise en charge par la passerelle Meta' };
  },
  async etatSession() {
    const configure = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
    return { joignable: configure, statut: configure ? 'WORKING' : null, compte: process.env.WHATSAPP_PHONE_ID ?? null };
  },
};

export function passerelleWhatsapp(): Passerelle {
  const choix = process.env.WHATSAPP_PASSERELLE ?? (process.env.WAHA_URL ? 'waha' : 'meta');
  return choix === 'meta' ? meta : waha;
}

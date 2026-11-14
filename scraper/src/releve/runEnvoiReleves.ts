/**
 * Envoi des relevés mensuels — entrées/sorties. Le texte vient de `message.ts`
 * (pur, testé, sans chiffre) ; ici : lire, télécharger le PDF, envoyer, marquer.
 *
 * CE QUI PART, À QUI.
 *  - seulement les comptes qui ont COCHÉ `releve_email` / `releve_telegram`
 *    (consentement distinct, décoché par défaut — migration 0233) ;
 *  - seulement les relevés dont le PDF existe (`report_url` non nul) et qui
 *    n'ont jamais été envoyés (`sent_at` nul) : relancer le workflow ne renvoie
 *    donc rien à personne ;
 *  - un canal demandé mais inutilisable (pas d'adresse, Telegram non appairé)
 *    est IGNORÉ, ce n'est pas une erreur d'envoi ;
 *  - le corps du message ne porte aucun chiffre : ils vivent dans le PDF.
 *
 * `sent_at` est posé dès qu'AU MOINS UN canal a abouti. Si deux canaux étaient
 * demandés et que l'un échoue, l'autre n'est pas renvoyé à la relance (pas de
 * journal par canal pour les relevés) : l'échec est compté, journalisé, et fait
 * sortir le processus en code 1 pour que le workflow le signale.
 *
 * `mock` ou DRY_RUN : rien n'est envoyé ni écrit ; seuls des comptes sont journalisés.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { sendEmail, sendTelegramDocument, sendTelegramText } from '../alerts/channels.js';
import { moisPrecedent, moisValide } from './calcul.js';
import { composerMessageReleve } from './message.js';
import type { TypeReleve } from './types.js';

const BUCKET = 'releves';

export interface EnvoiRelevesResult {
  month: string;
  comptes: number;
  envoyes: number;
  ignores: number;
  echecs: number;
}

interface Pref {
  user_id: string;
  releve_email: boolean;
  releve_telegram: boolean;
  telegram_chat_id: number | null;
}

export async function runEnvoiReleves(opts: { month?: string; mock?: boolean } = {}): Promise<EnvoiRelevesResult> {
  const month = opts.month ?? moisPrecedent(new Date());
  if (!moisValide(month)) throw new Error(`mois invalide : ${month} (attendu AAAA-MM)`);
  const aBlanc = Boolean(opts.mock) || getConfig().DRY_RUN;
  const sb = getSupabase();
  const res: EnvoiRelevesResult = { month, comptes: 0, envoyes: 0, ignores: 0, echecs: 0 };

  const { data: prefsRows, error: errPrefs } = await sb
    .from('notification_prefs')
    .select('user_id, releve_email, releve_telegram, telegram_chat_id')
    .or('releve_email.eq.true,releve_telegram.eq.true');
  if (errPrefs) throw new Error(`notification_prefs : ${errPrefs.message}`);
  const prefs = (prefsRows ?? []) as Pref[];
  res.comptes = prefs.length;
  if (prefs.length === 0) {
    logger.info(res, 'envoi des relevés : aucun compte abonné');
    return res;
  }

  const ids = prefs.map((p) => p.user_id);
  // `type:report_json->>type` : on ne ramène pas le document, seulement son type.
  const { data: relevesRows, error: errReleves } = await sb
    .from('monthly_reports')
    .select('id, user_id, report_url, type:report_json->>type')
    .eq('month', month)
    .is('sent_at', null)
    .not('report_url', 'is', null)
    .in('user_id', ids);
  if (errReleves) throw new Error(`monthly_reports : ${errReleves.message}`);
  const releves = (relevesRows ?? []) as unknown as { id: string; user_id: string; report_url: string; type: string | null }[];
  const relevePar = new Map(releves.map((r) => [r.user_id, r]));

  const { data: profils } = await sb.from('profiles').select('id, email').in('id', ids);
  const emailPar = new Map(((profils ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]));

  for (const p of prefs) {
    const r = relevePar.get(p.user_id);
    if (!r) { res.ignores += 1; continue; } // pas de relevé prêt (ou déjà envoyé)

    const canaux: ('email' | 'telegram')[] = [];
    if (p.releve_email && emailPar.get(p.user_id)) canaux.push('email');
    if (p.releve_telegram && p.telegram_chat_id) canaux.push('telegram');
    if (canaux.length === 0) { res.ignores += 1; continue; } // canal demandé mais inutilisable

    const type: TypeReleve = r.type === 'simule' ? 'simule' : 'reel';
    const msg = composerMessageReleve(month, type);
    const nom = `westbourse-releve-${month}.pdf`;

    if (aBlanc) {
      logger.info({ canaux: canaux.length }, 'à blanc : envoi de relevé simulé, rien n’est parti');
      res.envoyes += 1;
      continue;
    }

    try {
      const { data: fichier, error: errDl } = await sb.storage.from(BUCKET).download(r.report_url);
      if (errDl || !fichier) throw new Error(`PDF introuvable : ${errDl?.message ?? 'contenu vide'}`);
      const octets = Buffer.from(await fichier.arrayBuffer());

      let reussis = 0;
      const erreurs: string[] = [];
      for (const canal of canaux) {
        try {
          if (canal === 'email') {
            const s = await sendEmail({
              to: emailPar.get(p.user_id)!,
              subject: msg.sujet,
              body: msg.corps,
              attachments: [{ filename: nom, content: octets }],
            });
            if (!s || s.status !== 'sent') throw new Error(s?.error ?? 'canal email non configuré');
          } else {
            const ouverture = await sendTelegramText({ subject: msg.sujet, body: msg.corps, telegramChatId: p.telegram_chat_id! });
            if (!ouverture || ouverture.status !== 'sent') throw new Error(ouverture?.error ?? 'canal telegram non configuré');
            const d = await sendTelegramDocument(p.telegram_chat_id!, octets, nom, msg.sujet);
            if (!d || d.status !== 'sent') throw new Error(d?.error ?? 'envoi refusé');
          }
          reussis += 1;
        } catch (err) {
          erreurs.push(`${canal} : ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (reussis > 0) {
        const { error } = await sb.from('monthly_reports')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', r.id).is('sent_at', null);
        if (error) logger.warn({ userId: p.user_id, err: error.message }, 'relevé envoyé mais sent_at non écrit');
        res.envoyes += 1;
      }
      if (erreurs.length > 0) {
        res.echecs += 1;
        logger.error({ userId: p.user_id, erreurs }, 'envoi de relevé : canal en échec');
      }
    } catch (err) {
      res.echecs += 1;
      logger.error({ userId: p.user_id, err: err instanceof Error ? err.message : String(err) }, 'envoi de relevé échoué');
    }
  }

  logger.info(res, 'envoi des relevés terminé');
  return res;
}

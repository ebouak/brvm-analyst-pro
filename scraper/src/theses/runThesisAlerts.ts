/**
 * Worker d'évaluation des thèses d'investissement actives (#15).
 *  - charge les thèses actives (investment_theses) ;
 *  - recalcule leur statut avec checkThesis (cours + signal du jour) ;
 *  - notifie l'utilisateur UNIQUEMENT à la transition vers 'a-revoir' —
 *    jamais dispatch() : ce flux est personnel, pas une diffusion globale
 *    (voir docs/superpowers/specs/2026-07-30-alerte-these-invalidee-design.md §2) ;
 *  - journalise dans notifications_log, met à jour dernier_statut_evalue.
 *
 * Planifiable via cron (voir .github/workflows/thesis-alerts.yml).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { checkThesis, type Stance, type ThesisStatus } from './pure/status.js';
import { sendEmail, sendWhatsAppTemplate, sendWhatsAppRaw } from '../alerts/channels.js';

interface ThesisRow {
  id: string;
  user_id: string;
  code: string;
  stance: Stance;
  cours_reference: number | null;
  objectif: number | null;
  dernier_statut_evalue: ThesisStatus | null;
}

export interface ThesisAlertsRunResult {
  status: 'success' | 'failed' | 'mock';
  evaluated: number;
  notified: number;
  message: string | null;
}

/**
 * Décide si une transition de statut mérite une notification : front montant
 * uniquement vers 'a-revoir'. Pas de répétition tant que le statut y reste
 * (un titre durablement décroché ne doit pas spammer l'utilisateur), pas de
 * notification sur 'objectif-atteint' (positif, hors périmètre de #15).
 */
export function shouldNotify(statutActuel: ThesisStatus, statutPrecedent: ThesisStatus | null): boolean {
  return statutActuel === 'a-revoir' && statutPrecedent !== 'a-revoir';
}

export async function runThesisAlerts(opts: { mock?: boolean } = {}): Promise<ThesisAlertsRunResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    logger.warn('Mode MOCK alertes de thèse : aucune notification envoyée');
    return { status: 'mock', evaluated: 0, notified: 0, message: null };
  }

  try {
    const sb = getSupabase();
    const { data: theses, error } = await sb
      .from('investment_theses')
      .select('id, user_id, code, stance, cours_reference, objectif, dernier_statut_evalue')
      .eq('statut', 'active');
    if (error) throw new Error(error.message);
    const rows = (theses ?? []) as ThesisRow[];
    if (rows.length === 0) return { status: 'success', evaluated: 0, notified: 0, message: null };

    // Derniers cours par code (un seul select batché, comme runAlerts.ts).
    const codes = [...new Set(rows.map((r) => r.code))];
    const { data: lastDateRow } = await sb
      .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const lastDate = lastDateRow?.[0]?.date_marche as string | undefined;
    const coursByCode: Record<string, number | null> = {};
    if (lastDate) {
      const { data: quotes } = await sb
        .from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate).in('code', codes);
      for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) {
        coursByCode[q.code] = q.cours_jour;
      }
    }

    // Dernier signal par code.
    const signalByCode: Record<string, 'BUY' | 'SELL' | 'HOLD' | null> = {};
    const { data: sigs } = await sb
      .from('signals_daily').select('code, signal, date_marche')
      .in('code', codes).order('date_marche', { ascending: false });
    for (const s of (sigs ?? []) as { code: string; signal: 'BUY' | 'SELL' | 'HOLD' | null }[]) {
      if (!(s.code in signalByCode)) signalByCode[s.code] = s.signal; // garde le plus récent
    }

    // Prefs de notification par propriétaire de thèse (une lecture batchée).
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const prefsByUser = new Map<string, { phone: string | null; email: boolean }>();
    if (userIds.length > 0) {
      const { data: prefs } = await sb
        .from('notification_prefs')
        .select('user_id, whatsapp_phone, whatsapp_optin, alerts_whatsapp, alerts_email')
        .in('user_id', userIds);
      for (const p of (prefs ?? []) as {
        user_id: string; whatsapp_phone: string | null; whatsapp_optin: boolean;
        alerts_whatsapp: boolean; alerts_email: boolean;
      }[]) {
        const phoneCandidate = p.whatsapp_optin && p.alerts_whatsapp ? p.whatsapp_phone?.trim() ?? null : null;
        prefsByUser.set(p.user_id, {
          phone: phoneCandidate && /^\+\d{8,15}$/.test(phoneCandidate) ? phoneCandidate : null,
          email: p.alerts_email,
        });
      }
    }

    let notified = 0;
    for (const t of rows) {
      const check = checkThesis({
        stance: t.stance,
        coursReference: t.cours_reference,
        objectif: t.objectif,
        coursActuel: coursByCode[t.code] ?? null,
        signalActuel: signalByCode[t.code] ?? null,
      });

      const doNotify = shouldNotify(check.status, t.dernier_statut_evalue);
      if (doNotify) {
        notified++;
        const subject = `Thèse à revoir — ${t.code}`;
        const body = `Votre thèse « ${t.stance} » sur ${t.code} semble à revoir :\n${check.raisons.join('\n')}\nVoir : https://www.westbourse.com/journal`;
        const prefs = prefsByUser.get(t.user_id);
        const results: { channel: string; status: 'sent' | 'failed' }[] = [];

        if (prefs?.phone) {
          let wa = await sendWhatsAppTemplate(prefs.phone, 'these_a_revoir', [t.code, body]);
          if (wa?.status !== 'sent') wa = (await sendWhatsAppRaw(prefs.phone, `${subject}\n${body}`)) ?? wa;
          if (wa) results.push(wa);
        }
        if (prefs?.email) {
          try {
            const { data: userData } = await sb.auth.admin.getUserById(t.user_id);
            const email = userData?.user?.email;
            if (email) {
              const mail = await sendEmail({ to: email, subject, body, code: t.code });
              if (mail) results.push(mail);
            }
          } catch (err) {
            logger.warn(
              { err: err instanceof Error ? err.message : String(err), userId: t.user_id },
              'Récupération email utilisateur échouée — WhatsApp reste tenté indépendamment',
            );
          }
        }

        if (!cfg.DRY_RUN) {
          for (const r of results) {
            await sb.from('notifications_log').insert({
              user_id: t.user_id, alert_id: null, code: t.code,
              channel: r.channel, message: body, status: r.status,
            });
          }
        }
      }

      if (!cfg.DRY_RUN) {
        await sb.from('investment_theses').update({
          dernier_statut_evalue: check.status,
          ...(doNotify ? { derniere_alerte_le: new Date().toISOString() } : {}),
        }).eq('id', t.id);
      }
    }

    logger.info({ evaluated: rows.length, notified }, 'Évaluation des thèses terminée');
    return { status: 'success', evaluated: rows.length, notified, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Évaluation des thèses échouée');
    return { status: 'failed', evaluated: 0, notified: 0, message };
  }
}

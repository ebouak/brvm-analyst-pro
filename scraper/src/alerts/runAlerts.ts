/**
 * Worker d'évaluation des alertes (cf. §5.5 / §6.8).
 *  - charge les alertes actives (table alerts) ;
 *  - récupère le dernier cours + variation par code ;
 *  - déclenche celles qui satisfont leur condition ;
 *  - notifie (email/telegram/console), journalise dans notifications_log,
 *    et marque alerts.declenchee_le pour éviter le spam.
 *
 * Planifiable via cron (voir docs/DEPLOYMENT.md).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { isTriggered, isSmartTriggered, isSmartType, type AlertType, type SmartContext } from './evaluate.js';
import { dispatch, sendWhatsAppTemplate, sendWhatsAppRaw } from './channels.js';

interface AlertRow {
  id: string;
  user_id: string;
  code: string;
  type: AlertType;
  seuil: number | null;
  actif: boolean;
  declenchee_le: string | null;
}

export interface AlertsRunResult {
  status: 'success' | 'failed' | 'mock';
  evaluated: number;
  triggered: number;
  message: string | null;
}

export async function runAlerts(opts: { mock?: boolean } = {}): Promise<AlertsRunResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    // Démonstration : une alerte fictive déclenchée.
    await dispatch({ subject: 'Alerte BRVM (mock)', body: 'SNTS a franchi 15 000 FCFA.', code: 'SNTS', to: null });
    logger.warn('Mode MOCK alertes : notification de démonstration envoyée');
    return { status: 'mock', evaluated: 1, triggered: 1, message: null };
  }

  try {
    const sb = getSupabase();
    const { data: alerts, error } = await sb
      .from('alerts').select('*').eq('actif', true);
    if (error) throw new Error(error.message);
    const rows = (alerts ?? []) as AlertRow[];
    if (rows.length === 0) return { status: 'success', evaluated: 0, triggered: 0, message: null };

    // Derniers cours/variation par code.
    const codes = [...new Set(rows.map((r) => r.code))];
    const { data: lastDateRow } = await sb
      .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const lastDate = lastDateRow?.[0]?.date_marche;
    const priceByCode: Record<string, { cours: number | null; variation: number | null }> = {};
    if (lastDate) {
      const { data: quotes } = await sb
        .from('brvm_actions_daily').select('code, cours_jour, variation_pct').eq('date_marche', lastDate).in('code', codes);
      for (const q of (quotes ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null }[]) {
        priceByCode[q.code] = { cours: q.cours_jour, variation: q.variation_pct };
      }
    }

    // Contexte « intelligent » par code : signal du jour + RSI + jours avant détachement.
    const smartByCode: Record<string, SmartContext> = {};
    const hasSmart = rows.some((r) => isSmartType(r.type));
    if (hasSmart) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: sigs } = await sb
        .from('signals_daily').select('code, signal, inputs, date_marche')
        .in('code', codes).order('date_marche', { ascending: false });
      for (const s of (sigs ?? []) as { code: string; signal: SmartContext['signal']; inputs: { rsi?: number } | null }[]) {
        if (smartByCode[s.code]) continue; // garde le plus récent
        smartByCode[s.code] = { signal: s.signal, rsi: typeof s.inputs?.rsi === 'number' ? s.inputs.rsi : null, daysToExDividend: null };
      }
      const { data: divs } = await sb
        .from('dividends').select('code, ex_date').in('code', codes).not('ex_date', 'is', null).gte('ex_date', today).order('ex_date', { ascending: true });
      for (const d of (divs ?? []) as { code: string; ex_date: string }[]) {
        const days = Math.round((Date.parse(d.ex_date) - Date.parse(today)) / 86_400_000);
        if (!smartByCode[d.code]) smartByCode[d.code] = { signal: null, rsi: null, daysToExDividend: days };
        else if (smartByCode[d.code]!.daysToExDividend == null) smartByCode[d.code]!.daysToExDividend = days;
      }
    }

    // Prefs WhatsApp par propriétaire d'alerte (opt-in RGPD) — une lecture par run.
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const waByUser = new Map<string, string>(); // user_id -> téléphone E.164
    if (userIds.length > 0) {
      const { data: prefs } = await sb
        .from('notification_prefs')
        .select('user_id, whatsapp_phone, whatsapp_optin, alerts_whatsapp')
        .in('user_id', userIds)
        .eq('whatsapp_optin', true)
        .eq('alerts_whatsapp', true);
      for (const p of (prefs ?? []) as { user_id: string; whatsapp_phone: string | null }[]) {
        const phone = p.whatsapp_phone?.trim();
        if (phone && /^\+\d{8,15}$/.test(phone)) waByUser.set(p.user_id, phone);
      }
    }

    let triggered = 0;
    for (const a of rows) {
      const px = priceByCode[a.code] ?? { cours: null, variation: null };
      const smart = smartByCode[a.code] ?? { signal: null, rsi: null, daysToExDividend: null };
      const fires = isSmartType(a.type)
        ? isSmartTriggered({ type: a.type, seuil: a.seuil }, smart)
        : isTriggered({ type: a.type, seuil: a.seuil }, px.cours, px.variation);
      if (!fires) continue;
      // Anti-spam : ne pas re-notifier si déjà déclenchée aujourd'hui.
      if (a.declenchee_le && a.declenchee_le.slice(0, 10) === (lastDate ?? '')) continue;

      triggered++;
      const subject = `Alerte ${a.code}`;
      const body = describeAlert(a, px, smart);
      const results = await dispatch({ subject, body, code: a.code, to: null });

      // Canal WhatsApp PERSONNEL du propriétaire (opt-in) — en plus des canaux
      // globaux. Template Meta d'abord (hors fenêtre 24 h), repli texte.
      const phone = waByUser.get(a.user_id);
      if (phone) {
        let wa = await sendWhatsAppTemplate(phone, 'alerte_titre', [a.code, body]);
        if (wa?.status !== 'sent') wa = (await sendWhatsAppRaw(phone, `${subject}\n${body}`)) ?? wa;
        if (wa) results.push(wa);
      }

      if (!cfg.DRY_RUN) {
        await sb.from('alerts').update({ declenchee_le: new Date().toISOString() }).eq('id', a.id);
        for (const r of results) {
          await sb.from('notifications_log').insert({
            user_id: a.user_id, alert_id: a.id, code: a.code,
            channel: r.channel, message: body, status: r.status,
          });
        }
      }
    }

    logger.info({ evaluated: rows.length, triggered }, 'Évaluation des alertes terminée');
    return { status: 'success', evaluated: rows.length, triggered, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Évaluation des alertes échouée');
    return { status: 'failed', evaluated: 0, triggered: 0, message };
  }
}

function describeAlert(
  a: AlertRow,
  px: { cours: number | null; variation: number | null },
  smart: SmartContext,
): string {
  switch (a.type) {
    case 'prix_au_dessus': return `${a.code} a atteint ou dépassé ${a.seuil} (cours ${px.cours ?? '?'}).`;
    case 'prix_en_dessous': return `${a.code} est repassé sous ${a.seuil} (cours ${px.cours ?? '?'}).`;
    case 'variation': return `${a.code} a varié de ${px.variation ?? '?'}% (seuil ${a.seuil}%).`;
    case 'signal_achat': return `${a.code} : signal quantitatif passé à ACHAT.`;
    case 'signal_vente': return `${a.code} : signal quantitatif passé à VENTE.`;
    case 'rsi_survente': return `${a.code} : RSI en survente (${smart.rsi?.toFixed(0) ?? '?'}) — rebond possible.`;
    case 'rsi_surachat': return `${a.code} : RSI en surachat (${smart.rsi?.toFixed(0) ?? '?'}) — prudence.`;
    case 'dividende_proche': return `${a.code} : détachement de dividende dans ${smart.daysToExDividend ?? '?'} jour(s).`;
    default: return `${a.code} : alerte déclenchée.`;
  }
}

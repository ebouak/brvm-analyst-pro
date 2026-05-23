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
import { isTriggered, type AlertType } from './evaluate.js';
import { dispatch } from './channels.js';

interface AlertRow {
  id: string;
  user_id: string;
  code: string;
  type: AlertType;
  seuil: number;
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

    let triggered = 0;
    for (const a of rows) {
      const px = priceByCode[a.code] ?? { cours: null, variation: null };
      if (!isTriggered({ type: a.type, seuil: a.seuil }, px.cours, px.variation)) continue;
      // Anti-spam : ne pas re-notifier si déjà déclenchée aujourd'hui.
      if (a.declenchee_le && a.declenchee_le.slice(0, 10) === (lastDate ?? '')) continue;

      triggered++;
      const subject = `Alerte ${a.code}`;
      const body = describeAlert(a, px);
      const results = await dispatch({ subject, body, code: a.code, to: null });

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

function describeAlert(a: AlertRow, px: { cours: number | null; variation: number | null }): string {
  if (a.type === 'prix_au_dessus') return `${a.code} a atteint ou dépassé ${a.seuil} (cours ${px.cours ?? '?'}).`;
  if (a.type === 'prix_en_dessous') return `${a.code} est repassé sous ${a.seuil} (cours ${px.cours ?? '?'}).`;
  return `${a.code} a varié de ${px.variation ?? '?'}% (seuil ${a.seuil}%).`;
}

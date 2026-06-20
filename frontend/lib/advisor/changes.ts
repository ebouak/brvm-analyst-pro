import { createPublicClient } from '@/lib/supabase/public';
import type { Action } from './recommend';

export interface AdvisorChange {
  code: string;
  from: Action;
  to: Action;
  conviction: number;
  date: string;
}

/**
 * Bascules de recommandation entre les deux derniers snapshots stockés
 * (advisor_history). Base des « alertes » : une action passée de Conserver à
 * Acheter, etc. Vide tant que le cron n'a pas tourné ≥ 2 fois.
 */
export async function getRecentChanges(limit = 12): Promise<AdvisorChange[]> {
  const sb = createPublicClient();

  // Deux dates les plus récentes.
  const { data: dates } = await sb
    .from('advisor_history')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(400);
  const distinct = [...new Set((dates ?? []).map((d) => d.date_marche as string))];
  if (distinct.length < 2) return [];
  const [curDate, prevDate] = distinct;

  const [{ data: cur }, { data: prev }] = await Promise.all([
    sb.from('advisor_history').select('code, action, conviction').eq('date_marche', curDate),
    sb.from('advisor_history').select('code, action').eq('date_marche', prevDate),
  ]);

  const prevByCode = new Map<string, Action>();
  for (const r of (prev ?? []) as { code: string; action: Action }[]) prevByCode.set(r.code, r.action);

  const changes: AdvisorChange[] = [];
  for (const r of (cur ?? []) as { code: string; action: Action; conviction: number }[]) {
    const from = prevByCode.get(r.code);
    if (from && from !== r.action) {
      changes.push({ code: r.code, from, to: r.action, conviction: r.conviction, date: curDate! });
    }
  }

  // Les bascules les plus « fortes » (vers acheter/vendre) d'abord.
  const weight = (a: Action) => (a === 'acheter' ? 2 : a === 'vendre' ? 2 : 1);
  changes.sort((a, b) => weight(b.to) * b.conviction - weight(a.to) * a.conviction);
  return changes.slice(0, limit);
}

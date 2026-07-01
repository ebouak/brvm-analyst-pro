/**
 * Exécute le backtest rétroactif des signaux BUY sur toutes les actions et
 * persiste les résultats dans public.signals_backtest (TRUNCATE + réinsertion
 * à chaque exécution — la table ne reflète toujours que le dernier calcul).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { backtestSignalsForCode, type DailyPoint } from './backtestSignals.js';

const log = logger.child({ module: 'runBacktestSignals' });

export interface BacktestSignalsRunResult {
  status: 'success' | 'failed';
  codesTraites: number;
  signauxInseres: number;
  message: string | null;
}

export async function runBacktestSignals(): Promise<BacktestSignalsRunResult> {
  const supabase = getSupabase();

  try {
    const { data: instruments, error: instErr } = await supabase
      .from('brvm_instruments')
      .select('code')
      .eq('type', 'action')
      .eq('actif', true);
    if (instErr) throw new Error(instErr.message);

    const codes = (instruments ?? []).map((i) => i.code as string);
    log.info({ nb: codes.length }, 'Backtest signaux : démarrage');

    const allSignals: ReturnType<typeof backtestSignalsForCode> = [];

    for (const code of codes) {
      const { data, error } = await supabase
        .from('brvm_actions_daily')
        .select('date_marche, cours_jour, volume')
        .eq('code', code)
        .not('cours_jour', 'is', null)
        .order('date_marche', { ascending: true });
      if (error) {
        log.warn({ code, err: error.message }, 'Backtest signaux : fetch échoué pour ce titre, ignoré');
        continue;
      }
      const points: DailyPoint[] = (data ?? []).map((r) => ({
        date: r.date_marche as string,
        close: r.cours_jour as number,
        volume: (r.volume as number | null) ?? null,
      }));
      const signals = backtestSignalsForCode(code, points);
      allSignals.push(...signals);
    }

    log.info({ nb: allSignals.length }, 'Backtest signaux : signaux calculés');

    // Remplace intégralement le contenu précédent (le tableau ne reflète que le dernier run).
    const { error: delErr } = await supabase.from('signals_backtest').delete().neq('code', '');
    if (delErr) throw new Error(delErr.message);

    const rows = allSignals.map((s) => ({
      code: s.code,
      date_signal: s.dateSignal,
      cours_signal: s.coursSignal,
      cours_horizon: s.coursHorizon,
      perf_pct: s.perfPct,
      horizon_seances: s.horizonSeances,
    }));

    // Insertion par lots (évite les payloads trop volumineux).
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: insErr } = await supabase.from('signals_backtest').insert(batch);
      if (insErr) throw new Error(insErr.message);
    }

    log.info({ nb: rows.length }, 'Backtest signaux : persisté');
    return { status: 'success', codesTraites: codes.length, signauxInseres: rows.length, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, 'runBacktestSignals échoué');
    return { status: 'failed', codesTraites: 0, signauxInseres: 0, message };
  }
}

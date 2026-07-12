/**
 * CLI `intraday:calibrate` — recalcule les mesures du moteur fixing depuis les
 * snapshots conservés et affiche les taux de déclenchement par seuil candidat.
 *
 * Lecture seule : aucune écriture en base. C'est l'outil qui remplace la table
 * patterns_raw supprimée (la trace brute se recalcule, elle ne se stocke pas).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { FIXING_THRESHOLDS } from './indicators/fixingSignals.js';
import { measureSession, formatReport, type SessionMeasure } from './calibrate.js';

interface SnapshotRow {
  code: string;
  date_marche: string;
  captured_at: string;
  close: number | null;
  volume: number | null;
}

/** Pagination PostgREST (Supabase plafonne à ~1000 lignes par requête). */
async function fetchAllSnapshots(dates: string[]): Promise<SnapshotRow[]> {
  const sb = getSupabase();
  const out: SnapshotRow[] = [];
  const PAGE = 1000;
  for (const date of dates) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('brvm_intraday_snapshots')
        .select('code, date_marche, captured_at, close, volume')
        .eq('date_marche', date)
        .order('captured_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`snapshots ${date} : ${error.message}`);
      const rows = (data ?? []) as SnapshotRow[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

export interface CalibrateRunResult {
  status: 'success' | 'failed';
  sessions: number;
  measures: number;
  message: string | null;
}

export async function runCalibrate(opts: { days?: number } = {}): Promise<CalibrateRunResult> {
  const days = opts.days ?? 30;
  try {
    const sb = getSupabase();

    // 1. Séances disposant de snapshots (dates distinctes, les N dernières).
    //    PostgREST ne fait pas de DISTINCT : on prend les dates de séance du
    //    quotidien puis on garde celles qui ont des snapshots.
    const { data: dRows, error: dErr } = await sb
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(days * 60); // ~47 lignes par séance → couvre `days` séances
    if (dErr) throw new Error(`dates : ${dErr.message}`);
    const sessionDates = [...new Set(((dRows ?? []) as { date_marche: string }[]).map((r) => r.date_marche))]
      .slice(0, days)
      .sort();

    // 2. Snapshots de ces séances.
    const snaps = await fetchAllSnapshots(sessionDates);
    const withSnaps = [...new Set(snaps.map((s) => s.date_marche))].sort();
    if (withSnaps.length === 0) {
      logger.warn('Aucun snapshot sur la période — rien à calibrer');
      return { status: 'success', sessions: 0, measures: 0, message: 'aucun snapshot' };
    }

    // 3. Volumes quotidiens pour les moyennes 20 j (historique = 20 séances
    //    avant la plus ancienne séance analysée).
    const { data: vRows, error: vErr } = await sb
      .from('brvm_actions_daily')
      .select('code, date_marche, volume')
      .lte('date_marche', withSnaps[withSnaps.length - 1]!)
      .order('date_marche', { ascending: false })
      .limit((days + 25) * 60);
    if (vErr) throw new Error(`volumes : ${vErr.message}`);
    const volHistory = (vRows ?? []) as { code: string; date_marche: string; volume: number | null }[];

    /** Moyenne des 20 volumes strictement antérieurs à `date` pour `code`. */
    function avg20(code: string, date: string): number | null {
      const prev = volHistory
        .filter((r) => r.code === code && r.date_marche < date && r.volume != null && r.volume > 0)
        .slice(0, 20)
        .map((r) => r.volume as number);
      if (prev.length === 0) return null;
      return prev.reduce((a, b) => a + b, 0) / prev.length;
    }

    // 4. Mesures par (titre, séance).
    const byKey = new Map<string, SnapshotRow[]>();
    for (const s of snaps) {
      const k = `${s.code}|${s.date_marche}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(s);
    }
    const measures: SessionMeasure[] = [];
    for (const [key, rows] of byKey) {
      const [code, date] = key.split('|') as [string, string];
      const samples = rows
        .filter((r) => r.close != null && r.close > 0)
        .map((r) => ({ close: r.close as number, volume: r.volume ?? 0 }));
      const m = measureSession(code, date, samples, avg20(code, date));
      if (m) measures.push(m);
    }

    // 5. Rapport.
    const report = formatReport(measures, {
      momentumThresholds: [1, 2, 3, 4, 5],
      volumeThresholds: [1.5, 2, 3, 4],
      currentMomentum: FIXING_THRESHOLDS.momentumPct,
      currentVolume: FIXING_THRESHOLDS.volumeSpikeRatio,
    });
    // Rapport destiné à l'humain : console directe, pas le logger JSON.
    console.log('\n' + report + '\n');

    return { status: 'success', sessions: withSnaps.length, measures: measures.length, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Calibration échouée');
    return { status: 'failed', sessions: 0, measures: 0, message };
  }
}

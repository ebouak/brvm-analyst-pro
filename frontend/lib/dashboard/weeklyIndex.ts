import { createClient } from '@/lib/supabase/server';
import { rsi, macdSeries } from '@/lib/indicators';
import type { Candle } from '@/components/dashboard/WeeklyIndexChart';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export interface WeeklyIndex {
  title: string;
  code: string;
  candles: Candle[];
  rsi: number | null;
  macd: number | null;
  lastValue: string;
  lastVar: number | null;
}

/**
 * Construit la série hebdo d'un indice BRVM en vraies bougies
 * (open = clôture veille, close = valeur du jour). RSI/MACD calculés seulement
 * si l'historique est suffisant (sinon null — jamais de valeur inventée).
 */
export async function getWeeklyIndex(code: string, title: string): Promise<WeeklyIndex> {
  const supabase = createClient();
  const { data } = await supabase
    .from('brvm_indices_daily')
    .select('date_marche, valeur, valeur_precedente, variation_pct')
    .eq('code', code)
    .order('date_marche', { ascending: true })
    .limit(40);

  const rows = (data ?? []) as {
    date_marche: string;
    valeur: number | null;
    valeur_precedente: number | null;
    variation_pct: number | null;
  }[];

  const candles: Candle[] = rows
    .filter((r) => r.valeur != null)
    .map((r) => {
      const close = r.valeur as number;
      const open = (r.valeur_precedente ?? close) as number;
      const d = new Date(r.date_marche);
      return {
        label: JOURS[d.getUTCDay()] ?? '—',
        date: r.date_marche,
        open,
        close,
        body: [Math.min(open, close), Math.max(open, close)] as [number, number],
        up: close >= open,
      };
    });

  const closes = candles.map((c) => c.close);
  const rsiVal = closes.length >= 15 ? rsi(closes, 14) : null;
  let macdVal: number | null = null;
  if (closes.length >= 26) {
    const arr = macdSeries(closes);
    macdVal = arr[arr.length - 1]?.macd ?? null;
  }

  const lastClose = candles[candles.length - 1]?.close ?? null;
  const lastVar = rows[rows.length - 1]?.variation_pct ?? null;

  return {
    title,
    code,
    candles,
    rsi: rsiVal,
    macd: macdVal,
    lastValue: lastClose != null ? lastClose.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
    lastVar,
  };
}

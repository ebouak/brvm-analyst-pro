import { createClient } from '@/lib/supabase/server';
import { smaSeries, rsiSeries, macdSeries } from '@/lib/indicators';
import {
  parseCriteriaFromSearchParams,
  matchesCriteria,
  hasAnyCriteria,
  type ScanRow,
} from '@/lib/scanner';
import ScannerForm from '@/components/ScannerForm';
import ScannerResults from '@/components/ScannerResults';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scanner technique — BRVM Analyst Pro' };

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

export default async function ScannerPage({ searchParams }: PageProps) {
  const criteria = parseCriteriaFromSearchParams(searchParams);
  const filtersActive = hasAnyCriteria(criteria);

  const supabase = createClient();

  // ── Secteurs distincts pour le select ──────────────────────────────────────
  const { data: secteurRows } = await supabase
    .from('brvm_actions_daily')
    .select('secteur')
    .not('secteur', 'is', null)
    .order('secteur');

  const secteurs = [
    ...new Set((secteurRows ?? []).map((r: { secteur: string | null }) => r.secteur).filter(Boolean) as string[]),
  ];

  // ── Dernière séance par code ───────────────────────────────────────────────
  const { data: latestRows } = await supabase
    .from('brvm_actions_daily')
    .select('code, date_marche, cours_jour, variation_pct, volume, designation, secteur')
    .order('date_marche', { ascending: false })
    .limit(200); // one page is enough to pick latest per code

  // Garder uniquement la dernière séance par code
  const latestByCode = new Map<string, {
    code: string;
    date_marche: string;
    cours_jour: number | null;
    variation_pct: number | null;
    volume: number | null;
    designation: string | null;
    secteur: string | null;
  }>();
  for (const row of latestRows ?? []) {
    if (!latestByCode.has(row.code)) latestByCode.set(row.code, row);
  }

  const codes = [...latestByCode.keys()];
  if (codes.length === 0) {
    return (
      <main className="p-6 space-y-6">
        <PageHeader />
        <ScannerForm criteria={criteria} secteurs={secteurs} />
        <p className="text-muted text-center py-8">Aucune donnée de marché disponible.</p>
      </main>
    );
  }

  // ── Historique 200 dernières séances pour calcul indicateurs ──────────────
  // On récupère la date min nécessaire : 200 jours de bourse ~= ~290 jours calendaire
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 300);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const { data: histRows } = await supabase
    .from('brvm_actions_daily')
    .select('code, date_marche, cours_jour, volume')
    .gte('date_marche', cutoff)
    .order('date_marche', { ascending: true });

  // Grouper par code
  const histByCode = new Map<string, { date_marche: string; cours_jour: number | null; volume: number | null }[]>();
  for (const row of histRows ?? []) {
    if (!histByCode.has(row.code)) histByCode.set(row.code, []);
    histByCode.get(row.code)!.push(row);
  }

  // ── Derniers signaux ───────────────────────────────────────────────────────
  const { data: signalRows } = await supabase
    .from('signals_daily')
    .select('code, date_marche, signal, score_total, confiance')
    .in('code', codes)
    .order('date_marche', { ascending: false })
    .limit(codes.length * 2);

  const signalByCode = new Map<string, { signal: string; score_total: number | null; confiance: number | null }>();
  for (const row of signalRows ?? []) {
    if (!signalByCode.has(row.code)) signalByCode.set(row.code, row);
  }

  // ── Construire ScanRow[] ───────────────────────────────────────────────────
  const allRows: ScanRow[] = [];

  for (const [code, latest] of latestByCode.entries()) {
    const hist = histByCode.get(code) ?? [];
    const closes = hist.map((r) => r.cours_jour).filter((v): v is number => v != null);
    const volumes = hist.map((r) => r.volume).filter((v): v is number => v != null);

    // RSI(14) — valeur finale de la série
    const rsiArr = rsiSeries(closes, 14);
    const rsiVal = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] ?? null : null;

    // MACD(12,26,9)
    const macdArr = macdSeries(closes, 12, 26, 9);
    const lastMacd = macdArr.length > 0 ? macdArr[macdArr.length - 1] : null;

    // MA20 / MA50 / MA200 — valeurs finales des séries
    const ma20Arr = smaSeries(closes, 20);
    const ma50Arr = smaSeries(closes, 50);
    const ma200Arr = smaSeries(closes, 200);
    const ma20 = ma20Arr.length > 0 ? ma20Arr[ma20Arr.length - 1] ?? null : null;
    const ma50 = ma50Arr.length > 0 ? ma50Arr[ma50Arr.length - 1] ?? null : null;
    const ma200 = ma200Arr.length > 0 ? ma200Arr[ma200Arr.length - 1] ?? null : null;

    // Volume moyenne 20 jours
    const vol20 = volumes.slice(-20);
    const volumeAvg20 = vol20.length > 0 ? vol20.reduce((a, b) => a + b, 0) / vol20.length : null;

    const sig = signalByCode.get(code);

    const row: ScanRow = {
      code,
      designation: latest.designation,
      secteur: latest.secteur,
      cours_jour: latest.cours_jour,
      variation_pct: latest.variation_pct,
      volume: latest.volume,
      rsi: rsiVal,
      macd: lastMacd?.macd ?? null,
      macdSignal: lastMacd?.signal ?? null,
      ma20,
      ma50,
      ma200,
      volumeAvg20,
      signal: (sig?.signal as ScanRow['signal']) ?? null,
      score: sig?.score_total ?? null,
      confiance: sig?.confiance ?? null,
    };

    allRows.push(row);
  }

  // ── Filtrage ───────────────────────────────────────────────────────────────
  const filteredRows = filtersActive
    ? allRows.filter((r) => matchesCriteria(r, criteria))
    : [];

  return (
    <main className="p-6 space-y-6">
      <PageHeader />
      <ScannerForm criteria={criteria} secteurs={secteurs} />

      {!filtersActive ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center space-y-2">
          <p className="text-white font-semibold">Configurez des filtres puis lancez le scan</p>
          <p className="text-muted text-sm">
            Utilisez les critères ci-dessus pour identifier les actions répondant à vos conditions
            techniques. Les indicateurs RSI, MACD et moyennes mobiles sont calculés sur les 200
            dernières séances.
          </p>
        </div>
      ) : (
        <ScannerResults rows={filteredRows} />
      )}

      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs text-muted pt-2">
        <span>
          <span className="inline-block px-1.5 py-0.5 rounded bg-up/15 text-up mr-1">RSI &lt; 30</span>
          Survendu
        </span>
        <span>
          <span className="inline-block px-1.5 py-0.5 rounded bg-down/15 text-down mr-1">RSI &gt; 70</span>
          Suracheté
        </span>
        <span>
          <span className="inline-block px-1.5 py-0.5 rounded bg-up/15 text-up mr-1">BUY</span>
          Signal haussier
        </span>
        <span>
          <span className="inline-block px-1.5 py-0.5 rounded bg-down/15 text-down mr-1">SELL</span>
          Signal baissier
        </span>
        <span className="text-border">Score : sous-score agrégé · Confiance entre parenthèses</span>
      </div>
    </main>
  );
}

function PageHeader() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold text-white">Scanner technique</h1>
      <p className="text-muted text-sm">
        Filtrer les actions selon critères techniques combinables — RSI, MACD, moyennes mobiles,
        volume, signal.
      </p>
    </div>
  );
}

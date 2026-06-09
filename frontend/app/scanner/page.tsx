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
import {
  SectionHeader,
  EmptyStatePremium,
  PremiumPanel,
  StatPill,
  Eyebrow,
} from '@/components/ui/premium';

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
    .limit(200);

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
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <ScannerPageHeader />
        <PremiumPanel>
          <div className="p-4">
            <ScannerForm criteria={criteria} secteurs={secteurs} />
          </div>
        </PremiumPanel>
        <EmptyStatePremium
          title="Aucune donnée de marché"
          hint="Alimentez la base de données via le scraper avant de lancer un scan."
          icon="◈"
        />
      </div>
    );
  }

  // ── Historique 200 dernières séances pour calcul indicateurs ──────────────
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 300);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const { data: histRows } = await supabase
    .from('brvm_actions_daily')
    .select('code, date_marche, cours_jour, volume')
    .gte('date_marche', cutoff)
    .order('date_marche', { ascending: true });

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

    const rsiArr = rsiSeries(closes, 14);
    const rsiVal = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] ?? null : null;

    const macdArr = macdSeries(closes, 12, 26, 9);
    const lastMacd = macdArr.length > 0 ? macdArr[macdArr.length - 1] : null;

    const ma20Arr = smaSeries(closes, 20);
    const ma50Arr = smaSeries(closes, 50);
    const ma200Arr = smaSeries(closes, 200);
    const ma20 = ma20Arr.length > 0 ? ma20Arr[ma20Arr.length - 1] ?? null : null;
    const ma50 = ma50Arr.length > 0 ? ma50Arr[ma50Arr.length - 1] ?? null : null;
    const ma200 = ma200Arr.length > 0 ? ma200Arr[ma200Arr.length - 1] ?? null : null;

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
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <ScannerPageHeader universeSize={codes.length} />

      {/* ── Filet doré de séparation ────────────────────────────────────── */}
      <div className="gold-rule" />

      {/* ── Formulaire de filtres ────────────────────────────────────────── */}
      <PremiumPanel glow={filtersActive}>
        <div className="p-4 md:p-6">
          <ScannerForm criteria={criteria} secteurs={secteurs} />
        </div>
      </PremiumPanel>

      {/* ── Résultats / état vide ────────────────────────────────────────── */}
      {!filtersActive ? (
        <div className="rounded-card border border-border bg-surface shadow-card p-12 text-center space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-gold/20 bg-gold/[0.06] text-lg text-gold/70">
            ⌖
          </div>
          <p className="font-display text-base text-ivory">Configurez des filtres puis lancez le scan</p>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            Combinez des critères techniques — RSI, MACD, moyennes mobiles, volume et signal.
            Les indicateurs sont calculés sur les 200 dernières séances disponibles.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <StatPill tone="neutral">
              <span className="tabular">{codes.length}</span>&nbsp;titres dans l'univers
            </StatPill>
            <StatPill tone="gold">200 séances d'historique</StatPill>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Eyebrow>
              {filteredRows.length} résultat{filteredRows.length !== 1 ? 's' : ''} sur {allRows.length} titres
            </Eyebrow>
            <StatPill tone={filteredRows.length > 0 ? 'emerald' : 'neutral'}>
              Scan actif
            </StatPill>
          </div>
          <PremiumPanel>
            <ScannerResults rows={filteredRows} />
          </PremiumPanel>
        </div>
      )}

      {/* ── Légende des indicateurs ──────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-surface shadow-card px-5 py-4">
        <Eyebrow className="mb-3">Référence des indicateurs</Eyebrow>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-up/15 text-up font-medium tabular">RSI &lt; 30</span>
            Zone survendue
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-down/15 text-down font-medium tabular">RSI &gt; 70</span>
            Zone surachetée
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-up/15 text-up font-medium">ACHAT</span>
            Signal haussier confirmé
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-down/15 text-down font-medium">VENTE</span>
            Signal baissier confirmé
          </span>
          <span className="text-faint">
            Score : sous-score agrégé · Confiance entre parenthèses
          </span>
        </div>
      </div>
    </div>
  );
}

function ScannerPageHeader({ universeSize }: { universeSize?: number }) {
  return (
    <SectionHeader
      kicker="BRVM · Analyse technique"
      title="Scanner technique"
      subtitle="Filtrez les valeurs selon des critères techniques combinables — RSI, MACD, moyennes mobiles, volume et signal."
      actions={
        universeSize != null ? (
          <StatPill tone="neutral">
            <span className="tabular">{universeSize}</span>&nbsp;titres
          </StatPill>
        ) : undefined
      }
    />
  );
}

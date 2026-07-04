'use client';
import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import ReportConfig, { type ReportParams } from './ReportConfig';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';
import ReportView, { type ReportData } from './ReportView';
import { filterEventsByPeriod } from '@/lib/reportUtils';
import { exportReportPDF } from './export/exportPDF';

interface Instrument {
  code: string;
  designation: string | null;
}

export default function ReportsPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [instrumentsLoaded, setInstrumentsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Charge la liste des instruments au premier affichage du formulaire.
  const ensureInstruments = useCallback(async () => {
    if (instrumentsLoaded) return;
    setLoadingInstruments(true);
    const sb = createClient();
    const { data } = await sb
      .from('brvm_instruments')
      .select('code, designation')
      .eq('type', 'action')
      .order('code');
    setInstruments((data ?? []) as Instrument[]);
    setInstrumentsLoaded(true);
    setLoadingInstruments(false);
  }, [instrumentsLoaded]);

  // UX fix: useState ne déclenche pas d'effet — useEffect requis pour charger au montage.
  useEffect(() => {
    ensureInstruments();
  }, [ensureInstruments]);

  async function generate(params: ReportParams) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const sb = createClient();
      const codes =
        params.codes.length > 0
          ? params.codes
          : instruments.map((i) => i.code);

      // Cours historiques pour la période.
      const { data: priceData, error: priceErr } = await sb
        .from('brvm_actions_daily')
        .select('code, date_marche, cours_jour, variation_pct, volume, designation')
        .in('code', codes.slice(0, 20)) // limite réseau raisonnable
        .gte('date_marche', params.dateFrom)
        .lte('date_marche', params.dateTo)
        .order('date_marche', { ascending: true });
      if (priceErr) throw new Error(priceErr.message);

      const rows = (priceData ?? []) as {
        code: string;
        date_marche: string;
        cours_jour: number | null;
        variation_pct: number | null;
        volume: number | null;
        designation: string | null;
      }[];

      // Grouper par code pour les séries de prix et stats.
      const byCode = new Map<string, typeof rows>();
      for (const r of rows) {
        if (!byCode.has(r.code)) byCode.set(r.code, []);
        byCode.get(r.code)!.push(r);
      }

      const priceSeries = [...byCode.entries()].map(([code, codeRows]) => ({
        code,
        dates: codeRows.map((r) => r.date_marche),
        closes: codeRows.map((r) => r.cours_jour),
      }));

      const statRows = [...byCode.entries()].map(([code, codeRows]) => ({
        code,
        designation: codeRows[0]?.designation ?? null,
        closes: codeRows.map((r) => r.cours_jour ?? 0),
        volumes: codeRows.map((r) => r.volume),
      }));

      // Dernière variation par code (pour résumé exécutif).
      const lastByCode = new Map<string, (typeof rows)[0]>();
      for (const r of rows) lastByCode.set(r.code, r);
      const marketRows = [...lastByCode.values()].map((r) => ({
        code: r.code,
        designation: r.designation,
        variation_pct: r.variation_pct,
        cours_jour: r.cours_jour,
      }));

      // Événements.
      const { data: evtData } = await sb
        .from('market_events')
        .select('id, event_date, title, event_type, instrument_code, sentiment')
        .gte('event_date', params.dateFrom)
        .lte('event_date', params.dateTo)
        .order('event_date', { ascending: false })
        .limit(100);
      const events = filterEventsByPeriod(
        (evtData ?? []) as {
          id: string;
          event_date: string;
          title: string;
          event_type: string;
          instrument_code: string | null;
          sentiment: 'positive' | 'neutral' | 'negative' | null;
        }[],
        params.dateFrom,
        params.dateTo,
      );

      // Signaux.
      const { data: sigData } = await sb
        .from('signals_daily')
        .select('code, date_marche, signal, score_total, confiance, explication')
        .in('code', codes.slice(0, 20))
        .gte('date_marche', params.dateFrom)
        .lte('date_marche', params.dateTo)
        .order('date_marche', { ascending: false })
        .limit(200);

      setReport({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        marketRows,
        priceSeries,
        events,
        signals: (sigData ?? []) as ReportData['signals'],
        statRows,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    if (!report) return;
    await exportReportPDF(report);
  }

  // Modèles 1-clic : périodes calculées à la volée, tous titres (codes vides
  // = univers complet, plafonné à 20 séries côté requête comme le formulaire).
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };
  const PRESETS: { label: string; hint: string; params: ReportParams }[] = [
    {
      label: '⚡ Marché — 7 derniers jours',
      hint: 'Vue express de la semaine',
      params: { type: 'hebdomadaire', codes: [], dateFrom: iso(daysAgo(7)), dateTo: iso(new Date()) },
    },
    {
      label: '📅 Marché — 30 derniers jours',
      hint: 'Le standard mensuel',
      params: { type: 'mensuel', codes: [], dateFrom: iso(daysAgo(30)), dateTo: iso(new Date()) },
    },
    {
      label: '📊 Trimestre écoulé',
      hint: 'Tendances de fond + événements',
      params: { type: 'personnalise', codes: [], dateFrom: iso(daysAgo(91)), dateTo: iso(new Date()) },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="overline mb-1 text-gold-2">Analyse · période & événements</p>
          <h1 className="font-display text-2xl text-ivory [letter-spacing:-0.02em]">Rapports interactifs</h1>
          <p className="mt-1 max-w-[58ch] text-sm text-muted">
            Composez un rapport sur mesure (titres, période) : performances, séries de cours,
            événements, signaux — exportable en PDF.
          </p>
        </div>
        {report && !loading && (
          <button
            type="button"
            onClick={handleExportPDF}
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian shadow-gold-sm transition hover:bg-gold-2 active:scale-95"
          >
            ⬇ Exporter en PDF
          </button>
        )}
      </div>
      <ViewTabs tabs={REPORT_TABS} current="/reports" />

      {/* Modèles 1-clic */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={loading}
            onClick={() => generate(p.params)}
            className="group rounded-xl border border-border bg-surface/40 px-4 py-2.5 text-left transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95 disabled:opacity-50"
          >
            <span className="block text-sm font-medium text-ivory group-hover:text-accent">{p.label}</span>
            <span className="block text-[11px] text-faint">{p.hint}</span>
          </button>
        ))}
      </div>

      {loadingInstruments ? (
        <p className="text-sm text-muted">Chargement des instruments…</p>
      ) : (
        <ReportConfig
          instruments={instruments}
          onGenerate={generate}
          loading={loading}
        />
      )}

      {error && (
        <div className="bg-surface border border-down/40 rounded-xl p-4 text-down text-sm">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted text-center py-8">Génération du rapport…</p>
      )}

      {report && !loading && (
        <ReportView data={report} onExportPDF={handleExportPDF} />
      )}
    </div>
  );
}

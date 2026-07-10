'use client';

import { useMemo } from 'react';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { MetricCard, SectionHeader, EmptyStatePremium } from '@/components/ui/premium';

interface ReportData {
  month: string;
  userName?: string;
  kpis: {
    pnlTotal: number;
    pnlPct: number;
    capitalCurrent: number;
    capitalInitial: number;
  };
  topSignals: Array<{
    code: string;
    entryPrice: number;
    exitPrice: number;
    entryDate: string;
    exitDate: string;
    pnlPct: number;
    daysHeld: number;
  }>;
  signalNarrative: string;
  fundamentals: Array<{
    code: string;
    per?: number;
    pb?: number;
    graham?: number;
  }>;
  events: Array<{
    title: string;
    date: string;
    impact: string;
  }>;
  eventNarrative: string;
  recommendations: string;
}

interface MonthlyReportViewerProps {
  report: ReportData;
  pdfUrl?: string;
}

export function MonthlyReportViewer({ report, pdfUrl }: MonthlyReportViewerProps) {
  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(`${report.month}-01`)
    );
  }, [report.month]);

  return (
    <div className="space-y-8">
      {/* Header with download button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl md:text-3xl text-ivory capitalize">{monthName}</h2>
          <p className="mt-1 text-sm text-muted">Rapport de synthèse WESTBOURSE</p>
        </div>
        {pdfUrl && (
          <a
            href={pdfUrl}
            download
            className="inline-flex items-center gap-2 rounded-full bg-gold py-2 px-5 text-sm font-semibold text-obsidian hover:bg-gold/90 transition-all duration-200"
          >
            <span>⬇</span> Télécharger PDF
          </a>
        )}
      </div>

      {/* PAGE 1: Summary */}
      <div className="space-y-6 border-t border-border pt-6">
        <h3 className="font-display text-xl text-gold">Synthèse du mois</h3>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="P&L Total"
            value={fmtFcfa(report.kpis.pnlTotal)}
            delta={`${fmtNumber(report.kpis.pnlPct, 2)}%`}
            deltaDir={report.kpis.pnlTotal >= 0 ? 'up' : 'down'}
            accent={report.kpis.pnlTotal >= 0 ? 'emerald' : 'sapphire'}
          />
          <MetricCard
            label="Capital Actuel"
            value={fmtFcfa(report.kpis.capitalCurrent)}
            delta={fmtFcfa(report.kpis.capitalInitial)}
            unit="Initial"
            accent="neutral"
          />
          <MetricCard
            label="Rendement Mensuel"
            value={`${fmtNumber(report.kpis.pnlPct, 1)}%`}
            deltaDir={report.kpis.pnlPct >= 0 ? 'up' : 'down'}
            accent={report.kpis.pnlPct >= 0 ? 'emerald' : 'sapphire'}
          />
        </div>

        {/* Narrative section */}
        <div className="rounded-card border border-border bg-surface p-6">
          <h4 className="text-sm font-semibold text-ivory mb-3">Analyse générale</h4>
          <p className="text-sm leading-relaxed text-muted text-justify whitespace-pre-wrap">
            {report.signalNarrative || 'Aucune analyse disponible.'}
          </p>
        </div>
      </div>

      {/* PAGE 2: Top Signals */}
      <div className="space-y-6 border-t border-border pt-6">
        <h3 className="font-display text-xl text-gold">Top Signaux du mois</h3>

        {report.topSignals && report.topSignals.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.topSignals.map((signal, idx) => (
                <div
                  key={idx}
                  className="rounded-card border border-border bg-surface p-4 hover:border-gold/20 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-2xl font-semibold text-ivory">{signal.code}</div>
                    <div
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        signal.pnlPct >= 0
                          ? 'bg-up/10 text-up border border-up/30'
                          : 'bg-down/10 text-down border border-down/30'
                      }`}
                    >
                      {signal.pnlPct >= 0 ? '+' : ''}{fmtNumber(signal.pnlPct, 2)}%
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Entrée</span>
                      <span className="tabular font-medium text-ivory">
                        {fmtFcfa(signal.entryPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Sortie</span>
                      <span className="tabular font-medium text-ivory">
                        {fmtFcfa(signal.exitPrice)}
                      </span>
                    </div>
                    <div className="border-t border-border my-2 pt-2 flex justify-between">
                      <span className="text-muted">Jours</span>
                      <span className="tabular font-medium text-ivory">{signal.daysHeld}j</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Entrée</span>
                      <span className="tabular text-muted text-[10px]">
                        {new Date(signal.entryDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Sortie</span>
                      <span className="tabular text-muted text-[10px]">
                        {new Date(signal.exitDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyStatePremium title="Aucun signal ce mois" hint="Vérifiez vos critères de trading" />
        )}
      </div>

      {/* PAGE 3: Fundamentals */}
      <div className="space-y-6 border-t border-border pt-6">
        <h3 className="font-display text-xl text-gold">Analyse Fondamentale</h3>

        {report.fundamentals && report.fundamentals.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.fundamentals.map((fund) => (
                <div
                  key={fund.code}
                  className="rounded-card border border-border bg-surface p-4 hover:border-gold/20 transition-colors"
                >
                  <h4 className="text-lg font-semibold text-ivory mb-3">{fund.code}</h4>
                  <div className="space-y-2 text-xs">
                    {fund.per !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted">PER</span>
                        <span className="tabular font-medium text-ivory">
                          {fmtNumber(fund.per, 1)}x
                        </span>
                      </div>
                    )}
                    {fund.pb !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted">P/B</span>
                        <span className="tabular font-medium text-ivory">
                          {fmtNumber(fund.pb, 2)}x
                        </span>
                      </div>
                    )}
                    {fund.graham !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Graham</span>
                        <span className="tabular font-medium text-ivory">
                          {fmtFcfa(fund.graham)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-card border border-border bg-surface p-6">
              <h4 className="text-sm font-semibold text-ivory mb-3">Recommandations</h4>
              <p className="text-sm leading-relaxed text-muted text-justify whitespace-pre-wrap">
                {report.recommendations || 'Aucune recommandation disponible.'}
              </p>
            </div>
          </>
        ) : (
          <EmptyStatePremium title="Aucune donnée fondamentale" hint="Vérifiez vos sources" />
        )}
      </div>

      {/* PAGE 4: Events & Context */}
      <div className="space-y-6 border-t border-border pt-6 pb-8">
        <h3 className="font-display text-xl text-gold">Événements & Contexte</h3>

        {report.events && report.events.length > 0 ? (
          <>
            <div className="space-y-3">
              {report.events.map((event, idx) => (
                <div
                  key={idx}
                  className="rounded-card border border-border bg-surface p-4 hover:border-gold/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-ivory text-sm">{event.title}</h4>
                    <span className="text-[10px] text-muted bg-elevated px-2 py-1 rounded whitespace-nowrap">
                      {new Date(event.date).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{event.impact}</p>
                </div>
              ))}
            </div>

            <div className="rounded-card border border-border bg-surface p-6">
              <h4 className="text-sm font-semibold text-ivory mb-3">Impact sur le marché</h4>
              <p className="text-sm leading-relaxed text-muted text-justify whitespace-pre-wrap">
                {report.eventNarrative || 'Aucune analyse disponible.'}
              </p>
            </div>
          </>
        ) : (
          <EmptyStatePremium title="Aucun événement majeur" hint="Marché stable ce mois" />
        )}
      </div>
    </div>
  );
}

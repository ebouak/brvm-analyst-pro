'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import {
  getMonthDays,
  assignDividends,
  filterDividends,
  getCountdown,
  estimatedYield,
  getSectors,
  type DividendCalendarEvent,
  type CalendarDay,
} from '@/lib/dividend/calendar';

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

// Week starts Monday (L, M, M, J, V, S, D)
const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface DividendCalendarProps {
  dividends: DividendCalendarEvent[];
  defaultYear?: number;
  defaultMonth?: number;
  maxWidth?: string;
}

export function DividendCalendar({
  dividends,
  defaultYear,
  defaultMonth,
  maxWidth = 'max-w-6xl',
}: DividendCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(defaultYear ?? now.getFullYear());
  const [month, setMonth] = useState(defaultMonth ?? now.getMonth());
  const [sector, setSector] = useState<string>('');
  const [rendementMin, setRendementMin] = useState<number | undefined>();
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const [isMobileListView, setIsMobileListView] = useState(false);

  const sectors = useMemo(() => getSectors(dividends), [dividends]);

  const filtered = useMemo(() => filterDividends(dividends, sector || undefined, rendementMin), [dividends, sector, rendementMin]);

  const calendarDays = useMemo(() => {
    const days = getMonthDays(year, month);
    return assignDividends(days, filtered);
  }, [year, month, filtered]);

  const weeks = useMemo(() => {
    const w: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      w.push(calendarDays.slice(i, i + 7));
    }
    return w;
  }, [calendarDays]);

  const upcomingDividends = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return filtered
      .filter((div) => div.ex_date >= today)
      .sort((a, b) => a.ex_date.localeCompare(b.ex_date))
      .slice(0, 10);
  }, [filtered]);

  const handlePrevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          {sectors.length > 0 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="sector-select" className="text-xs font-medium text-muted">Secteur</label>
              <select
                id="sector-select"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-info transition"
              >
                <option value="">Tous les secteurs</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="rendement-min" className="text-xs font-medium text-muted">Rendement min (%)</label>
            <input
              id="rendement-min"
              type="number"
              min="0"
              step="0.1"
              value={rendementMin ?? ''}
              onChange={(e) => setRendementMin(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="Aucun minimum"
              className="w-full md:w-32 rounded-card border border-border bg-surface px-3 py-2 text-sm text-ivory placeholder-muted focus:outline-none focus:ring-1 focus:ring-info transition"
            />
          </div>
        </div>

        {/* Mobile view toggle */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileListView(!isMobileListView)}
            className="px-3 py-2 rounded-card border border-border bg-surface text-sm text-ivory hover:bg-elevated transition"
          >
            {isMobileListView ? 'Calendrier' : 'Liste'}
          </button>
        </div>
      </div>

      {/* Desktop Calendar Grid (hidden on mobile, shown on md+) */}
      <div className={`hidden md:block rounded-panel border p-1.5 border-border/50 bg-border/20`}>
        <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-6">
          {/* Month/Year Header */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ivory">
              {MONTH_NAMES[month]} {year}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-card p-2 hover:bg-elevated transition text-muted hover:text-ivory"
                aria-label="Mois précédent"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-card p-2 hover:bg-elevated transition text-muted hover:text-ivory"
                aria-label="Mois suivant"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Day names (Mon-Sun) */}
          <div className="mb-3 grid grid-cols-7 gap-2 text-center">
            {DAY_NAMES.map((day) => (
              <div key={day} className="text-xs font-semibold text-muted uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-2">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-2">
                {week.map((day) => {
                  const dayKey = day.date.toISOString().split('T')[0];
                  const hasDividends = day.dividends.length > 0;
                  const isToday =
                    day.date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={dayKey}
                      className={`relative aspect-square rounded-card border p-2 text-center transition group ${
                        hasDividends
                          ? 'border-info/50 bg-info/[0.08] hover:border-info/80 hover:bg-info/[0.12]'
                          : day.isCurrentMonth
                            ? isToday
                              ? 'border-gold/30 bg-gold/[0.05]'
                              : 'border-border/30 bg-surface hover:border-border/50'
                            : 'border-border/20 bg-surface/40 opacity-50'
                      }`}
                      onMouseEnter={() => hasDividends && setHoveredDayKey(dayKey)}
                      onMouseLeave={() => setHoveredDayKey(null)}
                    >
                      {/* Day number */}
                      <div className={`text-xs font-semibold ${
                        day.isCurrentMonth
                          ? isToday
                            ? 'text-gold'
                            : 'text-ivory'
                          : 'text-muted'
                      }`}>
                        {day.dayOfMonth}
                      </div>

                      {/* Dividend badge */}
                      {hasDividends && (
                        <div className="mt-1">
                          <div className="text-[10px] font-bold text-info leading-tight">
                            {(day.dividends[0].montant >= 1000
                              ? `${(day.dividends[0].montant / 1000).toFixed(0)}k`
                              : day.dividends[0].montant.toFixed(0)
                            )} F
                          </div>
                          {day.dividends.length > 1 && (
                            <div className="text-xs text-info/70">
                              +{day.dividends.length - 1}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Hover Popover */}
                      {hoveredDayKey === dayKey && hasDividends && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2 w-80 rounded-card border border-border/60 bg-elevated p-4 shadow-lg text-left text-xs">
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {day.dividends.map((div, idx) => (
                              <div
                                key={idx}
                                className={`pb-3 ${
                                  idx < day.dividends.length - 1
                                    ? 'border-b border-border/30'
                                    : ''
                                }`}
                              >
                                {/* Code & Designation */}
                                <div className="font-semibold text-ivory">
                                  {div.code}
                                </div>
                                {div.designation && (
                                  <div className="text-muted text-xs mt-0.5">
                                    {div.designation}
                                  </div>
                                )}

                                {/* Details grid */}
                                <div className="mt-2 space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted">Montant:</span>
                                    <span className="font-semibold text-ivory">
                                      {div.montant.toLocaleString('fr-FR')} FCFA
                                    </span>
                                  </div>

                                  {estimatedYield(div) !== null && (
                                    <div className="flex justify-between">
                                      <span className="text-muted">Rendement:</span>
                                      <span className="font-semibold text-up">
                                        {estimatedYield(div)?.toFixed(2)}%
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex justify-between">
                                    <span className="text-muted">Paiement:</span>
                                    <span className="text-ivory font-medium">
                                      {new Date(div.payment_date).toLocaleDateString('fr-FR')}
                                    </span>
                                  </div>

                                  <div className="flex justify-between pt-1">
                                    <span className="text-muted">Statut:</span>
                                    <span className="font-semibold text-info">
                                      {getCountdown(div.ex_date)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile List View (shown on mobile when toggled) */}
      {isMobileListView && (
        <div className="md:hidden space-y-3">
          <h3 className="text-sm font-semibold text-ivory">Prochains dividendes</h3>
          {upcomingDividends.length === 0 ? (
            <div className="rounded-card border border-border/30 bg-surface/50 p-4 text-center text-xs text-muted">
              Aucun dividende déclaré pour cette période.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingDividends.map((div) => (
                <div
                  key={`${div.code}-${div.ex_date}`}
                  className="rounded-card border border-info/30 bg-info/[0.08] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-ivory text-sm">
                        {div.code}
                      </div>
                      {div.designation && (
                        <div className="text-xs text-muted mt-0.5">
                          {div.designation}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-info text-sm">
                        {div.taux?.toFixed(1)}%
                      </div>
                      <div className="text-xs text-info/70 mt-0.5">
                        {getCountdown(div.ex_date)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted">
                      Détachement:{' '}
                      <span className="text-ivory font-medium">
                        {new Date(div.ex_date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {estimatedYield(div) !== null && (
                      <div className="text-muted">
                        Rendement:{' '}
                        <span className="text-emerald-400 font-medium">
                          {estimatedYield(div)?.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state (when no dividends match filters) */}
      {filtered.length === 0 && (
        <div className="rounded-card border border-border/30 bg-surface/50 p-12 text-center">
          <div className="text-4xl mb-3 text-muted">◎</div>
          <h3 className="font-semibold text-ivory text-sm mb-1">
            Aucun dividende déclaré
          </h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {sector || rendementMin ? 'Aucun dividende ne correspond à vos critères de filtrage.' : 'Aucun dividende enregistré pour cette période.'}
          </p>
        </div>
      )}

      {/* Stats bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-info/60" />
            <span className="text-muted">
              <span className="font-semibold text-ivory">{filtered.length}</span> dividende
              {filtered.length > 1 ? 's' : ''}
            </span>
          </div>
          {upcomingDividends.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
              <span className="text-muted">
                <span className="font-semibold text-ivory">{upcomingDividends.length}</span> à
                venir
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

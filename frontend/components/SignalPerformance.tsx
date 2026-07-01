import Link from 'next/link';
import type { BacktestStats, RecentRealSignal } from '@/lib/signals/backtest';
import { fmtDateFR } from '@/lib/format';

/**
 * Track record des signaux — DEUX blocs volontairement séparés pour ne
 * jamais mélanger deux notions différentes :
 * 1) Backtest rétroactif (méthode de scoring actuelle appliquée à
 *    l'historique) — mesure la MÉTHODE, pas des signaux réellement émis.
 * 2) Signaux réels de production (signals_daily) — les vrais signaux émis
 *    au jour le jour, avec leur performance à ce jour.
 */
export default function SignalPerformance({
  backtest,
  recentReal,
}: {
  backtest: BacktestStats;
  recentReal: RecentRealSignal[];
}) {
  return (
    <div className="space-y-4">
      {/* ── Bloc 1 : backtest rétroactif de la méthode ─────────────────── */}
      <div className="rounded-card border border-border bg-surface shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="overline text-gold-2">Performance de la méthode (backtest rétroactif)</p>
          {backtest.n > 0 && (
            <span className="text-[11px] text-faint">
              {backtest.n} signaux BUY sur 24 mois
            </span>
          )}
        </div>

        {backtest.n === 0 ? (
          <p className="text-sm text-muted">Backtest non encore calculé.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-bg/40 p-4 text-center">
                <p className="tabular font-display text-2xl text-white">{backtest.n}</p>
                <p className="text-[11px] text-faint mt-1">signaux BUY analysés</p>
              </div>
              <div className="rounded-xl border border-border bg-bg/40 p-4 text-center">
                <p className={`tabular font-display text-2xl ${backtest.avgPerfPct != null && backtest.avgPerfPct >= 0 ? 'text-up' : 'text-down'}`}>
                  {backtest.avgPerfPct != null ? `${backtest.avgPerfPct >= 0 ? '+' : ''}${backtest.avgPerfPct.toFixed(2)}%` : '—'}
                </p>
                <p className="text-[11px] text-faint mt-1">performance moyenne à ~30j</p>
              </div>
              <div className="rounded-xl border border-border bg-bg/40 p-4 text-center">
                <p className="tabular font-display text-2xl text-white">
                  {backtest.pctPositive != null ? `${backtest.pctPositive.toFixed(0)}%` : '—'}
                </p>
                <p className="text-[11px] text-faint mt-1">de signaux positifs</p>
              </div>
            </div>

            <div className="rounded-lg border border-info/25 bg-info/[0.06] px-4 py-3 text-xs text-muted leading-relaxed">
              <span className="font-medium text-white">Méthodologie : </span>
              ces chiffres proviennent d&apos;un <span className="text-white">backtest rétroactif</span> — la méthode
              de scoring actuelle appliquée à l&apos;historique des cours ({backtest.periodFrom ? fmtDateFR(backtest.periodFrom) : '—'} →{' '}
              {backtest.periodTo ? fmtDateFR(backtest.periodTo) : '—'}), pas des signaux réellement émis en temps réel
              à l&apos;époque. Aucun frais de courtage ni slippage n&apos;est pris en compte. Les performances passées
              ne garantissent pas les performances futures.
            </div>
          </>
        )}
      </div>

      {/* ── Bloc 2 : signaux réels récents ─────────────────────────────── */}
      {recentReal.length > 0 && (
        <div className="rounded-card border border-border bg-surface shadow-card p-5 space-y-3">
          <p className="overline text-gold-2">Derniers signaux d&apos;achat réels</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted border-b border-border">
                <tr>
                  <th className="px-2 py-2 text-left">Titre</th>
                  <th className="px-2 py-2 text-left">Émis le</th>
                  <th className="px-2 py-2 text-right">Cours signal</th>
                  <th className="px-2 py-2 text-right">Cours actuel</th>
                  <th className="px-2 py-2 text-right">Perf. à ce jour</th>
                </tr>
              </thead>
              <tbody>
                {recentReal.map((s) => (
                  <tr key={`${s.code}-${s.dateSignal}`} className="border-b border-border/40">
                    <td className="px-2 py-2">
                      <Link href={`/actions/${s.code}`} className="font-medium text-white hover:text-info">
                        {s.code}
                      </Link>
                      {s.designation && <div className="text-[11px] text-faint">{s.designation}</div>}
                    </td>
                    <td className="px-2 py-2 text-muted">
                      {fmtDateFR(s.dateSignal)}
                      <div className="text-[10px] text-faint">{s.joursEcoules} j</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular">{s.coursSignal.toLocaleString('fr-FR')}</td>
                    <td className="px-2 py-2 text-right tabular">
                      {s.coursActuel != null ? s.coursActuel.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className={`px-2 py-2 text-right tabular font-medium ${s.perfPct != null && s.perfPct >= 0 ? 'text-up' : 'text-down'}`}>
                      {s.perfPct != null ? `${s.perfPct >= 0 ? '+' : ''}${s.perfPct.toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-faint italic">
            Signaux réellement émis en production (pas de backtest) — performance mesurée depuis la date d&apos;émission,
            sur un horizon encore court pour les plus récents.
          </p>
        </div>
      )}
    </div>
  );
}

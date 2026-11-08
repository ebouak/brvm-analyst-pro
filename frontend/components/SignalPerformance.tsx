import Link from 'next/link';
import type { BacktestStats, RecentRealSignal } from '@/lib/signals/backtest';
import { fmtDateFR, fmtNumber, fmtPctSigne } from '@/lib/format';

/**
 * Track record des signaux — DEUX blocs volontairement séparés pour ne
 * jamais mélanger deux notions différentes :
 * 1) Backtest rétroactif (méthode de scoring actuelle appliquée à
 *    l'historique) — mesure la MÉTHODE, pas des signaux réellement émis.
 * 2) Signaux réels de production (signals_daily) — les vrais signaux émis
 *    au jour le jour, avec leur performance à ce jour.
 */
const TITRE = 'font-display text-lg text-ivory';

function Chiffre({ valeur, legende }: { valeur: string; legende: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-4 text-center">
      {/* Le chiffre ne se sépare jamais de son unité (« −17,63 % », « 0 / 10 ») à 375 px. */}
      <p className="tabular font-display text-2xl sm:text-3xl text-ivory whitespace-nowrap">{valeur}</p>
      <p className="text-xs text-muted mt-1">{legende}</p>
    </div>
  );
}

function mediane(v: number[]): number | null {
  if (v.length === 0) return null;
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export default function SignalPerformance({
  backtest,
  recentReal,
}: {
  backtest: BacktestStats;
  recentReal: RecentRealSignal[];
}) {
  const perfs = recentReal.map((s) => s.perfPct).filter((v): v is number => v != null);
  const moyenne = perfs.length ? perfs.reduce((a, b) => a + b, 0) / perfs.length : null;
  const med = mediane(perfs);
  const enHausse = perfs.filter((v) => v > 0).length;
  const enBaisse = perfs.filter((v) => v < 0).length;

  return (
    <div className="space-y-4">
      {/* ── Bloc 2 : signaux réels récents ─────────────────────────────── */}
      {recentReal.length > 0 && (
        <div className="rounded-card border border-border bg-surface shadow-card p-5 space-y-3">
          <h2 className={TITRE}>Derniers signaux d&apos;achat réels</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Chiffre valeur={String(recentReal.length)} legende="signaux d'achat réels" />
            <Chiffre valeur={moyenne != null ? fmtPctSigne(moyenne) : '—'} legende="performance moyenne à ce jour" />
            <Chiffre valeur={med != null ? fmtPctSigne(med) : '—'} legende="performance médiane à ce jour" />
            <Chiffre valeur={`${enHausse} / ${enBaisse}`} legende="en hausse / en baisse" />
          </div>
          <ul className="md:hidden divide-y divide-border/40">
            {recentReal.map((s) => (
              <li key={`m-${s.code}-${s.dateSignal}`} className="py-2.5 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/actions/${s.code}`} className="font-medium text-sm text-white hover:text-info">{s.code}</Link>
                  <span className={`tabular text-sm font-medium ${s.perfPct != null && s.perfPct >= 0 ? 'text-up' : 'text-down'}`}>
                    {s.perfPct != null ? fmtPctSigne(s.perfPct) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="min-w-0 truncate" title={s.designation ?? s.code}>{s.designation ?? ''}</span>
                  <span className="tabular shrink-0">
                    {s.coursSignal.toLocaleString('fr-FR')} → {s.coursActuel != null ? s.coursActuel.toLocaleString('fr-FR') : '—'}
                  </span>
                </div>
                <p className="text-xs text-faint">Émis le {fmtDateFR(s.dateSignal)} ({s.joursEcoules} j)</p>
              </li>
            ))}
          </ul>
          <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="hidden md:block overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
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
                      <div className="text-[11px] text-faint">{s.joursEcoules} j</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular">{s.coursSignal.toLocaleString('fr-FR')}</td>
                    <td className="px-2 py-2 text-right tabular">
                      {s.coursActuel != null ? s.coursActuel.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className={`px-2 py-2 text-right tabular font-medium ${s.perfPct != null && s.perfPct >= 0 ? 'text-up' : 'text-down'}`}>
                      {s.perfPct != null ? fmtPctSigne(s.perfPct) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-faint italic">
            Signaux réellement émis en production (pas de backtest), performance mesurée depuis la date d&apos;émission,
            sur un horizon encore court pour les plus récents.
          </p>
        </div>
      )}

      {/* ── Bloc 1 : backtest rétroactif de la méthode ─────────────────── */}
      <div className="rounded-card border border-border bg-surface shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className={TITRE}>Mesure historique : backtest rétroactif de la méthode</h2>
          {backtest.n > 0 && (
            <span className="text-[11px] text-faint">
              {backtest.n} signaux d&apos;achat sur 24 mois
            </span>
          )}
        </div>

        {backtest.n === 0 ? (
          <p className="text-sm text-muted">Backtest non encore calculé.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Chiffre valeur={String(backtest.n)} legende="signaux d'achat analysés" />
              <Chiffre valeur={backtest.avgPerfPct != null ? fmtPctSigne(backtest.avgPerfPct) : '—'} legende="performance moyenne à ~30j" />
              <Chiffre valeur={backtest.pctPositive != null ? `${fmtNumber(backtest.pctPositive, 0)} %` : '—'} legende="de signaux positifs" />
            </div>

            <div className="rounded-lg border border-info/25 bg-info/[0.06] px-4 py-3 text-xs text-muted leading-relaxed">
              <span className="font-medium text-white">Méthodologie : </span>
              ces chiffres proviennent d&apos;un <span className="text-white">backtest rétroactif</span> : la méthode
              de scoring actuelle appliquée à l&apos;historique des cours ({backtest.periodFrom ? fmtDateFR(backtest.periodFrom) : '—'} →{' '}
              {backtest.periodTo ? fmtDateFR(backtest.periodTo) : '—'}), pas des signaux réellement émis en temps réel
              à l&apos;époque. Aucun frais de courtage ni slippage n&apos;est pris en compte. Les performances passées
              ne garantissent pas les performances futures.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

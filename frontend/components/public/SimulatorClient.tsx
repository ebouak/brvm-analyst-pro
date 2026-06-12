'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { simulateInvestment, type SimulationResult, type PricePoint } from '@/lib/simulate';
import Sparkline from '@/components/public/Sparkline';
import { fmtNumber } from '@/lib/format';

export interface CompanyOption {
  code: string;
  designation: string;
}

const PRESETS = [
  { label: '1 an', years: 1 },
  { label: '3 ans', years: 3 },
  { label: '5 ans', years: 5 },
];

const AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];

export default function SimulatorClient({
  companies,
  initialCode,
}: {
  companies: CompanyOption[];
  initialCode?: string;
}) {
  const [code, setCode] = useState(initialCode ?? companies[0]?.code ?? '');
  const [amount, setAmount] = useState(1_000_000);
  const [years, setYears] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [series, setSeries] = useState<number[]>([]);
  const [shareCopied, setShareCopied] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const supabase = createClient();
      const fromDate = new Date();
      fromDate.setFullYear(fromDate.getFullYear() - years);
      const fromIso = fromDate.toISOString().split('T')[0]!;

      const [{ data: rows, error: qErr }, { data: divs }] = await Promise.all([
        supabase
          .from('brvm_actions_daily')
          .select('date_marche, cours_jour')
          .eq('code', code)
          .gte('date_marche', fromIso)
          .order('date_marche', { ascending: true }),
        supabase
          .from('dividends')
          .select('montant, payment_date, ex_date')
          .eq('code', code),
      ]);
      if (qErr) throw new Error(qErr.message);

      const prices: PricePoint[] = (rows ?? [])
        .filter((r) => r.cours_jour != null && r.cours_jour > 0)
        .map((r) => ({ date: r.date_marche as string, close: r.cours_jour as number }));

      const dividends = (divs ?? [])
        .map((d) => ({ date: (d.payment_date ?? d.ex_date ?? '') as string, montant: d.montant as number }))
        .filter((d) => d.date);

      const sim = simulateInvestment(amount, fromIso, prices, dividends);
      if (!sim) {
        setError(
          prices.length < 2
            ? "Historique insuffisant pour cette période — essayez une période plus courte."
            : 'Montant insuffisant pour acheter au moins une action à cette date.',
        );
        return;
      }
      setResult(sim);
      setSeries(prices.filter((p) => p.date >= sim.startDate).map((p) => p.close));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la simulation.');
    } finally {
      setLoading(false);
    }
  }, [code, amount, years]);

  const share = useCallback(async () => {
    if (!result) return;
    const company = companies.find((c) => c.code === code);
    const text = `📈 Si j'avais investi ${fmtNumber(amount)} FCFA dans ${company?.designation ?? code} il y a ${years} an${years > 1 ? 's' : ''}, j'aurais aujourd'hui ${fmtNumber(Math.round(result.finalValue))} FCFA (${result.totalReturnPct >= 0 ? '+' : ''}${fmtNumber(result.totalReturnPct, 1)} %). Calculé sur BRVM Analyst Pro :`;
    const url = `${window.location.origin}/simulateur/${code}?montant=${amount}&annees=${years}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        /* annulé par l'utilisateur */
      }
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }, [result, companies, code, amount, years]);

  const positive = (result?.gain ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* ── Formulaire ───────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div>
          <label htmlFor="sim-code" className="block text-xs text-muted mb-1.5">Société</label>
          <select
            id="sim-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {companies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.designation} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sim-amount" className="block text-xs text-muted mb-1.5">
            Montant investi (FCFA)
          </label>
          <div className="flex flex-wrap gap-2 mb-2.5">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                aria-pressed={amount === a ? 'true' : 'false'}
                className={`px-3.5 py-2 rounded-lg border text-sm tabular transition-colors active:scale-95 ${
                  amount === a
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted hover:text-white hover:border-border-strong'
                }`}
              >
                {fmtNumber(a)}
              </button>
            ))}
          </div>
          <input
            id="sim-amount"
            type="number"
            inputMode="numeric"
            min={1000}
            step={1000}
            value={amount}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v) && v >= 0) setAmount(v);
            }}
            placeholder="Ou saisissez un montant libre…"
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-white tabular focus:outline-none focus:ring-2 focus:ring-accent/50"
            aria-label="Montant personnalisé en FCFA"
          />
        </div>

        <div>
          <p className="text-xs text-muted mb-1.5">Il y a…</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.years}
                type="button"
                onClick={() => setYears(p.years)}
                aria-pressed={years === p.years ? 'true' : 'false'}
                className={`px-3.5 py-2 rounded-lg border text-sm transition-colors active:scale-95 ${
                  years === p.years
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted hover:text-white hover:border-border-strong'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={loading || !code}
          className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-accent text-bg font-semibold hover:bg-gold-2 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Calcul en cours…' : 'Calculer'}
        </button>

        {error && (
          <p className="text-down text-sm" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* ── Résultat ─────────────────────────────────────────────────────── */}
      {loading && <div className="animate-pulse bg-surface border border-border rounded-xl h-48" />}

      {result && !loading && (
        <div className={`bg-surface border rounded-xl p-6 ${positive ? 'border-up/40' : 'border-down/40'}`}>
          <p className="text-xs text-muted mb-1">
            {fmtNumber(amount)} FCFA investis le {result.startDate} ({result.shares} actions à{' '}
            {fmtNumber(result.startPrice)} FCFA)
          </p>
          <p className="tabular text-4xl font-bold text-white mb-1">
            {fmtNumber(Math.round(result.finalValue))} <span className="text-lg text-muted">FCFA</span>
          </p>
          <p className={`tabular text-lg font-semibold mb-4 ${positive ? 'text-up' : 'text-down'}`}>
            {positive ? '+' : ''}
            {fmtNumber(Math.round(result.gain))} FCFA ({positive ? '+' : ''}
            {fmtNumber(result.totalReturnPct, 1)} %)
            {result.annualizedReturnPct != null && (
              <span className="text-muted text-sm font-normal">
                {' '}
                · {positive ? '+' : ''}
                {fmtNumber(result.annualizedReturnPct, 1)} %/an
              </span>
            )}
          </p>

          {series.length >= 2 && <Sparkline values={series} positive={positive} />}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-sm">
            <div>
              <p className="text-[11px] text-faint">Valeur des actions</p>
              <p className="tabular text-white">{fmtNumber(Math.round(result.finalStockValue))} FCFA</p>
            </div>
            <div>
              <p className="text-[11px] text-faint">Dont dividendes perçus</p>
              <p className="tabular text-up">{fmtNumber(Math.round(result.totalDividends))} FCFA</p>
            </div>
            <div>
              <p className="text-[11px] text-faint">Cours final ({result.endDate})</p>
              <p className="tabular text-white">{fmtNumber(result.endPrice)} FCFA</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              type="button"
              onClick={share}
              className="px-5 py-2.5 rounded-lg bg-accent text-bg font-semibold hover:bg-gold-2 transition-colors active:scale-95"
            >
              {shareCopied ? '✓ Lien copié !' : 'Partager ce résultat'}
            </button>
            <a
              href={`/societes/${code}`}
              className="px-4 py-2 rounded-lg border border-border text-muted hover:text-white hover:border-border-strong transition-colors text-sm"
            >
              Voir la fiche {code}
            </a>
          </div>

          <p className="text-[11px] text-faint mt-4 leading-relaxed">
            Simulation fondée sur les cours de clôture historiques et les dividendes enregistrés (non
            réinvestis). Performances passées ne préjugent pas des performances futures.
          </p>
        </div>
      )}
    </div>
  );
}

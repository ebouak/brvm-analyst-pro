'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtNumber, fmtFcfa } from '@/lib/format';

type Act = 'acheter' | 'conserver' | 'vendre' | null;
interface Pos {
  code: string; quantite: number; pru: number; cours: number | null;
  valeur: number | null; pnl: number | null; pnlPct: number | null;
  action: Act; conviction: number | null; reasons: string[];
}

const VERB: Record<'acheter' | 'conserver' | 'vendre', string> = { acheter: 'Renforcer', conserver: 'Conserver', vendre: 'Alléger' };
const BADGE: Record<'acheter' | 'conserver' | 'vendre', string> = {
  acheter: 'bg-up/15 text-up border-up/30',
  conserver: 'bg-gold/10 text-gold border-gold/25',
  vendre: 'bg-down/15 text-down border-down/30',
};

export function MyPortfolioAdvice() {
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);
  const [positions, setPositions] = useState<Pos[]>([]);

  useEffect(() => {
    fetch('/api/advisor/portfolio')
      .then((r) => r.json())
      .then((d) => { setLogged(!!d.logged); setPositions(d.positions ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-24 rounded-xl border border-border bg-surface animate-pulse" />;
  if (!logged) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <Link href="/login" className="text-info hover:underline">Connectez-vous</Link> pour obtenir des conseils sur votre portefeuille.
      </div>
    );
  }
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        Aucune position. <Link href="/portefeuille" className="text-info hover:underline">Ajoutez votre portefeuille</Link> pour des conseils personnalisés.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg text-white">Mon portefeuille — conseils</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
              <th className="px-3 py-2.5 text-left font-semibold">Valeur</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qté</th>
              <th className="px-3 py-2.5 text-right font-semibold">PRU</th>
              <th className="px-3 py-2.5 text-right font-semibold">Cours</th>
              <th className="px-3 py-2.5 text-right font-semibold">P&amp;L</th>
              <th className="px-3 py-2.5 text-center font-semibold">Conseil</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const up = (p.pnl ?? 0) >= 0;
              return (
                <tr key={p.code} className="border-b border-border/30">
                  <td className="px-3 py-3">
                    <Link href={`/actions/${p.code}`} className="font-semibold text-white hover:text-info">{p.code}</Link>
                  </td>
                  <td className="px-3 py-3 text-right tabular text-muted">{fmtNumber(p.quantite)}</td>
                  <td className="px-3 py-3 text-right tabular text-muted">{fmtNumber(p.pru)}</td>
                  <td className="px-3 py-3 text-right tabular text-white">{p.cours != null ? fmtNumber(p.cours) : '—'}</td>
                  <td className={`px-3 py-3 text-right tabular font-medium ${p.pnl == null ? 'text-faint' : up ? 'text-up' : 'text-down'}`}>
                    {p.pnl != null ? `${up ? '+' : ''}${fmtFcfa(p.pnl)}` : '—'}
                    {p.pnlPct != null && <span className="ml-1 text-[11px] opacity-80">({up ? '+' : ''}{p.pnlPct.toFixed(1)}%)</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {p.action ? (
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${BADGE[p.action]}`} title={p.reasons.slice(0, 2).join(' · ')}>
                        {VERB[p.action]}{p.conviction != null ? ` ${p.conviction}%` : ''}
                      </span>
                    ) : <span className="text-xs text-faint">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-faint">Conseil dérivé des signaux réels — exécutez via votre SGI. Survolez un conseil pour les raisons.</p>
    </section>
  );
}

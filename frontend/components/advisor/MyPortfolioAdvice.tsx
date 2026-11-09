'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import type { CleFamille, Tier } from '@/lib/conseiller/facteurs';
import { profilDe, LIBELLE_PROFIL } from '@/lib/conseiller/profil';
import { Jauges } from '@/components/conseiller/Jauges';

interface Pos {
  code: string; quantite: number; pru: number; cours: number | null;
  valeur: number | null; pnl: number | null; pnlPct: number | null;
  tiers: Partial<Record<CleFamille, Tier | null>>;
  scores?: Partial<Record<CleFamille, number | null>>;
  classe_liquidite: 'A' | 'B' | 'C' | 'D' | null;
}

export function MyPortfolioAdvice() {
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    fetch('/api/advisor/portfolio')
      .then((r) => r.json())
      .then((d) => { setLogged(!!d.logged); setPositions(d.positions ?? []); setErreur(!!d.erreur); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-24 rounded-xl border border-border bg-surface animate-pulse" />;
  if (!logged) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <Link href="/login" className="text-info hover:underline">Connectez-vous</Link> pour voir la position de vos lignes.
      </div>
    );
  }
  if (erreur) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        Positions momentanément illisibles.
      </div>
    );
  }
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        Aucune position. <Link href="/portefeuille" className="text-info hover:underline">Ajoutez votre portefeuille</Link> pour voir la position de vos lignes.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg text-white">Mes positions</h2>
      <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
              <th className="px-3 py-2.5 text-left font-semibold">Valeur</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qté</th>
              <th className="px-3 py-2.5 text-right font-semibold">PRU</th>
              <th className="px-3 py-2.5 text-right font-semibold">Cours</th>
              <th className="px-3 py-2.5 text-right font-semibold">P&amp;L</th>
              <th className="px-3 py-2.5 text-left font-semibold">Liquidité</th>
              <th className="px-3 py-2.5 text-left font-semibold">Profil</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const up = (p.pnl ?? 0) >= 0;
              return (
                <tr key={p.code} className="border-b border-border/30">
                  <td className="px-3 py-3">
                    <Link href={`/actions/${p.code}`} className="font-semibold text-white hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{p.code}</Link>
                  </td>
                  <td className="px-3 py-3 text-right tabular text-muted">{fmtNumber(p.quantite)}</td>
                  <td className="px-3 py-3 text-right tabular text-muted">{fmtNumber(p.pru)}</td>
                  <td className="px-3 py-3 text-right tabular text-white">{p.cours != null ? fmtNumber(p.cours) : '—'}</td>
                  <td className={`px-3 py-3 text-right tabular font-medium ${p.pnl == null ? 'text-faint' : up ? 'text-up' : 'text-down'}`}>
                    {p.pnl != null ? `${up ? '+' : ''}${fmtFcfa(p.pnl)}` : '—'}
                    {p.pnlPct != null && <span className="ml-1 text-[11px] opacity-80">({up ? '+' : ''}{p.pnlPct.toFixed(1)}%)</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-ivory">{p.classe_liquidite ?? '—'}</td>
                  <td className="px-3 py-3">
                    <p className="mb-1.5 text-xs text-ivory">{LIBELLE_PROFIL[profilDe(p.tiers)]}</p>
                    <Jauges compact scores={p.scores} tiers={p.tiers} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-faint">Profil et jauges par famille, sans recommandation : à vous de décider. Exécution via votre SGI.</p>
    </section>
  );
}

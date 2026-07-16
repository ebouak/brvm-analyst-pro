'use client';

import { useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { UnifiedReport } from '@/lib/macro/unifiedReturn';

const nf = new Intl.NumberFormat('fr-FR');
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)} %`;

const UP = '#3fe18b';
const DOWN = '#ff6b6b';
const ACCENT = '#56D7FD';

/**
 * Explorateur interactif du rendement (réel OU vrai selon le mode déjà résolu
 * côté serveur). L'utilisateur sélectionne un pays d'un clic — cartes, barème de
 * décomposition et graphique se recalent instantanément, sans rechargement.
 */
export function RendementExplorer({ report }: { report: UnifiedReport }) {
  // Par défaut : le pays le plus favorable (le tableau arrive déjà trié).
  const [selCode, setSelCode] = useState(report.pays[0]?.code ?? '');
  const sel = report.pays.find((p) => p.code === selCode) ?? report.pays[0];

  if (!sel) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Données d’inflation indisponibles sur cette période.
      </div>
    );
  }

  const avecDiv = report.mode === 'vrai' && report.dividendes.length > 0;

  // Données du graphique : rendement réel par pays, trié décroissant.
  const chart = [...report.pays]
    .sort((a, b) => b.realPct - a.realPct)
    .map((p) => ({ code: p.code, nom: p.nom, real: Math.round(p.realPct * 100) / 100 }));

  return (
    <div className="space-y-6">
      {/* ── Le contraste : cours seul vs ce qui reste vraiment ── */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="overline text-faint">Ce que tout le monde affiche</p>
          <p className="mt-1 text-xs text-muted">Performance du cours seul</p>
          <p className={`tabular mt-2 text-3xl font-semibold ${report.prixSeulPct >= 0 ? 'text-up' : 'text-down'}`}>
            {pct(report.prixSeulPct)}
          </p>
          <p className="mt-2 text-xs text-faint">
            {nf.format(report.coursDebut)} → {nf.format(report.coursFin)} FCFA
          </p>
        </div>

        <div className="rounded-xl border border-accent/40 bg-accent/5 p-5">
          <p className="overline text-accent">Ce que vous avez vraiment gagné</p>
          <p className="mt-1 text-xs text-muted">
            {avecDiv ? 'Dividendes nets réinvestis, ' : ''}après inflation — <strong className="text-ivory">{sel.nom}</strong>
          </p>
          <p className={`tabular mt-2 text-3xl font-semibold ${sel.perte ? 'text-down' : 'text-up'}`}>
            {pct(sel.realPct)}
          </p>
          <p className="mt-2 text-xs text-faint">
            1 000 000 FCFA deviennent{' '}
            <strong className={sel.perte ? 'text-down' : 'text-ivory'}>{nf.format(sel.pouvoirAchat)} FCFA</strong>
            {' '}en pouvoir d’achat
          </p>
        </div>
      </section>

      {/* ── La décomposition : d'où vient le chiffre ── */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-xs font-semibold text-ivory">Décomposition — {sel.nom}</h3>
        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          <Etape label="Cours seul" value={pct(report.prixSeulPct)} tone={report.prixSeulPct >= 0 ? 'up' : 'down'} />
          {avecDiv && (
            <>
              <Signe>+</Signe>
              <Etape label="Dividendes réinvestis" value={`+${report.apportDividendesPts.toFixed(2)} pts`} tone="accent" />
            </>
          )}
          <Signe>−</Signe>
          <Etape label="Inflation" value={`${sel.cumulPct.toFixed(2)} %`} tone="down" />
          <Signe>=</Signe>
          <Etape label="Rendement vrai" value={pct(sel.realPct)} tone={sel.perte ? 'down' : 'up'} strong />
        </div>
      </section>

      {/* ── Dividendes encaissés (mode vrai) ── */}
      {avecDiv && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-xs font-semibold text-ivory">Dividendes nets encaissés</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {report.dividendes.map((d) => (
              <div key={d.exercice} className="rounded-lg border border-border/60 bg-bg px-3 py-2">
                <p className="text-[11px] text-faint">Exercice {d.exercice}</p>
                <p className="tabular text-sm font-semibold text-ivory">{nf.format(d.montantNet)} FCFA</p>
                <p className="text-[10px] text-faint">réinvesti à {nf.format(d.coursReinvest)}</p>
              </div>
            ))}
            <div className="rounded-lg border border-up/30 bg-up/5 px-3 py-2">
              <p className="text-[11px] text-faint">Total net</p>
              <p className="tabular text-sm font-semibold text-up">{nf.format(report.totalDividendesNets)} FCFA</p>
              <p className="text-[10px] text-faint">par action détenue</p>
            </div>
          </div>
        </section>
      )}

      {/* ── LE cœur : le même titre, huit pouvoirs d'achat ── */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl text-white">Le même titre, huit résultats différents</h2>
          <p className="mt-1 text-sm text-muted">
            Même action, même cours{avecDiv ? ', mêmes dividendes nets' : ''}. Mais l’
            <strong className="text-white">inflation de votre pays</strong> décide de ce qu’il vous en reste.
            Cliquez un pays pour l’explorer.
          </p>
        </div>

        {/* Puces pays interactives */}
        <div className="flex flex-wrap gap-2">
          {report.pays.map((p) => {
            const on = p.code === sel.code;
            return (
              <button
                key={p.code}
                type="button"
                onClick={() => setSelCode(p.code)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                  on
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface text-muted hover:border-accent/40 hover:text-white'
                }`}
              >
                {p.nom} · <span className="tabular">{pct(p.realPct)}</span>
              </button>
            );
          })}
        </div>

        {/* Graphique en barres — rendement réel par pays */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-3 text-xs text-muted">Rendement réel par pays (%)</p>
          <div style={{ height: Math.max(180, chart.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" tick={{ fill: '#7a9ea8', fontSize: 10 }} tickFormatter={(v) => `${v} %`} />
                <YAxis type="category" dataKey="nom" width={92} tick={{ fill: '#e5e7eb', fontSize: 11 }} />
                <ReferenceLine x={0} stroke="#232733" />
                <Tooltip
                  cursor={{ fill: 'rgba(86,215,253,0.06)' }}
                  formatter={(v: number) => [pct(v), 'Rendement réel']}
                  contentStyle={{ background: '#0a1417', border: '1px solid #1a2a30', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="real" radius={[0, 4, 4, 0]} isAnimationActive={false} onClick={(d: { code?: string }) => d?.code && setSelCode(d.code)}>
                  {chart.map((c) => (
                    <Cell
                      key={c.code}
                      cursor="pointer"
                      fill={c.real < 0 ? DOWN : UP}
                      fillOpacity={c.code === sel.code ? 1 : 0.55}
                      stroke={c.code === sel.code ? ACCENT : 'transparent'}
                      strokeWidth={c.code === sel.code ? 1.5 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tableau détaillé */}
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Pays</th>
                <th className="px-4 py-3 text-right font-medium">Inflation cumulée</th>
                <th className="px-4 py-3 text-right font-medium">Rendement RÉEL</th>
                <th className="px-4 py-3 text-right font-medium">Par an</th>
                <th className="px-4 py-3 text-right font-medium">1 000 000 FCFA deviennent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {report.pays.map((p) => {
                const on = p.code === sel.code;
                return (
                  <tr
                    key={p.code}
                    onClick={() => setSelCode(p.code)}
                    className={`cursor-pointer transition ${
                      on ? 'bg-accent/10' : p.perte ? 'bg-down/5 hover:bg-down/10' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-ivory">{p.nom}</td>
                    <td className="tabular px-4 py-3 text-right text-muted">+{p.cumulPct.toFixed(2)} %</td>
                    <td className={`tabular px-4 py-3 text-right font-semibold ${p.perte ? 'text-down' : 'text-up'}`}>
                      {pct(p.realPct)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-muted">
                      {p.realAnnualisePct === null ? '—' : pct(p.realAnnualisePct)}
                    </td>
                    <td className={`tabular px-4 py-3 text-right ${p.perte ? 'text-down' : 'text-ivory'}`}>
                      {nf.format(p.pouvoirAchat)} FCFA
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {report.pays.some((p) => p.perte) && (
          <p className="rounded-lg border border-down/30 bg-down/5 px-4 py-3 text-xs text-down">
            Les lignes en rouge sont des <strong>pertes réelles</strong> : même
            {avecDiv ? ' dividendes nets compris' : ' '}, le gain n’a pas compensé la hausse des prix.
          </p>
        )}
      </section>
    </div>
  );
}

function Etape({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone: 'up' | 'down' | 'accent';
  strong?: boolean;
}) {
  const color = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-accent';
  return (
    <div
      className={`min-w-[104px] flex-1 rounded-lg border px-3 py-2 ${
        strong ? 'border-accent/40 bg-accent/5' : 'border-border/60 bg-bg'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className={`tabular mt-0.5 text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Signe({ children }: { children: string }) {
  return <span className="self-center text-lg font-semibold text-faint">{children}</span>;
}

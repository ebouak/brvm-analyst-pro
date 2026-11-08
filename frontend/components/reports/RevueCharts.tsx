'use client';

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import { echelleReguliere, type Repere } from '@/lib/reports/reperes';
import { fmtFcfa, fmtNumber } from '@/lib/format';

// Jetons du thème (suivent le mode sombre ou clair) ; l'impression les redéfinit
// pour le papier (classe .doc-impression, voir globals.css).
const ACCENT = 'rgb(var(--color-accent))';
const MUTED = 'rgb(var(--color-muted))';
const FAINT = 'rgb(var(--color-faint))';
const GRILLE = 'rgb(var(--color-border))';
const FOND_INFOBULLE = { fontSize: 12, background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', color: 'rgb(var(--color-ivory))' };

const fr = (n: number) => n.toLocaleString('fr-FR');
const mois = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Cours de clôture, avec les repères de publication de résultats et de détachement de dividende. */
export function PriceChart({ data, reperes = [] }: { data: { date: string; cours: number }[]; reperes?: Repere[] }) {
  if (data.length < 2) return <p className="text-xs text-muted">Historique de cours indisponible.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRILLE} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: MUTED }} minTickGap={56} tickFormatter={mois} />
        <YAxis tick={{ fontSize: 11, fill: MUTED }} width={52} tickFormatter={fr} domain={['auto', 'auto']} />
        <Tooltip formatter={(v: number) => [`${fr(v)} FCFA`, 'Cours']} labelFormatter={(d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
          labelStyle={{ fontSize: 12 }} contentStyle={FOND_INFOBULLE} />
        {reperes.map((r, i) => (
          <ReferenceLine key={`${r.type}-${r.date}-${i}`} x={r.x}
            stroke={r.type === 'resultats' ? ACCENT : MUTED} strokeWidth={1.5}
            strokeDasharray={r.type === 'resultats' ? undefined : '4 3'}
            label={{ value: r.type === 'resultats' ? 'R' : 'D', position: 'top', fontSize: 11, fill: r.type === 'resultats' ? ACCENT : MUTED }} />
        ))}
        <Line type="monotone" dataKey="cours" stroke={ACCENT} strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Unité des graduations : milliards si l'échelle dépasse le milliard, millions sinon. */
function formatGraduation(v: number, pas: number): string {
  const enMd = pas >= 1e9;
  const x = enMd ? v / 1e9 : v / 1e6;
  const p = Math.round((pas / (enMd ? 1e9 : 1e6)) * 1000) / 1000;
  const decimales = Number.isInteger(p) ? 0 : Number.isInteger(p * 10) ? 1 : 2;
  return `${fmtNumber(x, decimales)} ${enMd ? 'Md' : 'M'}`;
}

/** Séries financières pluriannuelles (barres) : CA + résultat net, à graduations régulières. */
export function FinancialsBars({ data }: { data: { periode: string; revenu: number | null; resultatNet: number | null }[] }) {
  const rows = [...data].reverse(); // chronologique
  if (rows.length === 0) return <p className="text-xs text-muted">Données financières indisponibles.</p>;
  const valeurs = rows.flatMap((r) => [r.revenu, r.resultatNet]).filter((v): v is number => v != null);
  const ech = echelleReguliere(Math.min(0, ...valeurs), Math.max(0, ...valeurs));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRILLE} vertical={false} />
        <XAxis dataKey="periode" tick={{ fontSize: 11, fill: MUTED }} />
        <YAxis tick={{ fontSize: 11, fill: MUTED }} width={64} domain={[ech.min, ech.max]} ticks={ech.ticks}
          tickFormatter={(v: number) => formatGraduation(v, ech.pas)} />
        <ReferenceLine y={0} stroke={FAINT} />
        <Tooltip formatter={(v: number, n: string) => [fmtFcfa(v), n === 'revenu' ? "Chiffre d'affaires" : 'Résultat net']}
          contentStyle={FOND_INFOBULLE} />
        <Bar dataKey="revenu" fill={ACCENT} name="revenu" radius={[2, 2, 0, 0]} />
        <Bar dataKey="resultatNet" fill={MUTED} name="resultatNet" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Historique du dividende par exercice. Barres neutres : un dividende qui baisse n'est pas une « baisse de cours ». */
export function DividendBars({ data }: { data: { exercice: number; montant: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-muted">Historique de dividende indisponible.</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRILLE} vertical={false} />
        <XAxis dataKey="exercice" tick={{ fontSize: 11, fill: MUTED }} />
        <YAxis tick={{ fontSize: 11, fill: MUTED }} width={44} tickFormatter={fr} />
        <Tooltip formatter={(v: number) => [`${fr(v)} FCFA`, 'Dividende']} contentStyle={FOND_INFOBULLE} />
        <Bar dataKey="montant" radius={[2, 2, 0, 0]}>
          {data.map((d) => <Cell key={d.exercice} fill={ACCENT} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

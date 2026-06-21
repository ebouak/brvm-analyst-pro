'use client';

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell,
} from 'recharts';

const ORANGE = '#FF7900';
const GREY = '#8a8a8a';
const UP = '#2e9e5b';
const DOWN = '#c0392b';

const fr = (n: number) => n.toLocaleString('fr-FR');

/** Cours sur la durée (ligne). */
export function PriceChart({ data }: { data: { date: string; cours: number }[] }) {
  if (data.length < 2) return <p className="text-xs text-gray-400">Historique de cours indisponible.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#eee" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: GREY }} minTickGap={48}
          tickFormatter={(d: string) => d.slice(0, 7)} />
        <YAxis tick={{ fontSize: 10, fill: GREY }} width={48} tickFormatter={fr} domain={['auto', 'auto']} />
        <Tooltip formatter={(v: number) => [`${fr(v)} FCFA`, 'Cours']} labelStyle={{ fontSize: 11 }}
          contentStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="cours" stroke={ORANGE} strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Séries financières pluriannuelles (barres) : CA + résultat net. */
export function FinancialsBars({ data }: { data: { periode: string; revenu: number | null; resultatNet: number | null }[] }) {
  const rows = [...data].reverse(); // chronologique
  if (rows.length === 0) return <p className="text-xs text-gray-400">Données financières indisponibles.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#eee" vertical={false} />
        <XAxis dataKey="periode" tick={{ fontSize: 10, fill: GREY }} />
        <YAxis tick={{ fontSize: 10, fill: GREY }} width={52} tickFormatter={fr} />
        <Tooltip formatter={(v: number, n: string) => [fr(v), n === 'revenu' ? 'CA' : 'Résultat net']}
          contentStyle={{ fontSize: 11 }} />
        <Bar dataKey="revenu" fill={ORANGE} name="revenu" radius={[2, 2, 0, 0]} />
        <Bar dataKey="resultatNet" fill={GREY} name="resultatNet" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Historique du dividende par exercice (barres colorées hausse/baisse). */
export function DividendBars({ data }: { data: { exercice: number; montant: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-gray-400">Historique de dividende indisponible.</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#eee" vertical={false} />
        <XAxis dataKey="exercice" tick={{ fontSize: 10, fill: GREY }} />
        <YAxis tick={{ fontSize: 10, fill: GREY }} width={44} tickFormatter={fr} />
        <Tooltip formatter={(v: number) => [`${fr(v)} FCFA`, 'Dividende']} contentStyle={{ fontSize: 11 }} />
        <Bar dataKey="montant" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={i > 0 && d.montant < data[i - 1].montant ? DOWN : UP} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

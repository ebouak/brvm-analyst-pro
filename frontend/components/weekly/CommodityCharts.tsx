'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceData {
  nom: string;
  symbole?: string;
  variation_5j_pct?: number;
  variation_mensuelle_pct?: number;
  prix_actuel?: number;
  unite?: string;
}

interface BrvmScore {
  score: number;
  commodites: string[];
  variations: number[];
}

interface CommodityChartsProps {
  yf_prices: Record<string, PriceData>;
  wb_snapshot: Record<string, PriceData>;
  brvm_scores: Record<string, BrvmScore>;
}

// ── Tooltip custom ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="bg-[#0a1417] border border-[#1a2a30] rounded px-3 py-2 text-sm">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className={v >= 0 ? 'text-[#3fe18b] font-semibold' : 'text-[#ff6b6b] font-semibold'}>
        {v >= 0 ? '+' : ''}{v.toFixed(2)}%
      </p>
    </div>
  );
}

function ScoreTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a1417] border border-[#1a2a30] rounded px-3 py-2 text-sm">
      <p className="text-[#56D7FD] font-mono font-semibold">{label}</p>
      <p className="text-gray-300">Score d'impact : <span className="text-white font-semibold">{payload[0].value}/100</span></p>
    </div>
  );
}

// ── Graphique 1 : Variations prix semaine ─────────────────────────────────────

export function PriceVariationsChart({ yf_prices }: Pick<CommodityChartsProps, 'yf_prices'>) {
  const data = Object.values(yf_prices)
    .filter(d => d.variation_5j_pct !== undefined)
    .map(d => ({
      name: d.nom.length > 10 ? d.nom.slice(0, 10) + '…' : d.nom,
      variation: d.variation_5j_pct!,
      prix: d.prix_actuel,
      unite: d.unite,
    }))
    .sort((a, b) => b.variation - a.variation);

  if (!data.length) return null;

  return (
    <div className="bg-[#0a1417] border border-[#1a2a30] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4">
        Variations sur 5 jours (futures)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2a30" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#56D7FD10' }} />
          <ReferenceLine y={0} stroke="#1a2a30" />
          <Bar dataKey="variation" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.variation >= 0 ? '#3fe18b' : '#ff6b6b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Graphique 2 : Variations World Bank (mensuel) ─────────────────────────────

export function WorldBankChart({ wb_snapshot }: Pick<CommodityChartsProps, 'wb_snapshot'>) {
  const data = Object.values(wb_snapshot)
    .filter(d => d.variation_mensuelle_pct !== undefined)
    .map(d => ({
      name: d.nom.length > 12 ? d.nom.slice(0, 12) + '…' : d.nom,
      variation: d.variation_mensuelle_pct!,
    }))
    .sort((a, b) => b.variation - a.variation);

  if (!data.length) return null;

  return (
    <div className="bg-[#0a1417] border border-[#1a2a30] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4">
        Variation mensuelle – Banque Mondiale
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2a30" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#56D7FD10' }} />
          <ReferenceLine y={0} stroke="#1a2a30" />
          <Bar dataKey="variation" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.variation >= 0 ? '#56D7FD' : '#ff6b6b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Graphique 3 : Score exposition BRVM ──────────────────────────────────────

export function BrvmExposureChart({ brvm_scores }: Pick<CommodityChartsProps, 'brvm_scores'>) {
  const data = Object.entries(brvm_scores)
    .slice(0, 10)
    .map(([ticker, info]) => ({ ticker, score: info.score, comm: info.commodites[0] ?? '' }))
    .sort((a, b) => b.score - a.score);

  if (!data.length) return null;

  return (
    <div className="bg-[#0a1417] border border-[#1a2a30] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4">
        Exposition BRVM aux matières premières
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2a30" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
          <YAxis type="category" dataKey="ticker" tick={{ fill: '#56D7FD', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={<ScoreTooltip />} cursor={{ fill: '#56D7FD08' }} />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} fill="#56D7FD" opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">Score 0–100 basé sur l'exposition directe aux matières premières</p>
    </div>
  );
}

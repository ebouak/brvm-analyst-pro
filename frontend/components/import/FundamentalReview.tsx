'use client';

import { useState } from 'react';
import type { FundamentalExtraction } from '@/lib/import/validate';

interface Props {
  symbol: string;
  year: number;
  initial: FundamentalExtraction;
  suspects: string[];
  onSaved: () => void;
}

const FIELDS: Array<{ key: keyof FundamentalExtraction; label: string }> = [
  { key: 'revenue', label: "Chiffre d'affaires (M FCFA)" },
  { key: 'net_income', label: 'Résultat net (M FCFA)' },
  { key: 'equity', label: 'Capitaux propres (M FCFA)' },
  { key: 'debt_total', label: 'Dette (M FCFA)' },
  { key: 'cash', label: 'Trésorerie (M FCFA)' },
  { key: 'shares_outstanding', label: "Nombre d'actions" },
];

const M = 1_000_000;

export default function FundamentalReview({ symbol, year, initial, suspects, onSaved }: Props) {
  const [vals, setVals] = useState<FundamentalExtraction>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/fundamentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: symbol,
          year,
          revenue: vals.revenue != null ? Math.round(vals.revenue * M) : null,
          net_income: vals.net_income != null ? Math.round(vals.net_income * M) : null,
          equity: vals.equity != null ? Math.round(vals.equity * M) : null,
          debt: vals.debt_total != null ? Math.round(vals.debt_total * M) : null,
          shares: vals.shares_outstanding ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Échec');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-[10px] text-muted mb-0.5">
              {label}{suspects.includes(key) && <span className="text-warn ml-1">⚠️</span>}
            </label>
            <input
              type="number" step="any"
              value={vals[key] ?? ''}
              onChange={(e) => setVals({ ...vals, [key]: e.target.value === '' ? null : Number(e.target.value) })}
              className={`w-full bg-bg border rounded px-2 py-1 text-sm ${suspects.includes(key) ? 'border-warn' : 'border-border'}`}
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-down">{error}</p>}
      <button type="button" onClick={save} disabled={busy}
        className="text-xs bg-up/90 hover:bg-up text-black font-medium rounded px-3 py-1.5 disabled:opacity-50">
        {busy ? 'Enregistrement…' : 'Enregistrer en base'}
      </button>
    </div>
  );
}

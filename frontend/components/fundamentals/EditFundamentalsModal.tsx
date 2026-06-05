'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FundamentalInputs } from '@/lib/fundamentals';

interface Props {
  code: string;
  inputs: FundamentalInputs;
  year: number | null;
  onClose: () => void;
}

/** Correction manuelle des fondamentaux + nombre d'actions (POST /api/fundamentals). */
export default function EditFundamentalsModal({ code, inputs, year, onClose }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const numOrNull = (k: string) => { const v = fd.get(k); return v && String(v).trim() !== '' ? Number(v) : null; };
    const payload = {
      code,
      year: numOrNull('year'),
      revenue: numOrNull('revenue'),
      net_income: numOrNull('net_income'),
      equity: numOrNull('equity'),
      debt: numOrNull('debt'),
      shares: numOrNull('shares'),
    };
    try {
      const res = await fetch('/api/fundamentals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Échec');
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setBusy(false); }
  }

  const Field = ({ name, label, def }: { name: string; label: string; def: number | null }) => (
    <div>
      <label htmlFor={`ef-${name}`} className="block text-xs text-muted mb-1">{label}</label>
      <input id={`ef-${name}`} name={name} type="number" step="any" defaultValue={def ?? ''}
        className="w-full bg-bg border border-border rounded px-3 py-2 text-sm" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Corriger les fondamentaux — {code}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg text-lg" aria-label="Fermer">✕</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field name="year" label="Exercice" def={year} />
            <Field name="shares" label="Nombre d'actions" def={inputs.shares} />
            <Field name="revenue" label="Chiffre d'affaires" def={inputs.revenue} />
            <Field name="net_income" label="Résultat net" def={inputs.net_income} />
            <Field name="equity" label="Capitaux propres" def={inputs.equity} />
            <Field name="debt" label="Dette financière" def={inputs.debt} />
          </div>
          {error && <p className="text-xs text-down">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={busy} className="flex-1 px-4 py-2 rounded border border-border text-sm hover:bg-bg/40 transition">Annuler</button>
            <button type="submit" disabled={busy} className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

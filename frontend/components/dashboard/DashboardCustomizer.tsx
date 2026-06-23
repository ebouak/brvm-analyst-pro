'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WIDGETS, DEFAULT_ORDER, resolveLayout, type WidgetKey, type DashboardLayout } from '@/lib/dashboard/widgets';

const META = new Map(WIDGETS.map((w) => [w.key, w]));

export default function DashboardCustomizer({ initial }: { initial: DashboardLayout | null }) {
  // État de travail : ordre complet (visibles + masqués) + ensemble masqué.
  const initialVisible = resolveLayout(initial);
  const initialHidden = DEFAULT_ORDER.filter((k) => !initialVisible.includes(k));
  const [order, setOrder] = useState<WidgetKey[]>([...initialVisible, ...initialHidden]);
  const [hidden, setHidden] = useState<Set<WidgetKey>>(new Set(initialHidden));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((cur) => { const n = [...cur]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  };
  const toggle = (k: WidgetKey) => setHidden((cur) => { const n = new Set(cur); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function save() {
    setSaving(true); setMsg(null);
    const dashboard: DashboardLayout = { order, hidden: [...hidden] };
    const r = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { dashboard } }),
    });
    setSaving(false);
    setMsg(r.ok ? '✓ Disposition enregistrée' : 'Échec de l’enregistrement');
  }
  function reset() {
    setOrder([...DEFAULT_ORDER]); setHidden(new Set()); setMsg(null);
  }

  return (
    <div className="space-y-2">
      {order.map((k, i) => {
        const meta = META.get(k); if (!meta) return null;
        const on = !hidden.has(k);
        return (
          <div key={k} className={`flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 ${on ? '' : 'opacity-50'}`}>
            <div className="flex flex-col gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter" className="text-faint hover:text-accent disabled:opacity-30 text-[10px] leading-none">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Descendre" className="text-faint hover:text-accent disabled:opacity-30 text-[10px] leading-none">▼</button>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{meta.label}</div>
              <div className="text-[11px] text-faint">{meta.desc}</div>
            </div>
            <button
              type="button" role="switch" aria-checked={on} aria-label={`Afficher ${meta.label}`}
              onClick={() => toggle(k)}
              className={`relative h-[22px] w-[40px] rounded-full transition-colors ${on ? 'bg-accent' : 'bg-neutral-700'}`}>
              <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all ${on ? 'right-[2px] bg-bg' : 'left-[2px] bg-neutral-400'}`} />
            </button>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-3">
        <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer la disposition'}
        </button>
        <button type="button" onClick={reset} className="text-xs text-faint hover:text-muted">Réinitialiser</button>
        {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-up' : 'text-down'}`}>{msg}</span>}
      </div>
    </div>
  );
}

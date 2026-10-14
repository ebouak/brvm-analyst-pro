'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WIDGETS, MASQUES_PAR_DEFAUT, ordreParDefaut, resolveLayout, type WidgetKey, type DashboardLayout, type Profil } from '@/lib/dashboard/widgets';

const META = new Map(WIDGETS.map((w) => [w.key, w]));

export default function DashboardCustomizer({ initial, profil }: { initial: DashboardLayout | null; profil: Profil }) {
  // État de travail : ordre complet (visibles + masqués) + ensemble masqué.
  const initialVisible = resolveLayout(initial, profil);
  const initialHidden = ordreParDefaut(profil).filter((k) => !initialVisible.includes(k));
  const [order, setOrder] = useState<WidgetKey[]>([...initialVisible, ...initialHidden]);
  const [hidden, setHidden] = useState<Set<WidgetKey>>(new Set(initialHidden));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Une disposition enregistrée FIGE l'ordre : le profil ne s'applique plus tant
  // qu'elle existe. On le dit, et on offre un vrai retour à l'ordre automatique.
  const [personnalise, setPersonnalise] = useState(initial != null);
  const router = useRouter();

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
    if (r.ok) setPersonnalise(true);
    setMsg(r.ok ? '✓ Disposition enregistrée : elle remplace l’ordre automatique.' : 'Échec de l’enregistrement');
  }
  // Efface la disposition enregistrée : le tableau de bord suit de nouveau le profil.
  async function revenirAuto() {
    setSaving(true); setMsg(null);
    const r = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { dashboard: null } }),
    });
    setSaving(false);
    if (!r.ok) { setMsg('Échec : l’ordre automatique n’a pas pu être rétabli'); return; }
    setOrder([...ordreParDefaut(profil)]); setHidden(new Set(MASQUES_PAR_DEFAUT[profil]));
    setPersonnalise(false);
    setMsg('✓ Ordre automatique rétabli : il suit désormais votre profil.');
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className={`rounded-xl border px-4 py-3 text-sm ${personnalise ? 'border-warn/40 bg-warn/[0.06] text-warn' : 'border-accent/30 bg-accent/[0.05] text-ivory'}`} role="status">
        {personnalise
          ? 'Disposition personnalisée enregistrée : l’ordre ne suit plus votre profil.'
          : `Ordre automatique selon votre profil : ${profil === 'actif' ? 'investisseur actif, votre portefeuille, l’agenda et les publications de vos valeurs d’abord' : 'débutant, la séance et son explication d’abord'}.`}
      </div>
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
              className={`relative h-[22px] w-[40px] rounded-full transition-colors ${on ? 'bg-accent' : 'bg-border-strong'}`}>
              <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all ${on ? 'right-[2px] bg-bg' : 'left-[2px] bg-muted'}`} />
            </button>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-3">
        <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer la disposition'}
        </button>
        <button type="button" onClick={revenirAuto} disabled={saving || !personnalise} className="text-xs text-faint hover:text-muted disabled:opacity-40" title="Efface la disposition enregistrée : l’ordre suit de nouveau votre profil">Revenir à l’ordre automatique</button>
        {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-up' : 'text-down'}`}>{msg}</span>}
      </div>
    </div>
  );
}

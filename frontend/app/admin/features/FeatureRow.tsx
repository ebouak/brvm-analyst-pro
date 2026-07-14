'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateFlag } from './actions';

export interface FlagRow {
  code: string;
  label: string;
  acces: 'free' | 'premium' | 'pro' | 'disabled';
  quota_free: number | null;
  quota_premium: number | null;
  description: string | null;
  /** Nombre d'utilisations aujourd'hui (toutes personnes confondues). */
  usage_today: number;
}

const ACCES: { value: FlagRow['acces']; label: string; hint: string }[] = [
  { value: 'free', label: 'Gratuit', hint: 'Ouvert à tous les comptes' },
  { value: 'premium', label: 'Premium', hint: 'Abonnés Premium ET Platinium' },
  { value: 'pro', label: 'Pro', hint: 'Platinium uniquement' },
  { value: 'disabled', label: 'Désactivé', hint: 'Coupé pour TOUS, abonnés compris (kill switch)' },
];

const STYLE: Record<FlagRow['acces'], string> = {
  free: 'border-up/30 bg-up/10 text-up',
  premium: 'border-gold/30 bg-gold/10 text-gold',
  pro: 'border-accent/30 bg-accent/10 text-accent',
  disabled: 'border-down/30 bg-down/10 text-down',
};

/** `null` = illimité — un champ vide vaut « pas de plafond », pas « zéro ». */
const parseQuota = (v: string): number | null => {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

const fmtQuota = (q: number | null) => (q === null ? '' : String(q));

export function FeatureRow({ f }: { f: FlagRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [qFree, setQFree] = useState(fmtQuota(f.quota_free));
  const [qPrem, setQPrem] = useState(fmtQuota(f.quota_premium));

  function save(patch: Parameters<typeof updateFlag>[1]) {
    setMsg(null);
    startTransition(async () => {
      const r = await updateFlag(f.code, patch);
      setMsg(r.ok ? 'Enregistré.' : (r.error ?? 'Échec.'));
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ivory">{f.label}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STYLE[f.acces]}`}>
              {ACCES.find((a) => a.value === f.acces)?.label}
            </span>
          </div>
          {f.description && <p className="mt-0.5 text-xs text-muted">{f.description}</p>}
        </div>
        <span className="shrink-0 text-xs text-muted">
          <span className="tabular text-ivory">{f.usage_today}</span> usage(s) aujourd&apos;hui
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[11px] text-muted">Accès</span>
          <select
            value={f.acces}
            disabled={pending}
            onChange={(e) => save({ acces: e.target.value as FlagRow['acces'] })}
            className="mt-1 block rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-white"
          >
            {ACCES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] text-muted">Quota/jour — gratuit</span>
          <input
            value={qFree}
            disabled={pending}
            onChange={(e) => setQFree(e.target.value)}
            onBlur={() => save({ quota_free: parseQuota(qFree) })}
            placeholder="illimité"
            className="tabular mt-1 block w-24 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-white"
          />
        </label>

        <label className="block">
          <span className="text-[11px] text-muted">Quota/jour — premium</span>
          <input
            value={qPrem}
            disabled={pending}
            onChange={(e) => setQPrem(e.target.value)}
            onBlur={() => save({ quota_premium: parseQuota(qPrem) })}
            placeholder="illimité"
            className="tabular mt-1 block w-24 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-white"
          />
        </label>

        {msg && <span className="pb-2 text-xs text-muted">{msg}</span>}
      </div>

      <p className="text-[11px] text-faint">
        Champ vide = illimité · <strong>0</strong> = interdit pour ce type de compte ·
        « Désactivé » coupe la fonction pour tout le monde, immédiatement.
      </p>
    </div>
  );
}

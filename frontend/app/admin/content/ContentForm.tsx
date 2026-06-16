'use client';

import { useState, useTransition } from 'react';
import { upsertContent } from './actions';
import { CONTENT_KINDS, type ContentKind, type ContentRow } from '@/lib/admin/content';

export function ContentForm({ kind, row, onClose }: { kind: ContentKind; row?: ContentRow; onClose?: () => void }) {
  const cfg = CONTENT_KINDS[kind];
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(cfg.fields.map((f) => [f.key, row?.values[f.key] ?? ''])),
  );
  const [msg, setMsg] = useState<string | null>(null);

  function set(k: string, v: string) { setValues((s) => ({ ...s, [k]: v })); }

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const r = await upsertContent(kind, row?.id ?? null, values);
      if (r.ok) {
        setMsg(null);
        if (onClose) onClose();
      } else {
        setMsg(r.message ?? 'Erreur');
      }
    });
  }

  return (
    <div className="rounded-card border border-border bg-bg p-4 space-y-2">
      <p className="text-xs font-medium text-ivory">{row ? 'Éditer' : 'Créer'} — {cfg.label}</p>
      {msg && <div role="status" className="rounded border border-down/40 bg-down/5 p-2 text-xs text-down">{msg}</div>}
      {cfg.fields.map((f) => (
        <label key={f.key} className="block text-xs text-muted">
          {f.label}{f.required ? ' *' : ''}
          {f.type === 'textarea' ? (
            <textarea
              value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ivory"
            />
          ) : (
            <input
              type={f.type === 'date' ? 'date' : 'text'} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ivory"
            />
          )}
        </label>
      ))}
      <div className="flex gap-2 pt-1">
        <button type="button" disabled={pending} onClick={submit}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-obsidian transition active:scale-95 disabled:opacity-50">
          {pending ? '…' : (row ? 'Enregistrer' : 'Créer')}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted">Annuler</button>
        )}
      </div>
    </div>
  );
}

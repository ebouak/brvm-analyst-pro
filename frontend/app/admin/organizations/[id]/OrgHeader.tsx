'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { renameOrganization, deleteOrganization } from '../actions';

export function OrgHeader({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-lg font-display text-ivory"
        />
        <button
          type="button"
          disabled={pending || !value.trim() || value === name}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await renameOrganization(id, value);
              if (!r.ok) setMsg(r.message ?? 'Échec.');
            });
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:text-ivory active:scale-95 disabled:opacity-40"
        >
          Renommer
        </button>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Supprimer définitivement l'organisation « ${name} » ? Les membres seront détachés.`)) return;
          startTransition(async () => {
            const r = await deleteOrganization(id);
            if (r.ok) router.push('/admin/organizations');
            else setMsg(r.message ?? 'Échec.');
          });
        }}
        className="rounded-lg border border-down/40 px-3 py-2 text-sm font-medium text-down transition active:scale-95 disabled:opacity-50"
      >
        Supprimer
      </button>
      {msg && <p className="w-full text-xs text-down">{msg}</p>}
    </div>
  );
}

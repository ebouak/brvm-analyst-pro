'use client';

import { useState, useTransition } from 'react';
import { createOrganization } from './actions';

export function CreateOrgForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-obsidian transition active:scale-95"
      >
        Créer une organisation
      </button>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'organisation"
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
        />
        <input
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="Email du propriétaire (optionnel)"
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
        />
      </div>
      {msg && <p className="text-xs text-down">{msg}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await createOrganization({ name, ownerEmail: ownerEmail || undefined });
              if (r.ok) {
                setName('');
                setOwnerEmail('');
                setOpen(false);
              } else setMsg(r.message ?? 'Échec.');
            });
          }}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
        >
          {pending ? '…' : 'Créer'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setMsg(null); }}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ivory"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

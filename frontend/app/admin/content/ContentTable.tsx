'use client';

import { useState, useTransition } from 'react';
import { setHidden, deleteContent } from './actions';
import type { ContentKind, ContentRow } from '@/lib/admin/content';
import { ContentForm } from './ContentForm';

const DASH = '—';
function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ContentTable({ kind, rows }: { kind: ContentKind; rows: ContentRow[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="rounded-panel border border-border bg-surface p-6 text-center text-sm text-muted">Aucune entrée.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-panel border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
            <th className="px-4 py-3 font-medium">Titre</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">État</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 align-top last:border-0">
              <td className="px-4 py-2.5 text-ivory">
                {r.title}
                {editing === r.id && (
                  <div className="mt-2 max-w-xl"><ContentForm kind={kind} row={r} onClose={() => setEditing(null)} /></div>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted tabular">{fmtDate(r.date)}</td>
              <td className="px-4 py-2.5">
                {r.hidden ? <span className="text-down">Masqué</span> : <span className="text-up">Public</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap gap-2">
                  <button type="button" disabled={pending}
                    onClick={() => startTransition(async () => { await setHidden(kind, r.id, !r.hidden); })}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted transition active:scale-95 disabled:opacity-50">
                    {r.hidden ? 'Afficher' : 'Masquer'}
                  </button>
                  <button type="button" onClick={() => setEditing(editing === r.id ? null : r.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted">Éditer</button>
                  <button type="button" disabled={pending}
                    onClick={() => { if (confirm('Supprimer cette entrée ?')) startTransition(async () => { await deleteContent(kind, r.id); }); }}
                    className="rounded-md border border-down/40 px-2 py-1 text-xs text-down transition active:scale-95 disabled:opacity-50">
                    Supprimer
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreateToggle({ kind }: { kind: ContentKind }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition active:scale-95">
        {open ? 'Fermer' : '+ Créer'}
      </button>
      {open && <div className="mt-3 max-w-xl"><ContentForm kind={kind} onClose={() => setOpen(false)} /></div>}
    </div>
  );
}

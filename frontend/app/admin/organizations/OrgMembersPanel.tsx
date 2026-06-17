'use client';

import { useState, useTransition } from 'react';
import { addMember, removeMember, setMemberRole } from './actions';
import type { OrgMember } from '@/lib/admin/organizations';

const ROLES = ['owner', 'admin', 'member'];

export function OrgMembersPanel({ orgId, members }: { orgId: string; members: OrgMember[] }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.message ?? 'Échec.');
    });
  }

  return (
    <div className="space-y-4">
      {members.length === 0 ? (
        <p className="text-sm text-muted">Aucun membre.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Membre</th>
                <th className="px-3 py-2 font-medium">Rôle</th>
                <th className="px-3 py-2 font-medium">Premium</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 text-ivory">{m.email ?? m.user_id}</td>
                  <td className="px-3 py-2">
                    <select
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => run(() => setMemberRole(orgId, m.user_id, e.target.value))}
                      className="rounded border border-border bg-bg px-2 py-1 text-xs text-ivory"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${m.is_premium ? 'text-gold' : 'text-faint'}`}>
                      {m.is_premium ? 'Premium' : 'Gratuit'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Retirer ${m.email ?? 'ce membre'} de l'organisation ?`)) run(() => removeMember(orgId, m.user_id));
                      }}
                      className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-border/40 pt-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email du membre"
          className="flex-1 min-w-[180px] rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ivory"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !email.trim()}
          onClick={() => run(async () => {
            const r = await addMember(orgId, email, role);
            if (r.ok) setEmail('');
            return r;
          })}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      {msg && <p className="text-xs text-down">{msg}</p>}
    </div>
  );
}

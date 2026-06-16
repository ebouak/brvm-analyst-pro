'use client';

import { useState, useTransition, useRef } from 'react';
import { assignRole, revokeRole, setPremium, sendUserEmail } from './actions';
import type { RoleDef } from '@/lib/admin/roles';

export function RightsPanel({
  userId, isPremium, roleCodes, allRoles, canManageRoles,
}: {
  userId: string; isPremium: boolean; roleCodes: string[]; allRoles: RoleDef[]; canManageRoles: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const attachRef = useRef<HTMLInputElement>(null);

  function run(p: Promise<{ ok: boolean; message?: string }>, okMsg: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await p;
      setMsg(r.ok ? okMsg : (r.message ?? 'Erreur'));
    });
  }

  return (
    <div className="space-y-6">
      {msg && <div role="status" className="rounded-card border border-border bg-surface p-3 text-sm text-ivory">{msg}</div>}

      <section className="rounded-panel border border-border bg-surface p-5">
        <h3 className="font-display text-base text-ivory">Statut Premium</h3>
        <button
          type="button" disabled={pending}
          onClick={() => run(setPremium(userId, !isPremium), 'Statut premium mis à jour.')}
          className="mt-3 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold transition active:scale-95 disabled:opacity-50"
        >
          {isPremium ? 'Retirer Premium' : 'Activer Premium'}
        </button>
      </section>

      {canManageRoles && (
        <section className="rounded-panel border border-border bg-surface p-5">
          <h3 className="font-display text-base text-ivory">Rôles administratifs</h3>
          <div className="mt-3 space-y-2">
            {allRoles.map((role) => {
              const has = roleCodes.includes(role.code);
              return (
                <div key={role.code} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{role.label} <span className="text-faint">({role.code})</span></span>
                  <button
                    type="button" disabled={pending}
                    onClick={() => run(has ? revokeRole(userId, role.code) : assignRole(userId, role.code), 'Rôles mis à jour.')}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition active:scale-95 disabled:opacity-50 ${has ? 'border-down/40 text-down' : 'border-up/40 text-up'}`}
                  >
                    {has ? 'Révoquer' : 'Attribuer'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-panel border border-border bg-surface p-5">
        <h3 className="font-display text-base text-ivory">Envoyer un email</h3>
        <input
          value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet"
          className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…" rows={5}
          className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
        />
        <label className="mt-2 block text-xs text-muted">
          Pièces jointes (PDF, images)
          <input ref={attachRef} type="file" multiple accept="application/pdf,image/png,image/jpeg"
            className="mt-1 block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-border file:px-2 file:py-1 file:text-ivory" />
        </label>
        <button
          type="button" disabled={pending || !subject.trim() || !body.trim()}
          onClick={() => {
            const fd = new FormData();
            fd.set('userId', userId);
            fd.set('subject', subject);
            fd.set('body', body);
            for (const f of Array.from(attachRef.current?.files ?? [])) fd.append('attachments', f);
            run(sendUserEmail(fd), 'Email envoyé.');
          }}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
        >
          Envoyer
        </button>
      </section>
    </div>
  );
}

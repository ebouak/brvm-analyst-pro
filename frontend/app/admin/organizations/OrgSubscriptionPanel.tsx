'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { linkSubscription, unlinkSubscription } from './actions';
import type { OrgDetail } from '@/lib/admin/organizations';

export function OrgSubscriptionPanel({
  orgId,
  subscription,
  linkableSubs,
}: {
  orgId: string;
  subscription: OrgDetail['subscription'];
  linkableSubs: OrgDetail['linkableSubs'];
}) {
  const [selected, setSelected] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.message ?? 'Échec.');
    });
  }

  if (subscription) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="text-ivory">{subscription.plan ?? 'Plan inconnu'}</span>
            <span className="ml-2 text-xs text-muted">({subscription.status})</span>
            {subscription.user_email && <span className="ml-2 text-xs text-faint">{subscription.user_email}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/subscriptions" className="text-xs text-sapphire hover:underline">
              Voir abonnements
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm('Détacher cet abonnement de l’organisation ?')) run(() => unlinkSubscription(orgId, subscription.id));
              }}
              className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
            >
              Détacher
            </button>
          </div>
        </div>
        {msg && <p className="text-xs text-down">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {linkableSubs.length === 0 ? (
        <p className="text-sm text-muted">Aucun abonnement actif libre à rattacher.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
          >
            <option value="">Sélectionner un abonnement actif…</option>
            {linkableSubs.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.user_email ?? 'inconnu')} — {s.plan ?? 'plan'} ({s.status})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !selected}
            onClick={() => run(() => linkSubscription(orgId, selected))}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
          >
            Rattacher
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-down">{msg}</p>}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import type { ApiClientRow } from '@/lib/admin/apiClients';
import { maskKey } from '@/lib/api/mask';
import { approveClient, rejectClient, revokeClient, setQuota } from './actions';

const STATUT_STYLE: Record<ApiClientRow['statut'], string> = {
  pending: 'border-warn/30 bg-warn/10 text-warn',
  active: 'border-up/30 bg-up/10 text-up',
  rejected: 'border-border bg-surface text-muted',
  revoked: 'border-down/30 bg-down/10 text-down',
};

const STATUT_LABEL: Record<ApiClientRow['statut'], string> = {
  pending: 'En attente',
  active: 'Actif',
  rejected: 'Refusé',
  revoked: 'Révoqué',
};

export function ClientRow({ c }: { c: ApiClientRow }) {
  const [pending, startTransition] = useTransition();
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const quotaPct = c.quota_daily > 0 ? Math.min(100, (c.usage_today / c.quota_daily) * 100) : 0;

  function run(fn: () => Promise<{ ok: true; key?: string } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else if (r.key) setIssuedKey(r.key);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ivory">{c.nom}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUT_STYLE[c.statut]}`}>
              {STATUT_LABEL[c.statut]}
            </span>
          </div>
          <p className="text-xs text-muted">
            {c.email}
            {c.organisation ? ` · ${c.organisation}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-muted hover:text-ivory"
        >
          {open ? 'Masquer' : 'Détails'}
        </button>
      </div>

      {c.statut === 'active' && (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="tabular text-faint">{maskKey(c.key_prefix)}</span>
          <span className="text-muted">
            <span className="tabular text-ivory">{c.usage_today}</span> / {c.quota_daily} requêtes aujourd&apos;hui
          </span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
            <span
              className={`block h-full ${quotaPct > 90 ? 'bg-down' : 'bg-up'}`}
              style={{ width: `${quotaPct}%` }}
            />
          </span>
        </div>
      )}

      {open && (
        <div className="space-y-1 rounded-lg border border-border/60 bg-bg p-3 text-xs text-muted">
          <p><strong className="text-ivory">Usage déclaré :</strong> {c.motif}</p>
          {c.site_url && <p><strong className="text-ivory">Site :</strong> {c.site_url}</p>}
          {c.motif_refus && <p className="text-down"><strong>Motif :</strong> {c.motif_refus}</p>}
          <p className="text-faint">
            Demande du {new Date(c.created_at).toLocaleDateString('fr-FR')}
            {c.last_used_at ? ` · dernier appel le ${new Date(c.last_used_at).toLocaleDateString('fr-FR')}` : ''}
          </p>
        </div>
      )}

      {/* La clé n'est montrée QU'UNE FOIS : seul son hash est stocké. */}
      {issuedKey && (
        <div className="rounded-lg border border-up/40 bg-up/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-up">
            Clé générée — copiez-la maintenant, elle ne sera plus jamais affichée.
          </p>
          <code className="block break-all rounded bg-bg p-2 text-[11px] text-ivory">{issuedKey}</code>
          <p className="text-[10px] text-faint">
            Seul son empreinte (sha256) est conservée. En cas de perte : révoquer puis réémettre.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {c.statut === 'pending' && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveClient(c.id))}
              className="rounded-lg bg-up px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-40"
            >
              Approuver &amp; générer la clé
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const m = prompt('Motif du refus (communiqué au demandeur) :');
                if (m) run(() => rejectClient(c.id, m));
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ivory disabled:opacity-40"
            >
              Refuser
            </button>
          </>
        )}

        {c.statut === 'active' && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const q = prompt('Nouveau quota journalier :', String(c.quota_daily));
                if (q) run(() => setQuota(c.id, Number(q)));
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ivory disabled:opacity-40"
            >
              Modifier le quota
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const m = prompt('Motif de la révocation (coupe l’accès immédiatement) :');
                if (m !== null) run(() => revokeClient(c.id, m));
              }}
              className="rounded-lg border border-down/40 px-3 py-1.5 text-xs text-down hover:bg-down/10 disabled:opacity-40"
            >
              Révoquer
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-down">{error}</p>}
    </div>
  );
}

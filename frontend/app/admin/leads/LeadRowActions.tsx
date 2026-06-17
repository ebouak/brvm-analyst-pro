'use client';

import { useTransition } from 'react';
import { LEAD_STATUTS, STATUT_LABEL, whatsappLink, type LeadStatut } from '@/lib/leads';
import { setLeadStatus } from './actions';

/**
 * Actions par ligne dans l'inbox admin : sélecteur de statut (server action
 * gated `leads.write`) + lien WhatsApp pré-rempli vers le lead. Le `select` est
 * masqué/désactivé si l'admin n'a pas le droit d'écriture.
 */
export default function LeadRowActions({
  id,
  statut,
  nom,
  telephone,
  canWrite,
}: {
  id: string;
  statut: LeadStatut;
  nom: string;
  telephone: string | null;
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  const wa = whatsappLink(telephone, nom);

  return (
    <div className="flex items-center gap-2">
      {canWrite ? (
        <select
          aria-label={`Statut de ${nom}`}
          defaultValue={statut}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            start(() => {
              void setLeadStatus(id, next);
            });
          }}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ivory disabled:opacity-60"
        >
          {LEAD_STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_LABEL[s]}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-muted">{STATUT_LABEL[statut]}</span>
      )}

      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-up/40 px-2.5 py-1.5 text-xs text-up transition hover:bg-up/10"
        >
          WhatsApp
        </a>
      ) : (
        <span className="text-faint">—</span>
      )}
    </div>
  );
}

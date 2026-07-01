'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import NewAlertModal from '@/components/NewAlertModal';
import { toggleAlert, removeAlert } from './actions';

export interface UserAlert {
  id: string;
  code: string;
  type: string;
  seuil: number | null;
  actif: boolean;
  declenchee_le: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  prix_au_dessus: 'Prix ≥ seuil',
  prix_en_dessous: 'Prix ≤ seuil',
  variation: 'Variation ≥ seuil',
  signal_achat: 'Signal d’achat',
  signal_vente: 'Signal de vente',
  rsi_survente: 'RSI survente',
  rsi_surachat: 'RSI surachat',
  dividende_proche: 'Dividende proche',
};

const PRICE_TYPES = new Set(['prix_au_dessus', 'prix_en_dessous', 'variation']);

function fmtSeuil(a: UserAlert): string {
  if (a.seuil == null) return '—';
  if (a.type === 'variation') return `${a.seuil} %`;
  if (PRICE_TYPES.has(a.type)) return `${a.seuil.toLocaleString('fr-FR')} FCFA`;
  return String(a.seuil);
}

export function AlertsManager({
  alerts,
  instruments,
}: {
  alerts: UserAlert[];
  instruments: { code: string; designation: string | null }[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, start] = useTransition();

  function onToggle(a: UserAlert) {
    start(async () => { await toggleAlert(a.id, !a.actif); router.refresh(); });
  }
  function onRemove(a: UserAlert) {
    if (!confirm(`Supprimer l'alerte ${a.code} (${TYPE_LABEL[a.type] ?? a.type}) ?`)) return;
    start(async () => { await removeAlert(a.id); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {alerts.length} alerte{alerts.length !== 1 ? 's' : ''} · notifications par email (et Telegram si configuré)
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg"
        >
          🔔 + Créer une alerte
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">Vous n&apos;avez aucune alerte.</p>
          <p className="mt-1 text-xs text-faint">
            Créez-en une pour être prévenu dès qu&apos;un titre franchit un seuil ou change de signal.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Titre</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Seuil</th>
                <th className="px-3 py-2 text-center">Statut</th>
                <th className="px-3 py-2 text-center">Actif</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t border-border/50">
                  <td className="px-3 py-2 font-mono text-white">{a.code}</td>
                  <td className="px-3 py-2 text-muted">{TYPE_LABEL[a.type] ?? a.type}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtSeuil(a)}</td>
                  <td className="px-3 py-2 text-center">
                    {a.declenchee_le ? (
                      <span className="text-[11px] text-warn" title={a.declenchee_le}>
                        Déclenchée
                      </span>
                    ) : (
                      <span className="text-[11px] text-faint">En veille</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onToggle(a)}
                      disabled={pending}
                      aria-pressed={a.actif}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        a.actif ? 'bg-up/15 text-up' : 'bg-border text-faint'
                      }`}
                    >
                      {a.actif ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(a)}
                      disabled={pending}
                      className="text-xs text-down hover:underline"
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewAlertModal isOpen={modalOpen} onClose={() => { setModalOpen(false); router.refresh(); }} instruments={instruments} />
    </div>
  );
}

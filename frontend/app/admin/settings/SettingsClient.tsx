'use client';

import { useState, useTransition } from 'react';
import { PremiumPanel, StatPill } from '@/components/ui/premium';
import type { OpsSettings } from '@/lib/admin/opsSettings';
import { saveAdminSettingsAction } from './actions';

export interface IntegrationStatus {
  cle: string;
  libelle: string;
  configure: boolean;
  detail: string;
}

export default function SettingsClient({
  initial,
  canEdit,
  integrations,
}: {
  initial: OpsSettings;
  canEdit: boolean;
  integrations: IntegrationStatus[];
}) {
  const [delai, setDelai] = useState(String(initial.escaladeVocaleDelaiMin));
  const [heure, setHeure] = useState(initial.briefMatinHeureUtc);
  const [note, setNote] = useState(initial.modeMaintenanceNote);
  const [chatIds, setChatIds] = useState(initial.adminTelegramChatIds.join(', '));
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    startTransition(async () => {
      const r = await saveAdminSettingsAction({
        escaladeVocaleDelaiMin: Number(delai),
        briefMatinHeureUtc: heure,
        modeMaintenanceNote: note,
        adminTelegramChatIdsRaw: chatIds,
      });
      setStatus(
        r.ok
          ? { ok: true, msg: 'Paramètres enregistrés.' }
          : { ok: false, msg: r.error ?? 'Échec de sauvegarde.' },
      );
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="overline text-faint">Orchestration Ops & Alerting</p>
        <PremiumPanel className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted">
                  Délai avant escalade vocale (minutes, 0 = immédiat)
                </span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  disabled={!canEdit}
                  value={delai}
                  onChange={(e) => setDelai(e.target.value)}
                  className="tabular w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory disabled:opacity-60"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted">
                  Heure cible du briefing matinal Telegram (UTC)
                </span>
                <input
                  type="text"
                  pattern="\d{2}:\d{2}"
                  placeholder="07:30"
                  disabled={!canEdit}
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  className="tabular w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory disabled:opacity-60"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">
                Chat IDs Telegram Ops autorisés (complémentaire à TELEGRAM_OPS_ADMIN_CHAT_IDS)
              </span>
              <input
                type="text"
                placeholder="ex. 123456789, 987654321"
                disabled={!canEdit}
                value={chatIds}
                onChange={(e) => setChatIds(e.target.value)}
                className="tabular w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory disabled:opacity-60"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Note interne d’exploitation / maintenance</span>
              <textarea
                rows={2}
                disabled={!canEdit}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. Reprise des états financiers 2025 en cours…"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory disabled:opacity-60"
              />
            </label>

            {status && (
              <p className={`text-xs ${status.ok ? 'text-up' : 'text-down'}`}>{status.msg}</p>
            )}

            {canEdit && (
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Enregistrement…' : 'Enregistrer les paramètres'}
              </button>
            )}
          </form>
        </PremiumPanel>
      </section>

      <section className="space-y-2">
        <p className="overline text-faint">Matrice des intégrations & sécurité (lecture seule)</p>
        <PremiumPanel className="divide-y divide-border/50 p-0">
          {integrations.map((it) => (
            <div key={it.cle} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ivory">{it.libelle}</p>
                <p className="text-xs text-muted">{it.detail}</p>
              </div>
              <StatPill tone={it.configure ? 'emerald' : 'gold'}>
                {it.configure ? 'Configuré' : 'À configurer'}
              </StatPill>
            </div>
          ))}
        </PremiumPanel>
      </section>
    </div>
  );
}

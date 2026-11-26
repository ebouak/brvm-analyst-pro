'use client';

import { useState } from 'react';
import { PremiumPanel, StatPill } from '@/components/ui/premium';
import type { WorkflowAutorise } from '@/lib/opsAgent/githubDispatch';
import type { SondeCanal } from '@/lib/opsAgent/controles';

export interface IncidentRow {
  id: string;
  type_alerte: string;
  gravite: string;
  titre: string;
  detail: string | null;
  statut: string;
  escalade_vocale_at: string | null;
  cree_le: string;
}

export interface CommandRunRow {
  id: string;
  source: string;
  commande: string;
  statut: string;
  workflow_fichier: string | null;
  erreur: string | null;
  cree_le: string;
}

export default function OpsConsoleClient({
  workflows,
  incidentsInit,
  runs,
  canDispatch,
}: {
  workflows: readonly WorkflowAutorise[];
  incidentsInit: IncidentRow[];
  runs: CommandRunRow[];
  canDispatch: boolean;
}) {
  const [sondes, setSondes] = useState<SondeCanal[] | null>(null);
  const [probing, setProbing] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dispatchBusy, setDispatchBusy] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentRow[]>(incidentsInit);

  async function sonder() {
    setProbing(true);
    try {
      const r = await fetch('/api/admin/ops/health');
      const j = await r.json();
      if (r.ok && Array.isArray(j.sondes)) {
        setSondes(j.sondes);
      }
    } finally {
      setProbing(false);
    }
  }

  async function lancerWorkflow(alias: string) {
    setDispatchMsg(null);
    setDispatchBusy(alias);
    try {
      const r = await fetch('/api/admin/ops/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: alias }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setDispatchMsg({ ok: true, text: `Workflow ${j.workflow ?? alias} déclenché.` });
      } else {
        setDispatchMsg({ ok: false, text: j.error ?? 'Échec du déclenchement.' });
      }
    } finally {
      setDispatchBusy(null);
    }
  }

  async function traiterIncident(id: string, action: 'ack' | 'silence' | 'resolve') {
    const r = await fetch(`/api/admin/ops/incidents/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (r.ok) {
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === id
            ? {
                ...inc,
                statut:
                  action === 'ack'
                    ? 'pris_en_charge'
                    : action === 'silence'
                      ? 'silencie'
                      : 'resolu',
              }
            : inc,
        ),
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Santé en direct des canaux & LLM */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="overline text-faint">Sonde temps réel · Canaux &amp; LLM</p>
          <button
            type="button"
            disabled={probing}
            onClick={() => void sonder()}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
          >
            {probing ? 'Sondage en cours…' : 'Lancer la sonde live'}
          </button>
        </div>
        <PremiumPanel className="p-4">
          {!sondes ? (
            <p className="text-xs text-muted">
              Cliquez sur « Lancer la sonde live » pour mesurer la latence de DeepSeek, Gemini, Grok, WhatsApp WAHA, Telegram Ops, Resend et Bland.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sondes.map((s) => (
                <div
                  key={s.nom}
                  className="rounded-lg border border-border/70 bg-bg/60 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ivory">{s.nom}</span>
                    <StatPill tone={s.ok ? 'emerald' : 'gold'}>{s.statut}</StatPill>
                  </div>
                  <p className="tabular text-[11px] text-muted">{s.detail}</p>
                </div>
              ))}
            </div>
          )}
        </PremiumPanel>
      </section>

      {/* Incidents critiques */}
      <section className="space-y-2">
        <p className="overline text-faint">Incidents critiques &amp; escalade vocale</p>
        <PremiumPanel className="divide-y divide-border/50 p-0">
          {incidents.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Aucun incident récent enregistré.</p>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatPill tone={inc.statut === 'ouvert' ? 'gold' : 'neutral'}>{inc.statut}</StatPill>
                    <span className="text-sm font-medium text-ivory">{inc.titre}</span>
                    <span className="tabular text-xs text-faint">
                      {inc.cree_le.slice(0, 16).replace('T', ' ')} UTC
                    </span>
                  </div>
                  {inc.detail && <p className="text-xs text-muted">{inc.detail}</p>}
                </div>
                {canDispatch && inc.statut === 'ouvert' && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void traiterIncident(inc.id, 'ack')}
                      className="rounded border border-accent/40 px-2.5 py-1 text-xs text-accent hover:bg-accent/10"
                    >
                      Prendre en charge
                    </button>
                    <button
                      type="button"
                      onClick={() => void traiterIncident(inc.id, 'silence')}
                      className="rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-ivory"
                    >
                      Silencier 6h
                    </button>
                    <button
                      type="button"
                      onClick={() => void traiterIncident(inc.id, 'resolve')}
                      className="rounded border border-up/40 px-2.5 py-1 text-xs text-up hover:bg-up/10"
                    >
                      Résoudre
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </PremiumPanel>
      </section>

      {/* Lanceur GitHub Actions */}
      <section className="space-y-2">
        <p className="overline text-faint">Déclenchement contrôlé (liste blanche GitHub Actions)</p>
        {dispatchMsg && (
          <p className={`text-xs ${dispatchMsg.ok ? 'text-up' : 'text-down'}`}>{dispatchMsg.text}</p>
        )}
        <PremiumPanel className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <div
              key={wf.alias}
              className="flex flex-col justify-between gap-2 rounded-lg border border-border/60 bg-bg/50 p-3"
            >
              <div>
                <p className="text-sm font-medium text-ivory">{wf.libelle}</p>
                <p className="text-[11px] text-faint">{wf.fichier}</p>
                <p className="mt-1 text-xs text-muted">{wf.description}</p>
              </div>
              {canDispatch && (
                <button
                  type="button"
                  disabled={dispatchBusy === wf.alias}
                  onClick={() => void lancerWorkflow(wf.alias)}
                  className="self-start rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ivory transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-40"
                >
                  {dispatchBusy === wf.alias ? 'Lancement…' : `Relancer ${wf.alias}`}
                </button>
              )}
            </div>
          ))}
        </PremiumPanel>
      </section>

      {/* Configuration Bot Telegram Ops + Historique */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <p className="overline text-faint">Webhook &amp; commandes Telegram Ops</p>
          <PremiumPanel className="space-y-3 p-4 text-xs text-muted">
            <p>
              URL du webhook dédié :{' '}
              <code className="rounded bg-bg px-1.5 py-0.5 text-ivory">
                https://www.westbourse.com/api/telegram/ops/webhook
              </code>
            </p>
            <p>
              En-tête requis lors du <code className="text-ivory">setWebhook</code> :{' '}
              <code className="text-ivory">secret_token = TELEGRAM_OPS_WEBHOOK_SECRET</code>.
            </p>
            <p className="text-ivory font-medium">Commandes disponibles :</p>
            <p className="leading-relaxed">
              <code>/tour</code>, <code>/cloture</code>, <code>/matin</code>, <code>/boc</code>,{' '}
              <code>/coherence</code>, <code>/pulse</code>, <code>/audit SNTS</code>,{' '}
              <code>/relancer daily-brvm</code>, <code>/paiements</code>, <code>/agregats</code>,{' '}
              <code>/contact</code>, <code>/crm</code>, <code>/posts</code>, <code>/llm</code>,{' '}
              <code>/incidents</code>, <code>/ferie AAAA-MM-JJ Motif</code>,{' '}
              <code>/kill flag</code>, ou message libre / note vocale.
            </p>
          </PremiumPanel>
        </section>

        <section className="space-y-2">
          <p className="overline text-faint">Dernières commandes &amp; exécutions Ops</p>
          <PremiumPanel className="max-h-72 overflow-y-auto divide-y divide-border/40 p-0">
            {runs.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted">Aucune commande journalisée.</p>
            ) : (
              runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-ivory">{r.commande}</span>
                    {r.workflow_fichier && (
                      <span className="ml-1.5 text-faint">({r.workflow_fichier})</span>
                    )}
                    <span className="block truncate text-[11px] text-muted">
                      {r.source} · {r.cree_le.slice(0, 16).replace('T', ' ')}
                      {r.erreur ? ` · ${r.erreur}` : ''}
                    </span>
                  </div>
                  <StatPill
                    tone={
                      r.statut === 'succes' ? 'emerald' : r.statut === 'echec' ? 'gold' : 'neutral'
                    }
                  >
                    {r.statut}
                  </StatPill>
                </div>
              ))
            )}
          </PremiumPanel>
        </section>
      </div>
    </div>
  );
}

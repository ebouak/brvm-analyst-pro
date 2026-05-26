'use client';

import { useState } from 'react';

export default function ComptePage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleExport() {
    setBusy('export');
    setMsg(null);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Échec export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brvm-analyst-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Export téléchargé.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!confirm('Confirmer la suppression de toutes vos données applicatives ? (irréversible)')) return;
    setBusy('delete');
    setMsg(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Échec suppression');
      setMsg(json.message ?? 'Données supprimées.');
      setTimeout(() => (window.location.href = '/'), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Compte</h1>

      <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-medium">Exporter mes données</h2>
        <p className="text-sm text-muted">
          Téléchargez un fichier JSON contenant toutes vos données personnelles
          (watchlists, portefeuille, alertes, notifications, rapports, backtests).
        </p>
        <button
          onClick={handleExport}
          disabled={busy != null}
          className="px-4 py-2 rounded-lg bg-up/20 text-up border border-up/40 hover:bg-up/30 disabled:opacity-50"
        >
          {busy === 'export' ? 'Préparation…' : 'Exporter (JSON)'}
        </button>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-medium text-down">Supprimer mes données</h2>
        <p className="text-sm text-muted">
          Suppression de toutes vos watchlists, positions de portefeuille,
          alertes, notifications, rapports et backtests. Action irréversible.
          La suppression définitive du compte d'authentification nécessite une
          intervention du support.
        </p>
        <button
          onClick={handleDelete}
          disabled={busy != null}
          className="px-4 py-2 rounded-lg bg-down/20 text-down border border-down/40 hover:bg-down/30 disabled:opacity-50"
        >
          {busy === 'delete' ? 'Suppression…' : 'Supprimer mes données'}
        </button>
      </section>

      {msg && (
        <div className="text-sm text-muted border border-border rounded-lg p-3">
          {msg}
        </div>
      )}
    </div>
  );
}

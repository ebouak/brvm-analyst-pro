'use client';

import { useState } from 'react';
import NotificationButton from '@/components/NotificationButton';
import { SectionHeader } from '@/components/ui/premium';
import { saveDisplayName } from './displayNameAction';

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
      setMsg('Export téléchargé avec succès.');
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
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <SectionHeader
        kicker="Paramètres"
        title="Mon compte"
        subtitle="Gérez vos données personnelles, notifications et préférences de compte."
      />

      {/* Séparateur or */}
      <div className="gold-rule" />

      {/* Section export */}
      <section className="bg-surface border border-border rounded-card shadow-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/20 bg-gold/[0.06] text-gold/80 text-base">
            ↓
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base font-semibold text-ivory tracking-tight">
              Exporter mes données
            </h2>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Téléchargez un fichier JSON contenant toutes vos données personnelles
              (watchlists, portefeuille, alertes, notifications, rapports, backtests).
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={busy != null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gold/30 bg-gold/10 text-gold text-sm font-medium transition-all duration-200 hover:bg-gold/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        >
          {busy === 'export' ? (
            <>
              <span className="animate-spin inline-block h-3.5 w-3.5 border border-current border-t-transparent rounded-full" />
              Préparation…
            </>
          ) : (
            'Exporter (JSON)'
          )}
        </button>
      </section>

      {/* Section pseudonyme forum */}
      <section className="bg-surface border border-border rounded-card shadow-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sapphire/20 bg-sapphire/[0.06] text-sapphire/80 text-base">
            ✎
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base font-semibold text-ivory tracking-tight">
              Pseudonyme du forum
            </h2>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Choisissez le nom affiché sur vos discussions (40 caractères max).
              Laissez vide pour apparaître comme « Anonyme ».
            </p>
          </div>
        </div>
        <form action={saveDisplayName} className="flex items-center gap-3">
          <input
            type="text"
            name="display_name"
            maxLength={40}
            placeholder="Votre pseudonyme…"
            className="flex-1 rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-sapphire/50 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-sapphire/30 bg-sapphire/10 text-sapphire text-sm font-medium transition-all duration-200 hover:bg-sapphire/20 active:scale-95"
          >
            Enregistrer
          </button>
        </form>
      </section>

      {/* Section notifications */}
      <section className="bg-surface border border-border rounded-card shadow-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sapphire/20 bg-sapphire/[0.06] text-sapphire/80 text-base">
            ◎
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base font-semibold text-ivory tracking-tight">
              Notifications push
            </h2>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Recevez des alertes BRVM directement dans votre navigateur (signaux,
              alertes de cours, événements). Fonctionne même quand l&apos;application
              n&apos;est pas ouverte.
            </p>
          </div>
        </div>
        <NotificationButton />
      </section>

      {/* Section suppression */}
      <section className="bg-surface border border-down/20 rounded-card shadow-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-down/20 bg-down/[0.06] text-down/80 text-base">
            ✕
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base font-semibold text-down tracking-tight">
              Supprimer mes données
            </h2>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Suppression de toutes vos watchlists, positions de portefeuille,
              alertes, notifications, rapports et backtests. Action irréversible.
              La suppression définitive du compte d&apos;authentification nécessite une
              intervention du support.
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={busy != null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-down/30 bg-down/10 text-down text-sm font-medium transition-all duration-200 hover:bg-down/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        >
          {busy === 'delete' ? (
            <>
              <span className="animate-spin inline-block h-3.5 w-3.5 border border-current border-t-transparent rounded-full" />
              Suppression…
            </>
          ) : (
            'Supprimer mes données'
          )}
        </button>
      </section>

      {/* Message de feedback */}
      {msg && (
        <div className="rounded-lg border border-border bg-elevated px-4 py-3 text-sm text-muted">
          {msg}
        </div>
      )}
    </div>
  );
}

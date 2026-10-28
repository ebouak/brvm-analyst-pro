'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Génère le décryptage d'une valeur ; il arrive « à valider » dans la liste. */
export default function GenererDecryptage({ codes }: { codes: string[] }) {
  const [code, setCode] = useState(codes.includes('SNTS') ? 'SNTS' : (codes[0] ?? ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function generer() {
    setBusy(true);
    setMessage(null);
    const r = await fetch('/api/admin/articles/decryptage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const rep = (await r.json().catch(() => ({}))) as { titre?: string; error?: string };
    setBusy(false);
    setMessage(r.ok ? `Prêt à valider : ${rep.titre}` : (rep.error ?? 'Échec'));
    if (r.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="text-sm text-ivory">Décryptage d’une valeur</span>
      <select
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ivory"
        aria-label="Valeur à décrypter"
      >
        {codes.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={generer}
        disabled={busy || !code}
        className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/10 disabled:opacity-40"
      >
        {busy ? 'Génération…' : 'Générer'}
      </button>
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </div>
  );
}

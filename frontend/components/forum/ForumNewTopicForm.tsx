'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTopic } from '@/lib/forum/actions';

export function ForumNewTopicForm({ instruments }: { instruments: { code: string; designation: string | null }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        const r = await createTopic({ title, body, instrumentCode: code || null, eventId: null });
        setBusy(false);
        if ('error' in r) setError(r.error ?? null); else router.push(`/forum/${r.id}`);
      }}
      className="space-y-3"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du sujet" aria-label="Titre"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50" />
      <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Rattacher à une action (optionnel)"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white">
        <option value="">— Discussion générale (aucun rattachement) —</option>
        {instruments.map((i) => <option key={i.code} value={i.code}>{i.code} — {i.designation ?? ''}</option>)}
      </select>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Votre message…" aria-label="Message"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50" />
      {error && <p className="text-xs text-down">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg disabled:opacity-40">
        {busy ? 'Publication…' : 'Publier le sujet'}
      </button>
    </form>
  );
}

'use client';
import { useState } from 'react';
import { createPost } from '@/lib/forum/actions';

export function ForumReplyForm({ topicId, canPost }: { topicId: string; canPost: boolean }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canPost) return <p className="text-sm text-muted">Connectez-vous pour répondre.</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        const r = await createPost({ topicId, body });
        setBusy(false);
        if ('error' in r) setError(r.error ?? null); else { setBody(''); location.reload(); }
      }}
      className="space-y-2"
    >
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)} rows={4}
        placeholder="Votre réponse…" aria-label="Votre réponse"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50"
      />
      {error && <p className="text-xs text-down">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg disabled:opacity-40">
        {busy ? 'Envoi…' : 'Répondre'}
      </button>
    </form>
  );
}

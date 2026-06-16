'use client';

import { useState, useTransition } from 'react';
import { sendCampaign, unsubscribeSubscriber } from './actions';

export function CampaignForm() {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function send() {
    setMsg(null);
    startTransition(async () => {
      const r = await sendCampaign(subject, body);
      setMsg(r.ok ? `Campagne envoyée à ${r.sent} abonné(s).` : (r.message ?? 'Erreur'));
      if (r.ok) { setSubject(''); setBody(''); }
    });
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-5">
      <h2 className="font-display text-base text-ivory">Nouvelle campagne</h2>
      <p className="mt-1 text-xs text-muted">Envoyée uniquement aux abonnés confirmés, avec lien de désabonnement.</p>
      {msg && <div role="status" className="mt-3 rounded-card border border-border bg-bg p-3 text-sm text-ivory">{msg}</div>}
      <input
        value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet"
        className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
      />
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)} placeholder="Contenu de l'email…" rows={6}
        className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
      />
      <button
        type="button" disabled={pending || !subject.trim() || !body.trim()}
        onClick={send}
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
      >
        {pending ? 'Envoi…' : 'Envoyer la campagne'}
      </button>
    </section>
  );
}

export function UnsubscribeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="text-faint">Désabonné</span>;
  return (
    <button
      type="button" disabled={pending}
      onClick={() => startTransition(async () => { const r = await unsubscribeSubscriber(id); if (r.ok) setDone(true); })}
      className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
    >
      Désabonner
    </button>
  );
}

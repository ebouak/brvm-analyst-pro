'use client';

import { useState, useTransition, useRef } from 'react';
import { sendCampaign, unsubscribeSubscriber } from './actions';

export function CampaignForm() {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const inlineRef = useRef<HTMLInputElement>(null);

  function send() {
    setMsg(null);
    const fd = new FormData();
    fd.set('subject', subject);
    fd.set('body', body);
    for (const f of Array.from(attachRef.current?.files ?? [])) fd.append('attachments', f);
    for (const f of Array.from(inlineRef.current?.files ?? [])) fd.append('inlineImages', f);
    startTransition(async () => {
      const r = await sendCampaign(fd);
      setMsg(r.ok ? `Campagne envoyée à ${r.sent} abonné(s).` : (r.message ?? 'Erreur'));
      if (r.ok) {
        setSubject(''); setBody('');
        if (attachRef.current) attachRef.current.value = '';
        if (inlineRef.current) inlineRef.current.value = '';
      }
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
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Pièces jointes (PDF, images)
          <input ref={attachRef} type="file" multiple accept="application/pdf,image/png,image/jpeg"
            className="mt-1 block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-border file:px-2 file:py-1 file:text-ivory" />
        </label>
        <label className="text-xs text-muted">
          Images intégrées au corps
          <input ref={inlineRef} type="file" multiple accept="image/png,image/jpeg"
            className="mt-1 block w-full text-xs text-muted file:mr-2 file:rounded file:border-0 file:bg-border file:px-2 file:py-1 file:text-ivory" />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-faint">Total ≤ 8 Mo, 5 fichiers max ; image intégrée ≤ 2 Mo.</p>
      <button
        type="button" disabled={pending || !subject.trim() || !body.trim()}
        onClick={send}
        className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
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

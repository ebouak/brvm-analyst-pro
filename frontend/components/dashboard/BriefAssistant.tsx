'use client';

import { useState } from 'react';

interface Msg { role: 'user' | 'assistant'; content: string; }

export default function BriefAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    const next = [...msgs, { role: 'user' as const, content: question }];
    setMsgs(next); setQ('');
    try {
      const r = await fetch('/api/brief-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: msgs.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const raw = await r.text();
      let j: { answer?: string; error?: string };
      try { j = JSON.parse(raw); } catch { j = { error: raw.slice(0, 200) }; }
      setMsgs([...next, { role: 'assistant', content: r.ok ? (j.answer ?? '') : `⚠️ ${j.error ?? 'Erreur'}` }]);
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : 'Erreur'}` }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="text-xs bg-up/10 border border-up/30 text-up rounded px-3 py-1.5 hover:bg-up/20 transition">
        🤖 Demander à l'IA
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
          <div className="bg-surface border border-border rounded-xl shadow-lg max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">🤖 Assistant IA — Séance</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-fg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {msgs.length === 0 && <p className="text-xs text-muted">Posez une question sur la séance (ex. « Quelles actions ont le plus monté ? », « Analyse SONATEL »).</p>}
              {msgs.map((m, i) => (
                <div key={i} className={`text-sm ${m.role === 'user' ? 'text-white' : 'text-muted'}`}>
                  <span className="text-[10px] uppercase opacity-60">{m.role === 'user' ? 'Vous' : 'IA'}</span>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
              {busy && <p className="text-xs text-muted">🤖 réflexion…</p>}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
                placeholder="Votre question…" className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm" />
              <button type="button" onClick={ask} disabled={busy || !q.trim()}
                className="text-xs bg-up/90 hover:bg-up text-black font-medium rounded px-3 disabled:opacity-50">Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

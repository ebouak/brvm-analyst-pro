'use client';

import { useEffect, useState } from 'react';

interface KeyStatus { provider: string; configured: boolean; source: string | null; }
const LABELS: Record<string, string> = { deepseek: 'DeepSeek (prioritaire)', mistral: 'Mistral (vision/scannés)', xai: 'Grok / xAI (fallback)', resend: 'Resend (envoi d’emails)' };

export default function ApiKeysForm() {
  const [status, setStatus] = useState<KeyStatus[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/admin/cles');
    if (r.ok) { const j = await r.json(); setStatus(j.status); }
  }
  useEffect(() => { void load(); }, []);

  async function save(provider: string) {
    setBusy(provider); setMsg(null);
    try {
      const r = await fetch('/api/admin/cles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: vals[provider] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Échec');
      setVals({ ...vals, [provider]: '' });
      setMsg(`Clé ${provider} enregistrée.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {status.map((s) => (
        <div key={s.provider} className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{LABELS[s.provider] ?? s.provider}</span>
            <span className={`text-xs ${s.configured ? 'text-up' : 'text-muted'}`}>
              {s.configured ? `✓ configurée (${s.source})` : '○ absente'}
            </span>
          </div>
          <div className="flex gap-2">
            <input type="password" placeholder="Nouvelle clé…" value={vals[s.provider] ?? ''}
              onChange={(e) => setVals({ ...vals, [s.provider]: e.target.value })}
              className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm" />
            <button type="button" onClick={() => save(s.provider)} disabled={busy === s.provider || !vals[s.provider]?.trim()}
              className="text-xs bg-up/90 hover:bg-up text-black font-medium rounded px-3 disabled:opacity-50">
              {busy === s.provider ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ))}
      {msg && <p className="text-xs text-muted">{msg}</p>}
      <p className="text-[10px] text-muted">Les clés env Vercel sont prioritaires. Les clés saisies ici sont stockées en base (service_role) et jamais réaffichées.</p>
    </div>
  );
}

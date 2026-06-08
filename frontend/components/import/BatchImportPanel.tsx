'use client';
import { useState } from 'react';

export default function BatchImportPanel() {
  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState('');

  async function run() {
    setRunning(true); setLog('');
    try {
      const res = await fetch('/api/import-batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code.trim() ? { code: code.trim() } : {}),
      });
      if (!res.ok || !res.body) { setLog(`Erreur ${res.status}`); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setLog(buf);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Import auto depuis les publications</p>
        <p className="text-xs text-muted mt-0.5">Extrait les états financiers (exercice récent + 2023) pour une action, ou toutes si vide.</p>
      </div>
      <div className="flex gap-2">
        <input
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE (vide = toutes)"
          className="w-40 bg-bg border border-border rounded px-2 py-1.5 text-sm uppercase"
        />
        <button
          type="button" onClick={() => void run()} disabled={running}
          className="px-3 py-1.5 rounded-lg bg-up text-bg text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
        >
          {running ? '⏳ Extraction…' : 'Lancer'}
        </button>
      </div>
      {log && (
        <pre className="text-xs text-muted bg-bg border border-border rounded p-3 max-h-80 overflow-auto whitespace-pre-wrap">{log}</pre>
      )}
    </div>
  );
}

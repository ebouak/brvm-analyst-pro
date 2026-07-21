'use client';
import { useState } from 'react';

const NIVEAU_LABEL: Record<string, string> = { debutant: 'Initiation', intermediaire: 'Fondamental', avance: 'Technique', expert: 'Expert' };

export default function CertificateActions({ niveau, defaultName }: { niveau: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [consent, setConsent] = useState(false);
  const [certId, setCertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true); setError(null);
    const r = await fetch('/api/academy/certificate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niveau, display_name: name, consent }),
    });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setError(d.error ?? 'Erreur'); return; }
    setCertId(d.id);
  }

  if (certId) {
    const url = `${window.location.origin}/certificat/${certId}`;
    const now = new Date();
    const linkedin = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent('Academy WESTBOURSE · ' + (NIVEAU_LABEL[niveau] ?? niveau))}&organizationName=WESTBOURSE&issueYear=${now.getFullYear()}&issueMonth=${now.getMonth() + 1}&certUrl=${encodeURIComponent(url)}&certId=${certId}`;
    return (
      <div className="space-y-3">
        <p className="text-sm text-up">✓ Certificat généré.</p>
        <a href={url} className="block text-sm text-accent hover:underline">Voir mon certificat →</a>
        <div className="flex flex-wrap gap-2">
          <a href={linkedin} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white">Ajouter à LinkedIn</a>
          <button type="button" onClick={() => navigator.clipboard.writeText(url)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white">Copier le lien</button>
          <a href={`https://wa.me/?text=${encodeURIComponent('Mon certificat WESTBOURSE : ' + url)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-white">WhatsApp</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-muted">Nom affiché sur le certificat
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-white" />
      </label>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>J’accepte que mon nom et ce certificat figurent sur une page publique vérifiable, et je peux le révoquer à tout moment.</span>
      </label>
      {error && <p className="text-sm text-down">{error}</p>}
      <button type="button" onClick={generate} disabled={!consent || name.trim().length < 2 || busy}
        className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">
        {busy ? '…' : 'Générer le certificat'}
      </button>
    </div>
  );
}

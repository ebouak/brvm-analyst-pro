'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bouton + formulaire de clôture d'une thèse. Le cours de clôture n'est pas
 * saisi ici : le serveur fige le dernier cours en base.
 */
export default function CloturerButton({ id }: { id: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [verdict, setVerdict] = useState('jouee');
  const [bilan, setBilan] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function cloturer() {
    setEnvoi(true); setErreur(null);
    const r = await fetch(`/api/theses/${id}/cloturer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict, bilan }),
    });
    setEnvoi(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErreur(j.error ?? 'Échec de la clôture');
      return;
    }
    setOuvert(false);
    router.refresh();
  }

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)}
        className="mt-2 text-xs border border-border rounded px-2 py-1 text-muted hover:text-white transition">
        Clôturer
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-elevated p-3">
      <select value={verdict} onChange={(e) => setVerdict(e.target.value)}
        aria-label="Verdict de la thèse"
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs">
        <option value="jouee">Thèse jouée (validée)</option>
        <option value="invalidee">Thèse invalidée</option>
        <option value="abandonnee">Abandonnée</option>
      </select>
      <textarea value={bilan} onChange={(e) => setBilan(e.target.value)}
        placeholder="Bilan : qu'ai-je appris ? (facultatif)" rows={3} maxLength={2000}
        aria-label="Bilan de la thèse"
        className="w-full bg-surface border border-border rounded px-2 py-1 text-xs" />
      {erreur && <p className="text-[11px] text-down">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={cloturer} disabled={envoi}
          className="text-xs border border-up/40 bg-up/10 text-up rounded px-2 py-1 disabled:opacity-50">
          {envoi ? '…' : 'Confirmer la clôture'}
        </button>
        <button type="button" onClick={() => setOuvert(false)}
          className="text-xs text-faint hover:text-white">Annuler</button>
      </div>
    </div>
  );
}

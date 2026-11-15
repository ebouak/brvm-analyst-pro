'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Boutons de décision d'un élément de relecture. La décision s'applique
 * immédiatement côté serveur (la sélection est rejouée pour la banque).
 */
export default function RelectureActions({ id, observations, unite }: { id: string; observations: { id: string; libelle: string }[]; unite: string }) {
  const router = useRouter();
  const [choix, setChoix] = useState(observations[0]?.id ?? '');
  const [texte, setTexte] = useState('');
  const [etat, setEtat] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyer(corps: Record<string, string>) {
    setEnCours(true);
    setEtat(null);
    try {
      const r = await fetch(`/api/admin/agregats/relecture/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setEtat(j.error ?? `Erreur ${r.status}`);
        return;
      }
      router.refresh();
    } catch {
      setEtat('Réseau indisponible : la décision n’a pas été envoyée.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-1 text-faint">
        Observation
        <select value={choix} onChange={(e) => setChoix(e.target.value)} className="rounded-md border border-border bg-elevated px-2 py-1 text-ivory">
          {observations.map((o) => <option key={o.id} value={o.id}>{o.libelle}</option>)}
        </select>
      </label>
      <button type="button" disabled={enCours || !choix} onClick={() => envoyer({ action: 'valider', observation: choix })} className="rounded-md border border-border px-3 py-1 text-ivory hover:bg-elevated disabled:opacity-50">Valider</button>
      <label className="flex flex-col gap-1 text-faint">
        Valeur corrigée ({unite})
        <input value={texte} onChange={(e) => setTexte(e.target.value)} inputMode="decimal" className="tabular w-40 rounded-md border border-border bg-elevated px-2 py-1 text-ivory" />
      </label>
      <button type="button" disabled={enCours || !choix || !texte.trim()} onClick={() => envoyer({ action: 'corriger', observation: choix, texte })} className="rounded-md border border-border px-3 py-1 text-ivory hover:bg-elevated disabled:opacity-50">Corriger</button>
      <button type="button" disabled={enCours} onClick={() => envoyer({ action: 'rejeter' })} className="rounded-md border border-border px-3 py-1 text-down hover:bg-elevated disabled:opacity-50">Rejeter tout</button>
      {etat && <p role="alert" className="w-full text-down">{etat}</p>}
    </div>
  );
}

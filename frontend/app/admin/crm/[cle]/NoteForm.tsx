// frontend/app/admin/crm/[cle]/NoteForm.tsx
'use client';
import { useState, useTransition } from 'react';
import { ajouterNote } from './actions';

export default function NoteForm({ cle }: { cle: string }) {
  const [note, setNote] = useState('');
  const [retour, setRetour] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();
  return (
    <div className="space-y-2">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Note interne" placeholder="Note interne (jamais visible par la personne)" />
      <button disabled={envoi || !note.trim()} onClick={() => demarrer(async () => { try { const r = await ajouterNote(cle, note); setRetour(r.message); if (r.ok) setNote(''); } catch { setRetour('Erreur serveur : note non enregistrée.'); } })} className="rounded-full border border-border px-4 py-1.5 text-sm disabled:opacity-50">Ajouter la note</button>
      {retour && <p className="text-xs text-muted">{retour}</p>}
    </div>
  );
}

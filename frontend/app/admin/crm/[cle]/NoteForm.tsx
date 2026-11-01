// frontend/app/admin/crm/[cle]/NoteForm.tsx
'use client';
import { useRef, useState, useTransition } from 'react';
import { ajouterNote } from './actions';

export default function NoteForm({ cle }: { cle: string }) {
  const [note, setNote] = useState('');
  const [retour, setRetour] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();
  const verrou = useRef(false);
  const [occupe, setOccupe] = useState(false);
  const envoi = pending || occupe;
  const ajouter = () => {
    if (verrou.current) return;
    verrou.current = true; setOccupe(true);
    demarrer(async () => { try { const r = await ajouterNote(cle, note); setRetour(r.message); if (r.ok) setNote(''); } catch { setRetour('Erreur serveur : note non enregistrée.'); } finally { verrou.current = false; setOccupe(false); } });
  };
  return (
    <div className="space-y-2">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Note interne" placeholder="Note interne — jamais envoyée, mais incluse dans l'export RGPD de la personne" />
      <button disabled={envoi || !note.trim()} onClick={ajouter} className="rounded-full border border-border px-4 py-1.5 text-sm disabled:opacity-50">Ajouter la note</button>
      {retour && <p className="text-xs text-muted">{retour}</p>}
    </div>
  );
}

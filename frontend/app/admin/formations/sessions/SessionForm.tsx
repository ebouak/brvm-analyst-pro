'use client';
import { useState, useTransition } from 'react';
import { creerSession } from './actions';

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory';

export default function SessionForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => start(async () => { const r = await creerSession(fd); setMessage(r.message); setOk(r.ok); })}
      className="grid grid-cols-1 gap-3 rounded-panel border border-border bg-surface p-5 md:grid-cols-2"
    >
      <label className="text-xs text-muted md:col-span-2">Titre *
        <input name="titre" required maxLength={120} className={INPUT} placeholder="Initiation à la Bourse et à la BRVM" />
      </label>
      <label className="text-xs text-muted">Niveau
        <select name="niveau" className={INPUT} defaultValue="debutant">
          <option value="debutant">Débutant</option>
          <option value="intermediaire">Intermédiaire</option>
          <option value="avance">Avancé</option>
        </select>
      </label>
      <label className="text-xs text-muted">Modalité
        <select name="modalite" className={INPUT} defaultValue="visio">
          <option value="visio">En ligne</option>
          <option value="presentiel">Présentiel</option>
        </select>
      </label>
      <label className="text-xs text-muted">Début *
        <input name="debut_at" type="datetime-local" required className={INPUT} />
      </label>
      <label className="text-xs text-muted">Durée (minutes)
        <input name="duree_min" type="number" min={30} max={600} defaultValue={240} className={INPUT} />
      </label>
      <label className="text-xs text-muted">Places
        <input name="places" type="number" min={1} defaultValue={20} className={INPUT} />
      </label>
      <label className="text-xs text-muted">Lieu
        <input name="lieu" className={INPUT} placeholder="Abidjan, Plateau — ou « En ligne »" />
      </label>
      <label className="text-xs text-muted md:col-span-2">Lien de visioconférence (jamais public)
        <input name="lien_visio" type="url" className={INPUT} placeholder="https://…" />
      </label>
      <label className="text-xs text-muted">Prix (FCFA) *
        <input name="prix" type="number" min={0} required className={INPUT} />
      </label>
      <label className="text-xs text-muted">Prix abonné (vide = pas de remise)
        <input name="prix_abonne" type="number" min={0} className={INPUT} />
      </label>
      <label className="text-xs text-muted md:col-span-2">Description
        <textarea name="description" rows={4} maxLength={2000} className={INPUT} />
      </label>
      <div className="md:col-span-2">
        <button type="submit" disabled={pending} className="min-h-[44px] rounded-lg bg-accent px-5 text-sm font-semibold text-obsidian disabled:opacity-50">
          {pending ? 'Création…' : 'Créer la séance'}
        </button>
        {message && <p role="status" className={`mt-2 text-sm ${ok ? 'text-up' : 'text-down'}`}>{message}</p>}
      </div>
    </form>
  );
}

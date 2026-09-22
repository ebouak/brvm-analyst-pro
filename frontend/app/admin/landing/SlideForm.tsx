'use client';

import { useRef, useState, useTransition } from 'react';
import { createSlide, deleteSlide, toggleSlide } from './actions';

const INPUT = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory';

export function SlideForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<'ad' | 'house'>('ad');
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="rounded-panel border border-border bg-surface p-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        start(async () => {
          const r = await createSlide(fd);
          setMsg(r.ok ? 'Diapositive ajoutée. Elle apparaît sur la landing dans les 5 minutes.' : (r.message ?? 'Erreur'));
          if (r.ok) form.current?.reset();
        });
      }}
    >
      <h2 className="font-display text-base text-ivory">Nouvelle diapositive</h2>
      <p className="text-xs text-muted">
        Image 1 600 × 1 200 (JPEG, PNG ou WebP, 5 Mo max). Une publicité est toujours affichée avec la mention « Publicité » et le nom de l&apos;annonceur.
        La landing montre au plus 7 vues admin, après ses vues permanentes.
      </p>
      {msg && <div role="status" className="rounded-card border border-border bg-bg p-3 text-sm text-ivory">{msg}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-muted">Type
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'ad' | 'house')} className={INPUT}>
            <option value="ad">Publicité (annonceur)</option>
            <option value="house">Annonce maison</option>
          </select>
        </label>
        <label className="text-xs text-muted">Emplacement
          <select name="placement" className={INPUT} defaultValue="billboard">
            <option value="billboard">Bandeau (recommandé — toutes les créations tournent)</option>
            <option value="hero">Carrousel du hero (quelques vues seulement)</option>
          </select>
        </label>
        <label className="text-xs text-muted">Annonceur {kind === 'ad' && <span className="text-down">*</span>}
          <input name="sponsor_name" required={kind === 'ad'} maxLength={80} className={INPUT} placeholder="Raison sociale" />
        </label>
        <label className="text-xs text-muted md:col-span-2">Titre *
          <input name="title" required minLength={3} maxLength={80} className={INPUT} />
        </label>
        <label className="text-xs text-muted md:col-span-2">Sous-titre
          <input name="subtitle" maxLength={200} className={INPUT} />
        </label>
        <label className="text-xs text-muted">Libellé du bouton
          <input name="cta_label" maxLength={40} className={INPUT} placeholder="En savoir plus" />
        </label>
        <label className="text-xs text-muted">Lien (https://…)
          <input name="link_url" type="url" className={INPUT} />
        </label>
        <label className="text-xs text-muted">Début
          <input name="starts_at" type="datetime-local" className={INPUT} />
        </label>
        <label className="text-xs text-muted">Fin (vide = sans fin)
          <input name="ends_at" type="datetime-local" className={INPUT} />
        </label>
        <label className="text-xs text-muted">Position (croissant)
          <input name="position" type="number" defaultValue={100} min={0} max={999} className={INPUT} />
        </label>
        <label className="text-xs text-muted">Image *
          <input name="image" type="file" required accept="image/jpeg,image/png,image/webp" className={INPUT} />
        </label>
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#03222b] disabled:opacity-50">
        {pending ? 'Envoi…' : 'Ajouter la diapositive'}
      </button>
    </form>
  );
}

export function SlideRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { await toggleSlide(id, !active); })}
        className="rounded-md border border-border px-2 py-1 text-xs text-ivory hover:bg-surface disabled:opacity-50">
        {active ? 'Désactiver' : 'Activer'}
      </button>
      <button type="button" disabled={pending}
        onClick={() => { if (window.confirm('Supprimer cette diapositive et son image ?')) start(async () => { await deleteSlide(id); }); }}
        className="rounded-md border border-down/40 px-2 py-1 text-xs text-down hover:bg-down/10 disabled:opacity-50">
        Supprimer
      </button>
    </div>
  );
}

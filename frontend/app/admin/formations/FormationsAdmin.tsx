'use client';

import { useState, useTransition } from 'react';
import type { AdminFormation } from '@/lib/admin/formations';
import { upsertFormation, setPublished, deleteFormation } from './actions';

const TYPE_LABEL: Record<string, string> = { cours: 'Cours', conference: 'Conférence', webinaire: 'Webinaire' };
const empty = { titre: '', description: '', type: 'cours', niveau: '', date_evenement: '', duree_min: '', cover_url: '', replay_url: '', support_url: '', published: 'false' };

export function FormationsAdmin({ rows }: { rows: AdminFormation[] }) {
  const [editing, setEditing] = useState<string | null>(null); // id en édition, ou 'new'
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openNew() { setForm(empty); setEditing('new'); setMsg(null); }
  function openEdit(f: AdminFormation) {
    setEditing(f.id); setMsg(null);
    setForm({
      titre: f.titre, description: f.description ?? '', type: f.type, niveau: f.niveau ?? '',
      date_evenement: f.date_evenement ?? '', duree_min: f.duree_min != null ? String(f.duree_min) : '',
      cover_url: f.cover_url ?? '', replay_url: f.replay_url ?? '', support_url: f.support_url ?? '',
      published: String(f.published),
    });
  }
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  function save() {
    start(async () => {
      const r = await upsertFormation(editing === 'new' ? null : editing, form);
      if (r.ok) { setEditing(null); setMsg(null); } else setMsg(r.message ?? 'Erreur');
    });
  }
  function togglePub(f: AdminFormation) { start(async () => { await setPublished(f.id, !f.published); }); }
  function remove(f: AdminFormation) {
    if (!confirm(`Supprimer « ${f.titre} » ?`)) return;
    start(async () => { await deleteFormation(f.id); });
  }

  const Field = ({ k, label, type = 'text', ph }: { k: string; label: string; type?: string; ph?: string }) => (
    <label className="block text-xs text-muted">
      {label}
      <input type={type} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={ph}
        className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory placeholder:text-faint" />
    </label>
  );

  return (
    <div className="space-y-4">
      <button type="button" onClick={openNew}
        className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg">+ Nouvelle formation</button>

      {editing && (
        <div className="rounded-xl border border-info/30 bg-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">{editing === 'new' ? 'Nouvelle formation' : 'Modifier'}</h3>
          <Field k="titre" label="Titre *" />
          <label className="block text-xs text-muted">Description
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory" />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="block text-xs text-muted">Type
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory">
                <option value="cours">Cours</option><option value="conference">Conférence</option><option value="webinaire">Webinaire</option>
              </select>
            </label>
            <label className="block text-xs text-muted">Niveau
              <select value={form.niveau} onChange={(e) => set('niveau', e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory">
                <option value="">—</option><option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option>
              </select>
            </label>
            <Field k="duree_min" label="Durée (min)" type="number" />
            <Field k="date_evenement" label="Date (conférence)" type="date" />
            <Field k="cover_url" label="Cover URL" ph="https://…" />
          </div>
          <Field k="replay_url" label="Replay URL (YouTube/Vimeo/lien)" ph="https://youtube.com/watch?v=…" />
          <Field k="support_url" label="Support URL (PDF)" ph="https://…" />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={form.published === 'true'} onChange={(e) => set('published', String(e.target.checked))} />
            Publiée (visible au catalogue)
          </label>
          {msg && <p className="text-xs text-down">{msg}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="rounded-lg bg-info px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-50">
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="text-xs text-muted hover:text-white px-2">Annuler</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Titre</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-center">Publiée</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-faint">Aucune formation.</td></tr>}
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-border/50">
                <td className="px-3 py-2 text-white">{f.titre}</td>
                <td className="px-3 py-2 text-muted">{TYPE_LABEL[f.type] ?? f.type}</td>
                <td className="px-3 py-2 text-center">
                  <button type="button" onClick={() => togglePub(f)} disabled={pending}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${f.published ? 'bg-up/15 text-up' : 'bg-border text-faint'}`}>
                    {f.published ? 'Publiée' : 'Brouillon'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => openEdit(f)} className="text-xs text-info hover:underline mr-3">Modifier</button>
                  <button type="button" onClick={() => remove(f)} className="text-xs text-down hover:underline">Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

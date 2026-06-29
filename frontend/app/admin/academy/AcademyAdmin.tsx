'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AcademyCourseCard } from '@/lib/academy/server';
import { setCoursePublished, deleteCourse } from './actions';

const NIVEAUX = [
  { v: 'debutant', l: 'Débutant' },
  { v: 'intermediaire', l: 'Intermédiaire' },
  { v: 'avance', l: 'Avancé' },
  { v: 'expert', l: 'Expert' },
];

export function AcademyAdmin({ courses }: { courses: AcademyCourseCard[] }) {
  const router = useRouter();
  const [sujet, setSujet] = useState('');
  const [niveau, setNiveau] = useState('debutant');
  const [nbLessons, setNbLessons] = useState(5);
  const [gen, setGen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function generate() {
    if (!sujet.trim()) { setMsg('Indiquez un sujet.'); return; }
    setGen(true); setMsg('Génération IA en cours… (30–90 s)');
    try {
      const res = await fetch('/api/academy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujet, niveau, nbLessons }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? 'Échec de la génération.'); return; }
      setMsg(`✅ « ${data.titre} » généré (${data.lessons} leçons, ${data.provider}). Brouillon créé — publiez-le ci-dessous.`);
      setSujet('');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      setGen(false);
    }
  }

  function togglePub(c: AcademyCourseCard) {
    start(async () => { await setCoursePublished(c.slug, !c.published); router.refresh(); });
  }
  function remove(c: AcademyCourseCard) {
    if (!confirm(`Supprimer « ${c.titre} » ?`)) return;
    start(async () => { await deleteCourse(c.slug); router.refresh(); });
  }

  return (
    <div className="space-y-5">
      {/* Générateur */}
      <div className="rounded-xl border border-info/30 bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Générer un nouveau cours</h3>
        <label className="block text-xs text-muted">
          Sujet du cours *
          <input
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder="Ex. : Comprendre le PER et la valorisation des actions BRVM"
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory placeholder:text-faint"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="block text-xs text-muted">
            Niveau
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory">
              {NIVEAUX.map((n) => <option key={n.v} value={n.v}>{n.l}</option>)}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Nb de leçons
            <input type="number" min={1} max={12} value={nbLessons}
              onChange={(e) => setNbLessons(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory" />
          </label>
        </div>
        {msg && <p className="text-xs text-info">{msg}</p>}
        <button type="button" onClick={generate} disabled={gen}
          className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
          {gen ? 'Génération…' : '✨ Générer le cours'}
        </button>
      </div>

      {/* Liste */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Titre</th>
              <th className="px-3 py-2 text-left">Niveau</th>
              <th className="px-3 py-2 text-center">Publié</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-faint">Aucun cours généré.</td></tr>
            )}
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-border/50">
                <td className="px-3 py-2 text-white">{c.titre}</td>
                <td className="px-3 py-2 text-muted">{c.niveau ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  <button type="button" onClick={() => togglePub(c)} disabled={pending}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${c.published ? 'bg-up/15 text-up' : 'bg-border text-faint'}`}>
                    {c.published ? 'Publié' : 'Brouillon'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <a href={`/formations/academy/${c.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-info hover:underline mr-3">Aperçu</a>
                  <button type="button" onClick={() => remove(c)} className="text-xs text-down hover:underline">Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

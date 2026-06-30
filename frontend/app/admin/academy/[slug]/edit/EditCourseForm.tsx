'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CourseContent } from '@/lib/academy/types';
import { NIVEAUX, CATEGORIES, NIVEAU_LABEL, CATEGORIE_LABEL, SECTION_LABEL } from '@/lib/academy/types';
import { updateCourseContent } from '../../actions';

const ta = 'mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory placeholder:text-faint';
const lab = 'block text-xs text-muted';

export function EditCourseForm({ slug, initial }: { slug: string; initial: CourseContent }) {
  const router = useRouter();
  const [content, setContent] = useState<CourseContent>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function mutate(fn: (c: CourseContent) => void) {
    setContent((prev) => {
      const next = structuredClone(prev) as CourseContent;
      fn(next);
      return next;
    });
  }

  function save() {
    setMsg(null);
    start(async () => {
      const r = await updateCourseContent(slug, content);
      if (r.ok) { setMsg('✅ Enregistré. Le cours est mis à jour.'); router.refresh(); }
      else setMsg(r.message ?? 'Erreur.');
    });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* En-tête du cours */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <label className={lab}>Titre
          <input value={content.titre} onChange={(e) => mutate((c) => { c.titre = e.target.value; })} className={ta} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={lab}>Niveau
            <select value={content.niveau} onChange={(e) => mutate((c) => { c.niveau = e.target.value as CourseContent['niveau']; })} className={ta}>
              {NIVEAUX.map((n) => <option key={n} value={n}>{NIVEAU_LABEL[n]}</option>)}
            </select>
          </label>
          <label className={lab}>Couverture (URL)
            <input value={content.coverUrl ?? ''} onChange={(e) => mutate((c) => { c.coverUrl = e.target.value || null; })} placeholder="https://…" className={ta} />
          </label>
        </div>
        <label className={lab}>Introduction
          <textarea value={content.intro} onChange={(e) => mutate((c) => { c.intro = e.target.value; })} rows={4} className={ta} />
        </label>
      </div>

      {/* Leçons */}
      {content.lessons.map((lesson, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-info">Leçon {i + 1}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className={lab}>Titre
              <input value={lesson.titre} onChange={(e) => mutate((c) => { c.lessons[i].titre = e.target.value; })} className={ta} />
            </label>
            <label className={lab}>Catégorie
              <select value={lesson.categorie} onChange={(e) => mutate((c) => { c.lessons[i].categorie = e.target.value as CourseContent['lessons'][number]['categorie']; })} className={ta}>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{CATEGORIE_LABEL[cat]}</option>)}
              </select>
            </label>
          </div>
          <label className={lab}>Résumé
            <textarea value={lesson.resume} onChange={(e) => mutate((c) => { c.lessons[i].resume = e.target.value; })} rows={2} className={ta} />
          </label>

          {/* Sections */}
          {lesson.sections.map((section, j) => (
            <label key={j} className={lab}>{SECTION_LABEL[section.type] ?? section.titre}
              <textarea value={section.contenu} onChange={(e) => mutate((c) => { c.lessons[i].sections[j].contenu = e.target.value; })} rows={3} className={ta} />
            </label>
          ))}

          {/* QCM */}
          {lesson.qcm && (
            <div className="rounded-lg border border-border/60 bg-bg/30 p-3 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-faint">QCM</span>
              <label className={lab}>Question
                <input value={lesson.qcm.question} onChange={(e) => mutate((c) => { if (c.lessons[i].qcm) c.lessons[i].qcm!.question = e.target.value; })} className={ta} />
              </label>
              <label className={lab}>Options (une par ligne)
                <textarea value={lesson.qcm.options.join('\n')} onChange={(e) => mutate((c) => { if (c.lessons[i].qcm) c.lessons[i].qcm!.options = e.target.value.split('\n'); })} rows={4} className={ta} />
              </label>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <label className={lab}>Bonne réponse (n°)
                  <input type="number" min={0} max={(lesson.qcm.options.length - 1)} value={lesson.qcm.correct}
                    onChange={(e) => mutate((c) => { if (c.lessons[i].qcm) c.lessons[i].qcm!.correct = Number(e.target.value); })} className={ta} />
                </label>
                <label className={lab}>Explication
                  <input value={lesson.qcm.explication} onChange={(e) => mutate((c) => { if (c.lessons[i].qcm) c.lessons[i].qcm!.explication = e.target.value; })} className={ta} />
                </label>
              </div>
              <p className="text-[10px] text-faint">N° de réponse en base 0 : la 1re option = 0, la 2e = 1, etc.</p>
            </div>
          )}
        </div>
      ))}

      {/* Glossaire */}
      {content.glossaire && content.glossaire.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-info">Glossaire</span>
          {content.glossaire.map((g, k) => (
            <div key={k} className="grid grid-cols-[1fr_2fr] gap-3">
              <input value={g.terme} onChange={(e) => mutate((c) => { c.glossaire![k].terme = e.target.value; })} className={ta} />
              <input value={g.definition} onChange={(e) => mutate((c) => { c.glossaire![k].definition = e.target.value; })} className={ta} />
            </div>
          ))}
        </div>
      )}

      {/* Barre d'action */}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-bg/80 py-3 backdrop-blur">
        <button type="button" onClick={save} disabled={pending}
          className="rounded-lg bg-info px-5 py-2 text-sm font-medium text-bg disabled:opacity-50">
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <a href={`/formations/academy/${slug}`} target="_blank" rel="noopener noreferrer"
          className="text-xs text-info hover:underline">Aperçu ↗</a>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>

      <p className="text-[11px] text-faint">
        Les graphiques et images des leçons sont conservés tels quels. Pour les régénérer, relancez la génération IA (qui écrase le contenu).
      </p>
    </div>
  );
}

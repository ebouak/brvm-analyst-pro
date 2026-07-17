'use client';

import { useState, useTransition } from 'react';
import type { AdminCourse, AdminLesson } from '@/lib/admin/videoModules';
import {
  createCourse, setCoursePublished, addLesson, updateLesson, deleteLesson,
} from '@/app/admin/formations/modules/actions';

function providerLabel(p: string) {
  return p === 'youtube' ? 'YouTube' : p === 'vimeo' ? 'Vimeo' : 'MP4';
}

export function ModulesAdmin({ courses }: { courses: AdminCourse[] }) {
  return (
    <div className="space-y-6">
      {courses.map((c) => <CourseCard key={c.id} course={c} />)}
      <NewCourse />
    </div>
  );
}

function CourseCard({ course }: { course: AdminCourse }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const togglePublish = () =>
    start(async () => {
      const r = await setCoursePublished(course.id, !course.published);
      setMsg(r.ok ? null : r.error ?? 'Erreur');
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ivory">{course.titre}</h3>
          <p className="text-[11px] text-faint">/{course.slug} · {course.lessons.length} leçon(s)</p>
        </div>
        <button
          type="button"
          onClick={togglePublish}
          disabled={pending}
          className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
            course.published
              ? 'border border-up/40 bg-up/10 text-up'
              : 'border border-border text-muted hover:text-ivory'
          }`}
        >
          {course.published ? 'Publié ✓' : 'Brouillon — publier'}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-down">{msg}</p>}

      <div className="mt-3 divide-y divide-border/40">
        {course.lessons.map((l) => <LessonRow key={l.id} lesson={l} />)}
        {course.lessons.length === 0 && (
          <p className="py-2 text-xs text-faint">Aucune leçon — ajoutez-en une ci-dessous.</p>
        )}
      </div>

      <AddLesson courseId={course.id} />
    </div>
  );
}

function LessonRow({ lesson }: { lesson: AdminLesson }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const save = (fd: FormData) =>
    start(async () => {
      const r = await updateLesson(lesson.id, fd);
      setMsg(r.ok ? null : r.error ?? 'Erreur');
      if (r.ok) setEdit(false);
    });
  const remove = () =>
    start(async () => {
      if (!confirm(`Supprimer la leçon « ${lesson.titre} » ?`)) return;
      const r = await deleteLesson(lesson.id);
      setMsg(r.ok ? null : r.error ?? 'Erreur');
    });

  if (edit) {
    return (
      <form action={save} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs text-muted">
          Titre
          <input name="titre" defaultValue={lesson.titre}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ivory" />
        </label>
        <label className="flex-[2] text-xs text-muted">
          Lien vidéo (laisser vide pour conserver)
          <input name="lien" placeholder="https://youtube.com/watch?v=…"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ivory" />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={pending}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-50">Enregistrer</button>
          <button type="button" onClick={() => setEdit(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted">Annuler</button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-ivory">{lesson.ordre}. {lesson.titre}</p>
        <p className="truncate text-[11px] text-faint">
          {providerLabel(lesson.provider)} · <span className="tabular">{lesson.video_url}</span>
        </p>
        {msg && <p className="text-[11px] text-down">{msg}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => setEdit(true)}
          className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-ivory">Modifier</button>
        <button type="button" onClick={remove} disabled={pending}
          className="rounded-lg border border-down/30 px-2.5 py-1 text-xs text-down/80 hover:bg-down/10 disabled:opacity-50">Suppr.</button>
      </div>
    </div>
  );
}

function AddLesson({ courseId }: { courseId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = (fd: FormData) =>
    start(async () => {
      const r = await addLesson(courseId, fd);
      setMsg(r.ok ? null : r.error ?? 'Erreur');
      if (r.ok) setOpen(false);
    });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mt-3 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-ivory">
        + Ajouter une leçon
      </button>
    );
  }
  return (
    <form action={submit} className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-bg p-3 sm:flex-row sm:items-end">
      <label className="flex-1 text-xs text-muted">
        Titre de la leçon
        <input name="titre" required placeholder="Ex. Lire une cotation"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ivory" />
      </label>
      <label className="flex-[2] text-xs text-muted">
        Lien vidéo (YouTube, Vimeo ou URL .mp4)
        <input name="lien" required placeholder="https://www.youtube.com/watch?v=…"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ivory" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-50">Ajouter</button>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted">Annuler</button>
      </div>
      {msg && <p className="text-[11px] text-down">{msg}</p>}
    </form>
  );
}

function NewCourse() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = (fd: FormData) =>
    start(async () => {
      const r = await createCourse(fd);
      setMsg(r.ok ? null : r.error ?? 'Erreur');
      if (r.ok) setOpen(false);
    });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10">
        + Nouveau cours
      </button>
    );
  }
  return (
    <form action={submit} className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-ivory">Nouveau cours</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <input name="titre" required placeholder="Titre du cours"
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory" />
        <select name="niveau" defaultValue="debutant"
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory">
          <option value="debutant">Débutant</option>
          <option value="intermediaire">Intermédiaire</option>
          <option value="avance">Avancé</option>
          <option value="expert">Expert</option>
        </select>
      </div>
      <textarea name="resume" rows={2} placeholder="Résumé (optionnel)"
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50">Créer (brouillon)</button>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted">Annuler</button>
      </div>
      {msg && <p className="text-xs text-down">{msg}</p>}
    </form>
  );
}

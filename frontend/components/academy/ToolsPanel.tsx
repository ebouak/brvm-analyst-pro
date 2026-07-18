'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CourseContent, Lesson } from '@/lib/academy/types';

type Tab = 'notes' | 'glossaire' | 'ressources';

export default function ToolsPanel({
  lesson,
  content,
  note,
  onSaveNote,
}: {
  lesson: Lesson;
  content: CourseContent;
  note: string;
  onSaveNote: (text: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('notes');

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex border-b border-border/60" role="tablist" aria-label="Outils">
        {([['notes', 'Notes'], ['glossaire', 'Glossaire'], ['ressources', 'Ressources']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition ${
              tab === id ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-3">
        {tab === 'notes' && <NotesTab key={note} initial={note} onSave={onSaveNote} />}
        {tab === 'glossaire' && <GlossaireTab items={content.glossaire ?? []} />}
        {tab === 'ressources' && <RessourcesTab lesson={lesson} content={content} />}
      </div>
    </div>
  );
}

function NotesTab({ initial, onSave }: { initial: string; onSave: (t: string) => Promise<void> }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce 800 ms : on ne frappe pas la base à chaque touche.
  useEffect(() => {
    if (text === initial) return;
    setState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await onSave(text);
      setState('saved');
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, initial, onSave]);

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Vos notes sur cette leçon (privées, sauvegardées automatiquement)…"
        className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-ivory placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <p className="mt-1 text-right text-[11px] text-faint" aria-live="polite">
        {state === 'saving' ? 'Enregistrement…' : state === 'saved' ? 'Enregistré ✓' : ' '}
      </p>
    </div>
  );
}

function GlossaireTab({ items }: { items: { terme: string; definition: string }[] }) {
  const [q, setQ] = useState('');
  const list = items.filter(
    (g) => !q || g.terme.toLowerCase().includes(q.toLowerCase()),
  );
  if (items.length === 0) {
    return <p className="py-4 text-center text-xs text-faint">Pas de glossaire pour ce cours.</p>;
  }
  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrer un terme…"
        className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ivory placeholder:text-faint"
      />
      <dl className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {list.map((g) => (
          <div key={g.terme}>
            <dt className="text-xs font-semibold text-accent">{g.terme}</dt>
            <dd className="mt-0.5 text-xs leading-relaxed text-muted">{g.definition}</dd>
          </div>
        ))}
        {list.length === 0 && <p className="text-xs text-faint">Aucun terme ne correspond.</p>}
      </dl>
    </div>
  );
}

/** Liens par catégorie quand la leçon n'en définit pas — l'app comme terrain de pratique. */
const DEFAULT_LINKS: Record<string, { label: string; href: string }[]> = {
  fundamental: [{ label: 'Explorer les fondamentaux', href: '/fondamentaux' }],
  technical: [{ label: 'Scanner technique', href: '/scanner' }],
  income: [{ label: 'Espace dividendes', href: '/dividendes' }],
  evaluation: [{ label: 'Analyses citables', href: '/analyses' }],
  regulatory: [{ label: 'Méthodologie WESTBOURSE', href: '/methodologie' }],
  general: [{ label: 'Tableau de bord', href: '/dashboard' }],
};

function RessourcesTab({ lesson, content }: { lesson: Lesson; content: CourseContent }) {
  const lecons = (lesson.liens?.length ? lesson.liens : DEFAULT_LINKS[lesson.categorie] ?? []) as {
    label: string; href: string;
  }[];
  return (
    <div className="space-y-4">
      <div>
        <p className="overline mb-1.5 text-faint">Pratiquer sur WESTBOURSE</p>
        <ul className="space-y-1.5">
          {lecons.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-sm text-accent hover:underline">{l.label} →</Link>
            </li>
          ))}
        </ul>
      </div>
      {(content.relatedLinks?.length ?? 0) > 0 && (
        <div>
          <p className="overline mb-1.5 text-faint">À lire aussi</p>
          <ul className="space-y-1.5">
            {content.relatedLinks!.map((r) => (
              <li key={r.slug}>
                <Link href={`/formations/academy/${r.slug}`} className="text-sm text-muted hover:text-white">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

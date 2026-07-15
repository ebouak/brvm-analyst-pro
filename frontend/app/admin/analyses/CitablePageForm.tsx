'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePage, uploadImage, type CitableInput } from './actions';

/** Éditeur d'une page citable. Tous les champs GEO : question, réponse, méthode,
 *  sources primaires, FAQ, image. Le tableau data (si kind=data) est généré côté
 *  public — l'admin n'édite QUE le calque (texte + image). */
export function CitablePageForm({ initial }: { initial?: Partial<CitableInput> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [f, setF] = useState<CitableInput>({
    slug: initial?.slug ?? '',
    kind: initial?.kind ?? 'editorial',
    data_source: initial?.data_source ?? null,
    title: initial?.title ?? '',
    question: initial?.question ?? '',
    short_answer: initial?.short_answer ?? '',
    intro_md: initial?.intro_md ?? '',
    commentary_md: initial?.commentary_md ?? '',
    methodology_md: initial?.methodology_md ?? '',
    sources: initial?.sources ?? [],
    faq: initial?.faq ?? [],
    hero_image_url: initial?.hero_image_url ?? '',
    hero_image_alt: initial?.hero_image_alt ?? '',
    author: initial?.author ?? 'La rédaction WESTBOURSE',
    author_role: initial?.author_role ?? 'Analyse de marché BRVM',
  });

  const set = <K extends keyof CitableInput>(k: K, v: CitableInput[K]) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setMsg(null); setErr(null);
    start(async () => {
      const r = await savePage(f);
      if (!r.ok) { setErr(r.message ?? 'Échec.'); return; }
      setMsg('Enregistré.');
      if (!initial?.slug) router.push(`/admin/analyses`);
      else router.refresh();
    });
  }

  async function onUpload(file: File) {
    setErr(null);
    const fd = new FormData(); fd.set('file', file);
    const r = await uploadImage(fd);
    if (r.ok && r.url) set('hero_image_url', r.url);
    else setErr(r.message ?? 'Upload impossible.');
  }

  const input = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50';
  const label = 'block text-xs text-muted mb-1';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Slug (URL) *</span>
          <input value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="rendement-dividende"
            disabled={!!initial?.slug} className={`${input} disabled:opacity-50`} />
        </label>
        <label className="block">
          <span className={label}>Type</span>
          <select value={f.kind} onChange={(e) => set('kind', e.target.value as 'data' | 'editorial')} className={input}>
            <option value="editorial">Éditorial (écrit à la main)</option>
            <option value="data">Data (tableau auto + calque)</option>
          </select>
        </label>
      </div>

      {f.kind === 'data' && (
        <label className="block">
          <span className={label}>Source de données *</span>
          <select value={f.data_source ?? ''} onChange={(e) => set('data_source', e.target.value || null)} className={input}>
            <option value="">— choisir —</option>
            <option value="dividend_yield">Rendement du dividende</option>
            <option value="sgi_cout">Coût des SGI</option>
            <option value="budget">Que faire avec un budget</option>
          </select>
          <span className="mt-1 block text-[11px] text-faint">
            Le tableau correspondant est généré automatiquement sous votre intro.
          </span>
        </label>
      )}

      <label className="block">
        <span className={label}>Titre (H1) *</span>
        <input value={f.title} onChange={(e) => set('title', e.target.value)} className={input} />
      </label>
      <label className="block">
        <span className={label}>Question à laquelle la page répond *</span>
        <input value={f.question} onChange={(e) => set('question', e.target.value)}
          placeholder="Quelles actions BRVM offrent le meilleur rendement du dividende ?" className={input} />
      </label>
      <label className="block">
        <span className={label}>Réponse courte (2-4 phrases — le passage repris par les IA) *</span>
        <textarea value={f.short_answer} onChange={(e) => set('short_answer', e.target.value)} rows={3} className={input} />
      </label>

      {/* Zone image */}
      <div className="rounded-lg border border-border bg-surface p-3">
        <span className={label}>Image d&apos;en-tête</span>
        <div className="flex flex-wrap items-center gap-3">
          <input value={f.hero_image_url ?? ''} onChange={(e) => set('hero_image_url', e.target.value)}
            placeholder="URL ou upload →" className={`${input} flex-1 min-w-[12rem]`} />
          <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-ivory">
            Uploader
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUpload(file); }} />
          </label>
        </div>
        {f.hero_image_url && (
          <input value={f.hero_image_alt ?? ''} onChange={(e) => set('hero_image_alt', e.target.value)}
            placeholder="Texte alternatif (accessibilité + SEO)" className={`${input} mt-2`} />
        )}
      </div>

      <label className="block">
        <span className={label}>Intro (markdown) — avant le tableau</span>
        <textarea value={f.intro_md ?? ''} onChange={(e) => set('intro_md', e.target.value)} rows={4} className={`${input} font-mono text-xs`} />
      </label>
      <label className="block">
        <span className={label}>Commentaire (markdown) — après le tableau</span>
        <textarea value={f.commentary_md ?? ''} onChange={(e) => set('commentary_md', e.target.value)} rows={3} className={`${input} font-mono text-xs`} />
      </label>
      <label className="block">
        <span className={label}>Méthodologie (markdown) — calcul reproductible</span>
        <textarea value={f.methodology_md ?? ''} onChange={(e) => set('methodology_md', e.target.value)} rows={4} className={`${input} font-mono text-xs`} />
      </label>

      {/* Sources & FAQ : éditeurs de liste simples */}
      <ListEditor label="Sources primaires (label + URL)" items={f.sources}
        onChange={(v) => set('sources', v as { label: string; url: string }[])}
        fields={['label', 'url']} placeholder={['BRVM — cours officiels', 'https://…']} />
      <ListEditor label="FAQ (question + réponse)" items={f.faq}
        onChange={(v) => set('faq', v as { q: string; a: string }[])}
        fields={['q', 'a']} placeholder={['Le rendement est-il net d’impôt ?', 'Non, il est brut…']} textarea />

      <label className="grid gap-4 sm:grid-cols-2">
        <span className="block">
          <span className={label}>Auteur</span>
          <input value={f.author} onChange={(e) => set('author', e.target.value)} className={input} />
        </span>
        <span className="block">
          <span className={label}>Fonction / rubrique</span>
          <input value={f.author_role ?? ''} onChange={(e) => set('author_role', e.target.value)} className={input} />
        </span>
      </label>

      {err && <p className="text-xs text-down">{err}</p>}
      {msg && <p className="text-xs text-up">{msg}</p>}

      <button type="button" onClick={submit} disabled={pending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] disabled:opacity-40">
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <p className="text-[11px] text-faint">
        L&apos;enregistrement ne publie pas. Publiez depuis la liste des analyses.
      </p>
    </div>
  );
}

/** Éditeur de liste générique (sources / faq) — 2 champs par ligne. */
function ListEditor({
  label, items, onChange, fields, placeholder, textarea = false,
}: {
  label: string;
  items: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
  fields: [string, string];
  placeholder: [string, string];
  textarea?: boolean;
}) {
  const input = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50';
  const upd = (i: number, k: string, v: string) => {
    const next = [...items]; next[i] = { ...next[i], [k]: v }; onChange(next);
  };
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <span className="mb-2 block text-xs text-muted">{label}</span>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input value={it[fields[0]] ?? ''} onChange={(e) => upd(i, fields[0], e.target.value)} placeholder={placeholder[0]} className={input} />
            {textarea
              ? <textarea value={it[fields[1]] ?? ''} onChange={(e) => upd(i, fields[1], e.target.value)} placeholder={placeholder[1]} rows={2} className={input} />
              : <input value={it[fields[1]] ?? ''} onChange={(e) => upd(i, fields[1], e.target.value)} placeholder={placeholder[1]} className={input} />}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="rounded-lg border border-down/40 px-2 text-xs text-down hover:bg-down/10">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, { [fields[0]]: '', [fields[1]]: '' }])}
        className="mt-2 rounded-lg border border-border px-3 py-1 text-xs text-muted hover:text-ivory">+ Ajouter</button>
    </div>
  );
}

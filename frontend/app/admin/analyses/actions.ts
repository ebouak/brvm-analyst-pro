'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { uploadInlineImage } from '@/lib/server/storage';

type R = { ok: boolean; message?: string; slug?: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CitableInput {
  slug: string;
  kind: 'data' | 'editorial';
  data_source: string | null;
  title: string;
  question: string;
  short_answer: string;
  intro_md: string | null;
  commentary_md: string | null;
  methodology_md: string | null;
  sources: { label: string; url: string }[];
  faq: { q: string; a: string }[];
  hero_image_url: string | null;
  hero_image_alt: string | null;
  author: string;
  author_role: string | null;
}

/** Crée ou met à jour une page. Le slug est la clé : on upsert dessus. */
export async function savePage(input: CitableInput): Promise<R> {
  const ctx = await requirePermission('content.write');

  // Garde-fous : un slug malformé casserait l'URL publique ; les 3 champs GEO
  // essentiels (titre, question, réponse) sont obligatoires — sans eux la page
  // n'a aucune valeur de citation.
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return { ok: false, message: 'Slug invalide (minuscules, chiffres, tirets).' };
  if (!input.title.trim() || !input.question.trim() || !input.short_answer.trim()) {
    return { ok: false, message: 'Titre, question et réponse courte sont obligatoires.' };
  }
  if (input.kind === 'data' && !input.data_source) {
    return { ok: false, message: 'Une page « data » doit désigner une source de données.' };
  }

  const db = getServiceClient();
  const { error } = await db.from('citable_pages').upsert(
    {
      slug,
      kind: input.kind,
      data_source: input.kind === 'data' ? input.data_source : null,
      title: input.title.trim(),
      question: input.question.trim(),
      short_answer: input.short_answer.trim(),
      intro_md: input.intro_md || null,
      commentary_md: input.commentary_md || null,
      methodology_md: input.methodology_md || null,
      sources: input.sources ?? [],
      faq: input.faq ?? [],
      hero_image_url: input.hero_image_url || null,
      hero_image_alt: input.hero_image_alt || null,
      author: input.author.trim() || 'La rédaction WESTBOURSE',
      author_role: input.author_role || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug' },
  );
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, { action: 'citable.save', resourceType: 'citable_page', resourceId: slug, severity: 'info' });
  revalidatePath('/admin/analyses');
  revalidatePath(`/analyses/${slug}`);
  revalidatePath('/analyses');
  return { ok: true, slug };
}

/** Publie ou dépublie. Publier = rendre la page visible du public (RLS). */
export async function setPublished(slug: string, published: boolean): Promise<R> {
  const ctx = await requirePermission('content.publish');
  const db = getServiceClient();
  const { error } = await db
    .from('citable_pages')
    .update({ published, published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, {
    action: published ? 'citable.publish' : 'citable.unpublish',
    resourceType: 'citable_page',
    resourceId: slug,
    severity: 'info',
  });
  revalidatePath('/admin/analyses');
  revalidatePath(`/analyses/${slug}`);
  revalidatePath('/analyses');
  return { ok: true };
}

export async function deletePage(slug: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const db = getServiceClient();
  const { error } = await db.from('citable_pages').delete().eq('slug', slug);
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, { action: 'citable.delete', resourceType: 'citable_page', resourceId: slug, severity: 'warning' });
  revalidatePath('/admin/analyses');
  revalidatePath('/analyses');
  return { ok: true };
}

/** Upload d'une image (hero ou inline) → renvoie l'URL publique à coller dans le champ. */
export async function uploadImage(formData: FormData): Promise<{ ok: boolean; url?: string; message?: string }> {
  await requirePermission('content.write');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Aucun fichier.' };
  if (file.size > 3 * 1024 * 1024) return { ok: false, message: 'Image trop lourde (max 3 Mo).' };
  try {
    const url = await uploadInlineImage(file);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

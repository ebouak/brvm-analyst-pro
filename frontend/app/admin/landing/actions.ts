'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { validateUploads } from '@/lib/email/uploads';
import { MAX_SLIDES, MIN_PERMANENT } from '@/lib/landing/slides';

/**
 * Diapositives admin du hero de la landing (table landing_slides, 0134).
 * Toutes les écritures : permission content.publish + journal admin_audit_logs.
 * L'image part dans le bucket public `landing-slides` (service_role), après la
 * même liste blanche MIME que les uploads newsletter. Aucun redimensionnement
 * serveur ici (pas de `sharp` en route) : le format attendu est documenté dans
 * le formulaire (1 600 × 1 200, ≤ 5 Mo) et le poids est plafonné.
 */

type R = { ok: boolean; message?: string };
const BUCKET = 'landing-slides';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

function revalidate() {
  revalidatePath('/admin/landing');
  revalidatePath('/');
}

export async function createSlide(formData: FormData): Promise<R> {
  const ctx = await requirePermission('content.publish');
  const kind = String(formData.get('kind') ?? 'ad') === 'house' ? 'house' : 'ad';
  const title = String(formData.get('title') ?? '').trim();
  const subtitle = String(formData.get('subtitle') ?? '').trim() || null;
  const ctaLabel = String(formData.get('cta_label') ?? '').trim() || null;
  const linkUrl = String(formData.get('link_url') ?? '').trim() || null;
  const sponsor = String(formData.get('sponsor_name') ?? '').trim() || null;
  const startsAt = String(formData.get('starts_at') ?? '').trim();
  const endsAt = String(formData.get('ends_at') ?? '').trim();
  const position = Number(formData.get('position') ?? 100);
  const image = formData.get('image');

  if (title.length < 3 || title.length > 80) return { ok: false, message: 'Titre : 3 à 80 caractères.' };
  if (kind === 'ad' && !sponsor) return { ok: false, message: 'Une publicité doit nommer son annonceur.' };
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) return { ok: false, message: 'Le lien doit commencer par http(s)://.' };
  if (!(image instanceof File) || image.size === 0) return { ok: false, message: 'Image requise.' };
  const v = validateUploads([{ name: image.name, type: image.type, size: image.size }], { maxFiles: 1, maxTotalBytes: MAX_BYTES, maxFileBytes: MAX_BYTES, allowed: ALLOWED });
  if (!v.ok) return { ok: false, message: v.message };
  if (endsAt && startsAt && new Date(endsAt) <= new Date(startsAt)) return { ok: false, message: 'La fin doit être après le début.' };

  const db = getServiceClient();

  // Plafond utile : au-delà de MAX_SLIDES − MIN_PERMANENT vues admin actives,
  // la landing n'en montrera pas plus — on le dit plutôt que d'accepter en silence.
  const { count } = await db.from('landing_slides').select('id', { count: 'exact', head: true }).eq('is_active', true);
  if ((count ?? 0) >= MAX_SLIDES - MIN_PERMANENT) {
    return { ok: false, message: `Déjà ${count} vues actives : la landing n'en affiche que ${MAX_SLIDES - MIN_PERMANENT} au plus. Désactivez-en une d'abord.` };
  }

  const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await image.arrayBuffer());
  const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: image.type, upsert: false });
  if (up.error) return { ok: false, message: `Image refusée : ${up.error.message}` };

  const { data, error } = await db.from('landing_slides').insert({
    kind, title, subtitle, cta_label: ctaLabel, link_url: linkUrl, image_path: path, sponsor_name: kind === 'ad' ? sponsor : null,
    starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    position: Number.isFinite(position) ? position : 100,
    created_by: ctx.userId,
  }).select('id').single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    return { ok: false, message: `Enregistrement refusé : ${error.message}` };
  }
  await recordAudit(ctx, { action: 'landing.slide_create', resourceType: 'landing_slides', resourceId: data.id, severity: 'warning', metadata: { kind, title, sponsor, startsAt, endsAt, position } });
  revalidate();
  return { ok: true };
}

export async function toggleSlide(id: string, active: boolean): Promise<R> {
  const ctx = await requirePermission('content.publish');
  const db = getServiceClient();
  const { error } = await db.from('landing_slides').update({ is_active: active }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: active ? 'landing.slide_activate' : 'landing.slide_deactivate', resourceType: 'landing_slides', resourceId: id, severity: 'info' });
  revalidate();
  return { ok: true };
}

export async function deleteSlide(id: string): Promise<R> {
  const ctx = await requirePermission('content.publish');
  const db = getServiceClient();
  const { data } = await db.from('landing_slides').select('image_path, title').eq('id', id).maybeSingle();
  const { error } = await db.from('landing_slides').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  if (data?.image_path) await db.storage.from(BUCKET).remove([data.image_path]);
  await recordAudit(ctx, { action: 'landing.slide_delete', resourceType: 'landing_slides', resourceId: id, severity: 'warning', metadata: { title: data?.title ?? null } });
  revalidate();
  return { ok: true };
}

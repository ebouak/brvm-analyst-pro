// POST /api/avatar — upload de la photo de profil (déjà redimensionnée côté
// client). Stockée dans le bucket Supabase Storage public `newsletter-assets`
// (réutilisé) sous avatars/<userid>.<ext>, puis profiles.avatar_url mis à jour.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';
const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'newsletter-assets';

export async function POST(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image trop lourde (max 5 Mo)' }, { status: 400 });
  if (!OK_TYPES.includes(file.type)) return NextResponse.json({ error: 'Format non supporté (JPG/PNG/WebP)' }, { status: 400 });

  const admin = getServiceClient();
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `avatars/${user.id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Cache-buster pour forcer le rafraîchissement de l'image après remplacement.
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await admin.from('profiles')
    .upsert({ id: user.id, email: user.email, avatar_url: url, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, avatar_url: url });
}

import { getServiceClient } from '@/lib/billing/serviceClient';

const BUCKET = 'newsletter-assets';

/**
 * Upload une image dans le bucket public `newsletter-assets` (service-role) et
 * renvoie son URL publique. Lève en cas d'échec. Server-only.
 */
export async function uploadInlineImage(file: File): Promise<string> {
  const db = getServiceClient();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const month = new Date().toISOString().slice(0, 7);
  const path = `campaigns/${month}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'image/png', upsert: false });
  if (error) throw new Error(`upload image inline: ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

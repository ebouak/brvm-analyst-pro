import 'server-only';
import { codeSujetValide } from '@/lib/billing/chariow/regles';
import { getEntitlements } from '@/lib/server/entitlements';
import { getServiceClient } from '@/lib/billing/serviceClient';
import {
  evaluerAccesDossier,
  type AccesDossier,
  type DroitDossier,
} from './accesPur';

export type { AccesDossier } from './accesPur';

export async function accesDossier(code: string): Promise<AccesDossier> {
  const normalise = codeSujetValide(code);
  if (!normalise) return { complet: false, motif: 'verrouille' };

  const ent = await getEntitlements();
  if (ent.isPremium) return { complet: true, motif: 'premium' };
  if (!ent.userId) return { complet: false, motif: 'verrouille' };

  const { data, error } = await getServiceClient()
    .from('user_entitlements')
    .select('product_code, expires_at, revoked_at')
    .eq('user_id', ent.userId)
    .eq('product_code', `dossier:${normalise}`)
    .is('revoked_at', null)
    .limit(1);

  if (error) {
    console.error('[dossier/acces] droits illisibles —', error.code);
    return { complet: false, motif: 'indisponible' };
  }
  return evaluerAccesDossier(normalise, false, (data ?? []) as DroitDossier[]);
}

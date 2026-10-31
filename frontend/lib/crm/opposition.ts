/** Droit d'opposition (art. 21) — SERVEUR uniquement (service_role). */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { normaliserEmail } from './identite';

export type SourceOpposition = 'parametres' | 'lien' | 'admin';

export async function estOppose(email: string): Promise<boolean> {
  const { data } = await getServiceClient().from('crm_oppositions').select('email_norm').eq('email_norm', normaliserEmail(email)).maybeSingle();
  return data != null;
}

export async function enregistrerOpposition(email: string, source: SourceOpposition): Promise<boolean> {
  const emailNorm = normaliserEmail(email);
  if (!emailNorm) return false;
  const { error } = await getServiceClient().from('crm_oppositions').upsert({ email_norm: emailNorm, source }, { onConflict: 'email_norm', ignoreDuplicates: true });
  return !error;
}

export async function retirerOpposition(email: string): Promise<boolean> {
  const { error } = await getServiceClient().from('crm_oppositions').delete().eq('email_norm', normaliserEmail(email));
  return !error;
}

/** Droit d'opposition (art. 21) — SERVEUR uniquement (service_role). */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { normaliserEmail } from './identite';

export type SourceOpposition = 'parametres' | 'lien' | 'admin' | 'whatsapp';

/** Lève en cas d'erreur de lecture : le doute ne doit JAMAIS valoir « non opposé ». */
export async function estOppose(email: string): Promise<boolean> {
  const { data, error } = await getServiceClient().from('crm_oppositions').select('email_norm').eq('email_norm', normaliserEmail(email)).maybeSingle();
  if (error) throw new Error(`CRM : lecture des oppositions impossible (${error.message})`);
  return data != null;
}

export async function enregistrerOpposition(email: string, source: SourceOpposition): Promise<boolean> {
  const emailNorm = normaliserEmail(email);
  if (!emailNorm) return false;
  const { error } = await getServiceClient().from('crm_oppositions').upsert({ email_norm: emailNorm, source }, { onConflict: 'email_norm', ignoreDuplicates: true });
  return !error;
}

export async function retirerOpposition(email: string): Promise<boolean> {
  const emailNorm = normaliserEmail(email);
  if (!emailNorm) return false;
  const { error } = await getServiceClient().from('crm_oppositions').delete().eq('email_norm', emailNorm);
  return !error;
}

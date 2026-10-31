'use server';
import { redirect } from 'next/navigation';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { enregistrerOpposition } from '@/lib/crm/opposition';

/**
 * Confirmée par un BOUTON : un scanner de liens qui ouvre l'URL ne doit pas
 * opposer la personne à sa place. Jeton inconnu : même réponse (pas d'oracle).
 */
export async function confirmerOpposition(formData: FormData): Promise<void> {
  const jeton = String(formData.get('t') ?? '');
  if (/^[a-f0-9]{48}$/.test(jeton)) {
    const { data } = await getServiceClient().from('crm_actions').select('email_norm').eq('jeton_opposition', jeton).maybeSingle();
    if (data?.email_norm) await enregistrerOpposition(data.email_norm, 'lien');
  }
  redirect('/crm/opposition?fait=1');
}

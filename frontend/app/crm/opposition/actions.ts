'use server';
import { redirect } from 'next/navigation';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { enregistrerOpposition } from '@/lib/crm/opposition';

/**
 * Confirmée par un BOUTON : un scanner de liens qui ouvre l'URL ne doit pas
 * opposer la personne à sa place. Jeton mal formé ou inconnu : même réponse que
 * le succès (pas d'oracle). Seule une panne d'infrastructure diffère : on ne dit
 * jamais « c'est noté » quand rien n'a été enregistré.
 */
export async function confirmerOpposition(formData: FormData): Promise<void> {
  const jeton = String(formData.get('t') ?? '');
  let echec = false;
  if (/^[a-f0-9]{48}$/.test(jeton)) {
    const { data, error } = await getServiceClient().from('crm_actions').select('email_norm').eq('jeton_opposition', jeton).maybeSingle();
    if (error) {
      echec = true;
    } else if (data?.email_norm) {
      echec = !(await enregistrerOpposition(data.email_norm, 'lien'));
    }
  }
  if (echec) {
    console.error('crm_opposition : enregistrement impossible');
    redirect(`/crm/opposition?erreur=1&t=${encodeURIComponent(jeton)}`);
  }
  redirect('/crm/opposition?fait=1');
}

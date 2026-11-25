'use server';
import { redirect } from 'next/navigation';
import { arreterRappelsAcademy } from '@/lib/academy/arretRappels';

/**
 * Confirmée par un BOUTON : un scanner de liens qui ouvre l'URL ne doit pas
 * arrêter les rappels à la place de la personne. On ne dit jamais « c'est
 * noté » quand rien n'a été enregistré (jeton inconnu ou panne).
 */
export async function confirmerArretRappels(formData: FormData): Promise<void> {
  const t = String(formData.get('t') ?? '');
  const issue = await arreterRappelsAcademy(t);
  if (issue === 'fait') redirect('/academy/rappels/arret?fait=1');
  if (issue === 'inconnu') redirect('/academy/rappels/arret?inconnu=1');
  redirect(`/academy/rappels/arret?erreur=1&t=${encodeURIComponent(t)}`);
}

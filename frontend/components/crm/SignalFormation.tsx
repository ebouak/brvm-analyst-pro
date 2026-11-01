'use client';
import { usePathname } from 'next/navigation';
import SignalOffre from './SignalOffre';
import { estPageFormation } from '@/lib/crm/signal';

/**
 * Balise « a consulté la formation », montée UNE fois dans le layout de l'Academy.
 * Le chemin vient du routeur (sans paramètres de requête) ; les pages hors motif
 * (examen, certificat) ne déclenchent rien. Le serveur revalide et ignore les anonymes.
 */
export default function SignalFormation() {
  const pathname = usePathname();
  if (!estPageFormation(pathname)) return null;
  return <SignalOffre page={pathname} />;
}

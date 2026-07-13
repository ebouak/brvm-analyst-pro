import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VerifyForm } from './VerifyForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vérification en deux étapes' };

/**
 * Challenge du second facteur. Comme /account/security, cette page n'exige QUE
 * l'authentification simple : c'est ici qu'on envoie un admin en aal1 pour qu'il
 * s'élève. L'y soumettre à la garde admin créerait une boucle de redirection.
 */
export default async function VerifyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      {/* useSearchParams impose une frontière Suspense. */}
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}

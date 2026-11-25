import Link from 'next/link';
import { confirmerArretRappels } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Arrêter les rappels Academy', robots: { index: false } };

export default async function Page(props: {
  searchParams: Promise<{ t?: string; fait?: string; inconnu?: string; erreur?: string }>;
}) {
  const sp = await props.searchParams;
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold text-ivory">Arrêter les rappels Academy</h1>
      {sp.fait ? (
        <p className="mt-4 text-muted">
          C&apos;est noté : vous ne recevrez plus de rappel de progression WESTBOURSE Academy. Vous pouvez les
          réactiver à tout moment dans{' '}
          <Link href="/parametres/alertes" className="text-accent underline">
            vos préférences
          </Link>
          .
        </p>
      ) : sp.inconnu ? (
        <p className="mt-4 text-muted">
          Ce lien n&apos;est plus valide. Connectez-vous et décochez « Rappels de progression » dans{' '}
          <Link href="/parametres/alertes" className="text-accent underline">
            vos préférences
          </Link>
          .
        </p>
      ) : (
        <form action={confirmerArretRappels} className="mt-6">
          <input type="hidden" name="t" value={sp.t ?? ''} />
          {sp.erreur && (
            <p role="alert" className="mb-4 text-down">
              L&apos;enregistrement n&apos;a pas pu aboutir. Réessayez dans un instant.
            </p>
          )}
          <p className="text-muted">
            Confirmez pour ne plus recevoir les e-mails qui vous rappellent la leçon suivante de votre parcours.
          </p>
          <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-2.5 font-semibold text-bg">
            Confirmer
          </button>
        </form>
      )}
    </div>
  );
}

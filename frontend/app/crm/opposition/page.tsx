import { confirmerOpposition } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ne plus recevoir de proposition', robots: { index: false } };

export default function Page({ searchParams }: { searchParams: { t?: string; fait?: string; erreur?: string } }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold text-ivory">Ne plus recevoir de proposition</h1>
      {searchParams.fait ? (
        <p className="mt-4 text-muted">C&apos;est noté : WESTBOURSE ne vous adressera plus de proposition commerciale fondée sur votre activité.</p>
      ) : (
        <form action={confirmerOpposition} className="mt-6">
          <input type="hidden" name="t" value={searchParams.t ?? ''} />
          {searchParams.erreur && (
            <p role="alert" className="mb-4 text-down">L&apos;enregistrement n&apos;a pas pu aboutir. Réessayez dans un instant.</p>
          )}
          <p className="text-muted">Confirmez pour ne plus recevoir de proposition commerciale de WESTBOURSE.</p>
          <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-2.5 font-semibold text-bg">Confirmer</button>
        </form>
      )}
    </div>
  );
}

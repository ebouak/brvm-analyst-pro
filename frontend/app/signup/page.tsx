import Link from 'next/link';
import { signup } from '../login/actions';

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        action={signup}
        className="w-full max-w-sm bg-surface border border-border rounded-xl p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold">Créer un compte</h1>
        {searchParams.error && (
          <p className="text-sm text-down">{searchParams.error}</p>
        )}
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Mot de passe (min. 6 caractères)"
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full bg-up/90 hover:bg-up text-black font-medium rounded px-3 py-2 text-sm"
        >
          Créer le compte
        </button>
        <p className="text-xs text-muted text-center">
          Déjà inscrit ?{' '}
          <Link href="/login" className="text-up underline">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}

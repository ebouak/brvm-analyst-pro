import Link from 'next/link';
import { login } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        action={login}
        className="w-full max-w-sm bg-surface border border-border rounded-xl p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold">BRVM Analyst Pro</h1>
        <p className="text-sm text-muted">Connexion à votre espace.</p>
        {searchParams.message && (
          <p className="text-sm text-up">{searchParams.message}</p>
        )}
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
          placeholder="Mot de passe"
          className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full bg-up/90 hover:bg-up text-black font-medium rounded px-3 py-2 text-sm"
        >
          Se connecter
        </button>
        <p className="text-xs text-muted text-center">
          Pas de compte ?{' '}
          <Link href="/signup" className="text-up underline">
            Créer un compte
          </Link>
        </p>
      </form>
    </div>
  );
}

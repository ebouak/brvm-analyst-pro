import Link from 'next/link';
import { login } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div className="min-h-screen grid place-items-center bg-bg p-4">
      {/* Halo arrière-plan */}
      <div className="pointer-events-none fixed inset-0 bg-obsidian-glow" aria-hidden />

      <div className="relative w-full max-w-sm">
        {/* Double-bezel outer */}
        <div className="rounded-panel border border-gold/20 bg-gold/[0.03] p-1.5 shadow-gold">
          {/* Double-bezel inner */}
          <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface border border-border shadow-panel p-8 space-y-6">

            {/* Logo double-bezel */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-14 w-14">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-xl border border-gold/30 bg-gradient-to-b from-gold/15 to-gold/5" />
                {/* Inner ring */}
                <div className="absolute inset-1 rounded-lg border border-gold/20 bg-bg/80 grid place-items-center">
                  <span className="font-display text-2xl font-bold text-gold leading-none select-none">B</span>
                </div>
              </div>
              <div className="text-center">
                <h1 className="font-display text-xl font-semibold text-ivory tracking-tight">
                  BRVM Analyst Pro
                </h1>
                <p className="mt-1 text-xs text-faint">Maison de marché premium africaine</p>
              </div>
            </div>

            {/* Séparateur or */}
            <div className="gold-rule" />

            {/* Messages */}
            {searchParams.message && (
              <div className="rounded-lg border border-up/30 bg-up/10 px-3 py-2">
                <p className="text-xs text-up">{searchParams.message}</p>
              </div>
            )}
            {searchParams.error && (
              <div className="rounded-lg border border-down/30 bg-down/10 px-3 py-2">
                <p className="text-xs text-down">{searchParams.error}</p>
              </div>
            )}

            {/* Formulaire */}
            <form action={login} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="overline text-faint block"
                >
                  Adresse e-mail
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  placeholder="vous@exemple.com"
                  className="w-full bg-sunken border border-border rounded-lg px-3 py-2.5 text-sm text-ivory placeholder:text-faint/60 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="overline text-faint block"
                >
                  Mot de passe
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-sunken border border-border rounded-lg px-3 py-2.5 text-sm text-ivory placeholder:text-faint/60 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gold text-obsidian font-semibold rounded-xl px-4 py-2.5 text-sm shadow-gold transition-all duration-200 hover:bg-gold-soft active:scale-95 mt-2"
              >
                Se connecter
              </button>
            </form>

            <p className="text-xs text-faint text-center">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="text-gold hover:underline">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

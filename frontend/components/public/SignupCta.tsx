import Link from 'next/link';

/**
 * Bloc de conversion des pages vitrine (SEO/GEO) : le lecteur arrivé de Google
 * ou d'une IA voit la valeur qu'il débloque en créant un compte. À placer en fin
 * de page de contenu public. Compte gratuit, sans carte bancaire.
 */
export default function SignupCta({
  titre = 'Passez de la lecture à la décision',
  sousTitre = 'Vous lisez la version publique. Le compte gratuit débloque l’outil complet.',
}: {
  titre?: string;
  sousTitre?: string;
}) {
  return (
    <section className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/[0.07] to-surface p-6 md:p-8">
      <h2 className="font-display text-xl md:text-2xl text-white">{titre}</h2>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">{sousTitre}</p>

      <ul className="mt-4 grid gap-2 text-sm text-ivory sm:grid-cols-2">
        {[
          'Signaux quotidiens BUY/SELL notés',
          'Fiches complètes : ratios, valorisation, analyse',
          'Simulateur d’investissement et portefeuille suivi',
          'Alertes de cours et de dividende',
        ].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-accent">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-gold-2 active:scale-95"
        >
          Créer un compte gratuit
        </Link>
        <Link href="/login" className="text-sm text-muted transition-colors hover:text-white">
          J’ai déjà un compte
        </Link>
        <span className="text-xs text-faint">Gratuit · sans carte bancaire · en 30 secondes</span>
      </div>
    </section>
  );
}

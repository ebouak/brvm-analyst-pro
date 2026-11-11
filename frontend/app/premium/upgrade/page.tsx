import Link from 'next/link';
import SignalOffre from '@/components/crm/SignalOffre';
import { fromSur, urlFormules } from '@/lib/auth/urlsAcces';
import { libellePage } from '@/lib/nav';

export default async function UpgradePage(props: { searchParams: Promise<{ from?: string }> }) {
  // Page demandée : toujours assainie (chemin interne seulement).
  const from = fromSur((await props.searchParams).from);
  const libelle = libellePage(from);
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <SignalOffre page="/premium/upgrade" />
      <div className="text-center mb-10">
        <span className="inline-block px-3 py-1 rounded-full bg-warn/10 text-warn text-xs font-semibold mb-4">
          Premium
        </span>
        <h1 className="text-3xl font-bold text-white mb-3">Accès Premium BRVM</h1>
        <p className="text-muted text-sm leading-relaxed max-w-lg mx-auto">
          Débloquez les outils d'analyse avancée réservés aux investisseurs professionnels sur la BRVM.
        </p>
      </div>

      <div className="grid gap-4 mb-10">
        {[
          { title: 'Classements multi-critères', desc: 'PBR, PER, marge nette, liquidité, performance, volatilité, rotation · 9 classements actualisés.' },
          { title: 'Calendrier des dates clés', desc: 'Dates de publication des états financiers, annonces et versements de dividendes, Assemblées Générales.' },
          { title: 'Détection d\'anomalies', desc: '4 analyses visuelles : scatter dividendes, liquidité/volatilité, heatmap 20 séances, marge vs croissance.' },
        ].map((f) => (
          <div key={f.title} className="flex gap-4 p-4 bg-surface border border-border rounded-xl">
            <div>
              <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
              <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-sm text-muted mb-4">
          {from
            ? `Vous avez demandé ${libelle ? `la page « ${libelle} »` : 'une page'}, réservée aux abonnés Premium.`
            : 'Cette page est réservée aux abonnés Premium.'}{' '}
          Vous pouvez souscrire vous-même, en ligne ; l’accès s’ouvre à la confirmation du paiement.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={urlFormules(from)}
            className="inline-flex min-h-[44px] items-center px-6 bg-accent text-bg rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Voir les formules
          </Link>
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center px-6 border border-border rounded-xl text-sm text-ivory hover:border-accent/50 hover:text-accent transition-colors"
          >
            Comparer les tarifs
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center px-6 text-sm text-muted hover:text-ivory transition-colors"
          >
            Retour au tableau de bord
          </Link>
        </div>
        <p className="mt-5 text-xs text-faint">
          Une question ? Écrivez à{' '}
          <span className="text-ivory select-all">support@westbourse.com</span>.
        </p>
      </div>
    </div>
  );
}

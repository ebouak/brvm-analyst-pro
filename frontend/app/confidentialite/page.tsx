import Link from 'next/link';

export const metadata = { title: 'Politique de confidentialité' };

export default function ConfidentialitePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Politique de confidentialité</h1>

      <p className="text-sm text-muted">
        BRVM Analyst Pro respecte les principes de la réglementation UEMOA sur
        la protection des données personnelles et les bonnes pratiques RGPD.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Données collectées</h2>
        <ul className="text-sm text-muted list-disc pl-5 space-y-1">
          <li>Adresse e-mail (création de compte)</li>
          <li>Watchlists et positions de portefeuille (saisies par vous)</li>
          <li>Alertes configurées et journal des notifications envoyées</li>
          <li>Identifiants techniques (id utilisateur Supabase, horodatages)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Finalités</h2>
        <p className="text-sm text-muted">
          Vos données servent exclusivement à fournir le service : gestion de
          votre compte, suivi de vos positions, notifications d'alertes,
          journalisation pour audit. Aucune revente. Aucun marketing tiers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Conservation</h2>
        <p className="text-sm text-muted">
          Données de compte conservées tant que votre compte est actif. Données
          transactionnelles simulées : 5 ans maximum. Journal des notifications
          : 12 mois glissants.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Vos droits</h2>
        <p className="text-sm text-muted">
          Vous disposez d'un droit d'accès, de rectification et de suppression.
          Vous pouvez exercer ces droits depuis la page{' '}
          <Link href="/parametres/compte" className="text-up underline">
            Paramètres / Compte
          </Link>{' '}
          : export JSON de toutes vos données, ou suppression définitive
          (cascade RLS).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Sécurité</h2>
        <p className="text-sm text-muted">
          L'isolation des données entre utilisateurs est garantie par Row Level
          Security (RLS) PostgreSQL. Les secrets serveur ne sont jamais exposés
          au navigateur.
        </p>
      </section>
    </div>
  );
}

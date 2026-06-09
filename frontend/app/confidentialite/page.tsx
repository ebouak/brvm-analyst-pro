import Link from 'next/link';
import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Politique de confidentialité' };

function GoldRule() {
  return <hr className="gold-rule" />;
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-base font-semibold text-ivory">{title}</h2>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function ConfidentialitePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

      <SectionHeader
        kicker="Protection des données"
        title="Politique de confidentialité"
        subtitle="BRVM Analyst Pro respecte les principes de la réglementation UEMOA sur la protection des données personnelles et les bonnes pratiques RGPD."
      />

      <GoldRule />

      <LegalSection title="Données collectées">
        <ul className="space-y-1.5 pl-4 list-none">
          {[
            'Adresse e-mail (création de compte)',
            'Watchlists et positions de portefeuille (saisies par vous)',
            'Alertes configurées et journal des notifications envoyées',
            'Identifiants techniques (id utilisateur Supabase, horodatages)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-gold/50 text-xs">◆</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <GoldRule />

      <LegalSection title="Finalités">
        <p>
          Vos données servent exclusivement à fournir le service : gestion de
          votre compte, suivi de vos positions, notifications d'alertes,
          journalisation pour audit.
        </p>
        <p className="mt-2 font-medium text-ivory/80">
          Aucune revente. Aucun marketing tiers.
        </p>
      </LegalSection>

      <GoldRule />

      <LegalSection title="Conservation">
        <p>
          Données de compte conservées tant que votre compte est actif. Données
          transactionnelles simulées : 5 ans maximum. Journal des notifications :
          12 mois glissants.
        </p>
      </LegalSection>

      <GoldRule />

      <LegalSection title="Vos droits">
        <p>
          Vous disposez d'un droit d'accès, de rectification et de suppression.
          Vous pouvez exercer ces droits depuis la page{' '}
          <Link
            href="/parametres/compte"
            className="text-gold/80 underline underline-offset-2 hover:text-gold transition-colors"
          >
            Paramètres / Compte
          </Link>{' '}
          : export JSON de toutes vos données, ou suppression définitive (cascade RLS).
        </p>
      </LegalSection>

      <GoldRule />

      <LegalSection title="Sécurité">
        <p>
          L'isolation des données entre utilisateurs est garantie par Row Level
          Security (RLS) PostgreSQL. Les secrets serveur ne sont jamais exposés
          au navigateur.
        </p>
      </LegalSection>

    </div>
  );
}

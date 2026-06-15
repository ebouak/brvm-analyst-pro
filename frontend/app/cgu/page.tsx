import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { Placeholder } from '@/components/legal/Placeholder';
import { FINANCIAL_DISCLAIMER } from '@/lib/legal/disclaimer';

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

export default function CguPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation" updatedAt="2026-06-15">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
        <p className="text-amber-200">
          <strong>Avertissement important.</strong> {FINANCIAL_DISCLAIMER}
        </p>
      </div>

      <section>
        <h2>1. Objet</h2>
        <p>
          Les présentes conditions générales d&apos;utilisation (« CGU ») régissent l&apos;accès et
          l&apos;utilisation du service BRVM Analyst Pro (« le Service »), édité par{' '}
          <Placeholder>raison sociale</Placeholder>. En utilisant le Service, l&apos;utilisateur
          accepte sans réserve les présentes CGU.
        </p>
      </section>

      <section>
        <h2>2. Accès au Service et inscription</h2>
        <p>
          Le Service est accessible en partie gratuitement. Certaines fonctionnalités
          nécessitent la création d&apos;un compte via une adresse e-mail (connexion par code à
          usage unique ou via un fournisseur d&apos;identité tiers). L&apos;utilisateur s&apos;engage à
          fournir des informations exactes.
        </p>
      </section>

      <section>
        <h2>3. Compte utilisateur</h2>
        <p>
          L&apos;utilisateur est responsable de la confidentialité de l&apos;accès à son compte et de
          toute activité réalisée depuis celui-ci. Il peut demander la suppression de son
          compte à tout moment.
        </p>
      </section>

      <section>
        <h2>4. Abonnement premium</h2>
        <p>
          Le Service propose une offre payante « Premium » donnant accès à des
          fonctionnalités avancées. Le prix applicable est de{' '}
          <Placeholder>prix de l&apos;abonnement</Placeholder>, payable selon la périodicité
          indiquée lors de la souscription.
        </p>
        <ul>
          <li>Le paiement s&apos;effectue via le prestataire <Placeholder>prestataire de paiement</Placeholder>.</li>
          <li>L&apos;abonnement est reconduit automatiquement, sauf résiliation avant l&apos;échéance.</li>
          <li>La résiliation s&apos;effectue depuis l&apos;espace compte ; elle prend effet à la fin de la période en cours.</li>
          <li>Les conditions de remboursement sont précisées au moment de l&apos;achat : <Placeholder>politique de remboursement</Placeholder>.</li>
        </ul>
      </section>

      <section>
        <h2>5. Disponibilité et maintenance</h2>
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer la disponibilité du Service sans pouvoir la garantir
          de manière continue. Des interruptions pour maintenance ou cas de force majeure
          peuvent survenir.
        </p>
      </section>

      <section>
        <h2>6. Avertissement sur les risques d&apos;investissement</h2>
        <p>
          Les analyses, notes (A–F), signaux, scores, simulations et contenus du Service sont
          fournis à titre purement informatif et pédagogique. <strong>Ils ne constituent en
          aucun cas un conseil en investissement, une recommandation personnalisée, une
          sollicitation ou une offre d&apos;achat ou de vente d&apos;instruments financiers.</strong>{' '}
          Les performances passées ne préjugent pas des performances futures. Tout
          investissement comporte un risque de perte en capital. L&apos;utilisateur reste seul
          responsable de ses décisions et est invité à consulter un conseiller agréé.
        </p>
      </section>

      <section>
        <h2>7. Responsabilité</h2>
        <p>
          L&apos;éditeur ne saurait être tenu responsable des pertes ou dommages résultant de
          l&apos;utilisation du Service, de l&apos;inexactitude ou de l&apos;indisponibilité des données, ni
          des décisions prises sur la base des contenus fournis.
        </p>
      </section>

      <section>
        <h2>8. Données personnelles</h2>
        <p>
          Le traitement des données personnelles est décrit dans notre{' '}
          <Link href="/confidentialite">Politique de confidentialité</Link>.
        </p>
      </section>

      <section>
        <h2>9. Propriété intellectuelle</h2>
        <p>
          Tous les éléments du Service sont protégés. Toute reproduction non autorisée est
          interdite.
        </p>
      </section>

      <section>
        <h2>10. Droit applicable et juridiction</h2>
        <p>
          Les présentes CGU sont régies par le droit en vigueur en{' '}
          <strong>République de Côte d&apos;Ivoire</strong> et par les actes uniformes de l&apos;OHADA.
          En cas de litige, et à défaut de résolution amiable préalable, compétence est
          attribuée aux <strong>tribunaux compétents d&apos;Abidjan</strong>.
        </p>
      </section>
    </LegalPage>
  );
}

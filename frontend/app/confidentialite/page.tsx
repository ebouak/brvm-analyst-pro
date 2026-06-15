import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { Placeholder } from '@/components/legal/Placeholder';
import { CONSENT_CATEGORIES } from '@/lib/consent/registry';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="2026-06-15">
      <section>
        <h2>Responsable de traitement</h2>
        <p>
          Le responsable du traitement des données est <Placeholder>raison sociale</Placeholder>,
          joignable à l&apos;adresse <Placeholder>email de contact</Placeholder>.
        </p>
      </section>

      <section>
        <h2>Données collectées</h2>
        <ul>
          <li><strong>Compte</strong> : adresse e-mail, identifiant de session.</li>
          <li><strong>Usage</strong> : watchlist, portefeuille, simulations de paper-trading, préférences.</li>
          <li><strong>Newsletter</strong> : adresse e-mail, si vous y consentez.</li>
        </ul>
      </section>

      <section>
        <h2>Finalités et base légale</h2>
        <ul>
          <li>Fourniture du service et gestion du compte — exécution du contrat.</li>
          <li>Envoi de la newsletter — consentement.</li>
          <li>Sécurité et prévention de la fraude — intérêt légitime.</li>
        </ul>
      </section>

      <section>
        <h2>Durées de conservation</h2>
        <p>
          Les données de compte sont conservées tant que le compte est actif, puis supprimées
          ou anonymisées dans un délai raisonnable après sa fermeture. Les données de
          newsletter sont conservées jusqu&apos;au désabonnement.
        </p>
      </section>

      <section>
        <h2>Destinataires et sous-traitants</h2>
        <ul>
          <li><strong>Supabase</strong> — hébergement base de données et authentification.</li>
          <li><strong>Vercel</strong> — hébergement de l&apos;application.</li>
          <li><strong>Resend</strong> — envoi des e-mails transactionnels et newsletter.</li>
        </ul>
        <p>Certains prestataires peuvent traiter des données hors UEMOA, avec les garanties appropriées.</p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Conformément à la réglementation applicable, vous disposez d&apos;un droit d&apos;accès, de
          rectification, d&apos;effacement, d&apos;opposition, de limitation et de portabilité. Pour les
          exercer, écrivez à <Placeholder>email de contact</Placeholder>.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>Le site utilise les catégories de cookies suivantes :</p>
        <ul>
          {CONSENT_CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <strong>{cat.label}</strong> — {cat.description}
              {cat.cookies.length > 0 && (
                <> {' '}({cat.cookies.map((c) => c.name).join(', ')})</>
              )}
            </li>
          ))}
        </ul>
        <p>Vous pouvez modifier vos choix à tout moment via le lien « Gérer mes cookies » en pied de page.</p>
      </section>
    </LegalPage>
  );
}

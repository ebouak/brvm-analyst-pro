import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { Placeholder } from '@/components/legal/Placeholder';
import { CONSENT_CATEGORIES } from '@/lib/consent/registry';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="2026-10-21">
      <section>
        <h2>Responsable de traitement</h2>
        <p>
          Le responsable du traitement des données est <Placeholder>raison sociale</Placeholder>,
          joignable à l&apos;adresse support@westbourse.com.
        </p>
      </section>

      <section>
        <h2>Données collectées</h2>
        <ul>
          <li><strong>Compte</strong> : adresse e-mail, identifiant de session.</li>
          <li><strong>Usage</strong> : watchlist, portefeuille, simulations de paper-trading, préférences.</li>
          <li><strong>Newsletter</strong> : adresse e-mail, si vous y consentez.</li>
          <li>
            <strong>Formulaire de contact</strong> : prénom, adresse e-mail, page d&apos;où le message
            est envoyé et contenu du message, ainsi que la réponse qui vous est adressée.
          </li>
          <li>
            <strong>Messages WhatsApp</strong> envoyés au numéro WESTBOURSE : numéro (ou identifiant WhatsApp),
            nom affiché, contenu du message et réponse adressée.
          </li>
          <li>
            <strong>Relation commerciale</strong> : pages de l&apos;offre Premium consultées en étant connecté,
            messages que nous vous adressons pour vous la proposer, et notes internes associées.
          </li>
        </ul>
      </section>

      <section>
        <h2>Finalités et base légale</h2>
        <ul>
          <li>Fourniture du service et gestion du compte : exécution du contrat.</li>
          <li>Envoi de la newsletter : consentement.</li>
          <li>
            Réponse aux messages du formulaire de contact : mesures précontractuelles et intérêt
            légitime à répondre à une demande que vous nous adressez.
          </li>
          <li>
            Vous proposer l&apos;offre Premium lorsque votre activité montre un intérêt (paiement commencé,
            offre consultée…) : intérêt légitime. Une personne de WESTBOURSE décide de chaque message ;
            vous pouvez vous y opposer à tout moment (lien en pied de chaque message, ou Paramètres → Compte). Pour les personnes ayant rempli le
            formulaire de contact sans compte : consentement.
          </li>
          <li>Sécurité et prévention de la fraude : intérêt légitime.</li>
        </ul>
      </section>

      <section>
        <h2>Durées de conservation</h2>
        <p>
          Les données de compte sont conservées tant que le compte est actif, puis supprimées
          ou anonymisées dans un délai raisonnable après sa fermeture. Les données de
          newsletter sont conservées jusqu&apos;au désabonnement. Les messages du formulaire de
          contact et nos réponses — y compris les messages WhatsApp — sont conservés 12 mois après le
          dernier échange, puis supprimés automatiquement. Les consultations de l&apos;offre sont conservées 90 jours,
          nos messages de proposition et les notes associées 24 mois.
        </p>
      </section>

      <section>
        <h2>Destinataires et sous-traitants</h2>
        <ul>
          <li><strong>Supabase</strong> — hébergement base de données et authentification.</li>
          <li><strong>Vercel</strong> — hébergement de l&apos;application.</li>
          <li><strong>Resend</strong> — envoi des e-mails transactionnels et newsletter.</li>
          <li>
            <strong>Cloudflare</strong> — acheminement des e-mails adressés à support@westbourse.com.
          </li>
          <li>
            <strong>Hetzner</strong> (Allemagne) — hébergement du serveur qui relie le numéro WhatsApp
            WESTBOURSE au site.
          </li>
          <li>
            <strong>Fournisseurs d&apos;IA (DeepSeek, Google Gemini, xAI)</strong> — rédaction d&apos;un
            brouillon de réponse à votre message, relu et corrigé par un membre de l&apos;équipe avant
            tout envoi. Seuls votre prénom et votre message leur sont transmis, jamais votre adresse
            e-mail.
          </li>
        </ul>
        <p>Certains prestataires peuvent traiter des données hors UEMOA, avec les garanties appropriées.</p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Conformément à la réglementation applicable, vous disposez d&apos;un droit d&apos;accès, de
          rectification, d&apos;effacement, d&apos;opposition, de limitation et de portabilité. Pour les
          exercer, écrivez à support@westbourse.com.
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

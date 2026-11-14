import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { CONSENT_CATEGORIES } from '@/lib/consent/registry';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="2026-11-11">
      <section>
        <h2>Responsable de traitement</h2>
        <p>
          Le responsable du traitement des données est Build Outsourcing SARL, société de droit ivoirien,
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
            nom affiché, contenu des messages et des notes vocales transcrites, réponses adressées. L&apos;audio
            des notes vocales n&apos;est pas conservé.
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
            offre ou formation consultée, pays de connexion — nous ne conservons que le code du pays, ni adresse IP ni ville…) : intérêt légitime. Une personne de WESTBOURSE décide de chaque message ;
            vous pouvez vous y opposer à tout moment (lien en pied de chaque message, ou Paramètres → Compte). Pour les personnes ayant rempli le
            formulaire de contact sans compte : consentement.
          </li>
          <li>
            Recontact sur WhatsApp : si vous indiquez un numéro WhatsApp et cochez la case prévue, WESTBOURSE peut vous recontacter sur WhatsApp au sujet de son offre (consentement). C&apos;est facultatif ; vous pouvez le retirer à tout moment dans Paramètres → Alertes, ou en répondant STOP.
          </li>
          <li>
            Réponses de l&apos;assistant WhatsApp aux questions que vous lui adressez : mesures précontractuelles et
            intérêt légitime à répondre à votre demande. Tapez EFFACER pour effacer l&apos;historique de la conversation.
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
          dernier échange, puis supprimés automatiquement. L&apos;historique d&apos;une conversation avec l&apos;assistant
          WhatsApp est conservé 30 jours si elle n&apos;est liée à aucun compte, 90 jours sinon. Les consultations de l&apos;offre sont conservées 90 jours,
          nos messages de proposition et les notes associées 24 mois. Si vous vous êtes opposé aux propositions
          commerciales, nous conservons seulement votre adresse et la date de ce refus, même après la suppression
          de votre compte, pour ne plus jamais vous en adresser.
        </p>
        <p>Récapitulatif par traitement :</p>
        <ul>
          <li>Compte, watchlists, portefeuille, alertes, rapports sauvegardés, paper-trading : durée de vie du compte.</li>
          <li>Newsletter : jusqu&apos;au désabonnement ; adresse non confirmée : 30 jours après le dernier e-mail de confirmation.</li>
          <li>Journal d&apos;envoi des notifications, journal de sécurité de l&apos;authentification, journal d&apos;audit de l&apos;administration (adresse IP et navigateur de l&apos;administrateur) : 12 mois.</li>
          <li>Messages du formulaire de contact et réponses : 12 mois après le dernier échange.</li>
          <li>Conversations WhatsApp et Telegram avec l&apos;assistant : 90 jours (30 jours si elles ne sont liées à aucun compte) ; codes d&apos;appairage : supprimés un jour après leur expiration.</li>
          <li>Envois de dossiers par e-mail ou messagerie : 90 jours.</li>
          <li>Relation commerciale : consultations 90 jours, messages de proposition et notes 24 mois ; liste d&apos;opposition : conservée.</li>
          <li>Sessions d&apos;examen de l&apos;Academy : 7 jours. Certificats : jusqu&apos;à leur révocation ou la suppression du compte.</li>
          <li>Recherche en langage naturel : empreinte 24 heures ; compteurs de quota 30 jours ; décisions d&apos;aiguillage WhatsApp 90 jours.</li>
          <li>Notifications d&apos;événements de paiement reçues des prestataires : 12 mois.</li>
          <li>Justificatifs de paiement : conservés, anonymisés à la suppression du compte, pour l&apos;obligation comptable légale (durée légale applicable).</li>
          <li>Mesure d&apos;audience (PostHog) : durée de conservation fixée par les conditions du prestataire.</li>
          <li>Rapports d&apos;erreurs (Sentry) : durée de conservation fixée par les conditions du prestataire.</li>
        </ul>
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
            e-mail. Ils rédigent aussi les réponses de l&apos;assistant WhatsApp à partir du texte de vos messages,
            adresses e-mail et numéros de téléphone masqués ; les notes vocales sont transcrites par Google Gemini.
          </li>
          <li>
            <strong>TypeSafe (Jev)</strong> — classement des sociétés pour la recherche en langage naturel
            réservée aux comptes connectés. Seul le texte de votre recherche lui est transmis, sans votre
            identité ; nous ne conservons qu&apos;une empreinte de la recherche, 24 heures, sans lien avec
            votre compte. Il classe aussi les messages libres reçus sur WhatsApp, pour y répondre par la
            donnée exacte : seul le texte du message lui est transmis, jamais votre numéro, et aucun message
            contenant une adresse e-mail ou un numéro de téléphone ne lui est envoyé.
          </li>
          <li>
            <strong>Mistral AI</strong> (France) — lecture des relevés que vous importez, en repli, et
            transcription de documents publics (voir ci-dessous).
          </li>
          <li>
            <strong>PostHog</strong> (hébergement dans l&apos;Union européenne) — mesure d&apos;audience, chargée
            uniquement après votre accord ; pour une personne connectée ayant consenti, la session est
            rattachée à son identifiant de compte et à son adresse e-mail.
          </li>
          <li>
            <strong>Sentry</strong> (collecte hébergée en Allemagne) — rapports d&apos;erreurs techniques du site.
          </li>
          <li>
            <strong>Cloudflare Turnstile</strong> — contrôle anti-robot lors de la connexion et de
            l&apos;inscription ; le prestataire reçoit des signaux techniques de votre navigateur (dont votre adresse IP).
          </li>
          <li>
            <strong>CinetPay</strong> et <strong>Chariow</strong> — paiement des abonnements et des formations.
            Les données de carte ou de mobile money sont saisies chez eux, jamais chez WESTBOURSE ; nous recevons
            l&apos;identifiant et le statut de la transaction.
          </li>
          <li>
            <strong>Telegram</strong> et <strong>WhatsApp (Meta)</strong> — acheminement des messages et
            alertes que vous demandez de recevoir, et des échanges avec l&apos;assistant.
          </li>
          <li>
            <strong>Synthèse vocale (Microsoft Edge TTS, ElevenLabs)</strong> — voix des vidéos de séance. Seuls
            des textes de marché générés à partir de données publiques leur sont transmis : aucune donnée personnelle.
          </li>
        </ul>

        <h3>Données personnelles transmises aux fournisseurs d&apos;IA</h3>
        <ul>
          <li>
            <strong>Assistant du site</strong> : le texte de votre question, et des données de marché. Lorsque
            votre question porte sur votre portefeuille (mots comme « portefeuille », « plus-value »,
            « position », « renforcer »), vos positions (code, quantité, prix de revient), leur valorisation et
            votre plus-value ou moins-value latente sont ajoutées à la requête envoyée au fournisseur. Hors de ce cas,
            votre portefeuille n&apos;est pas transmis.
          </li>
          <li>
            <strong>Import d&apos;un relevé de SGI</strong> : le texte ou les images du relevé que vous choisissez
            d&apos;importer (positions, quantités, prix, éventuellement nom du titulaire et numéros présents sur le
            document) sont envoyés à l&apos;un des fournisseurs d&apos;IA (DeepSeek, Mistral AI, xAI) pour en extraire les
            lignes. N&apos;importez pas un document contenant des données que vous ne voulez pas partager.
            Seules les lignes que vous validez sont enregistrées par WESTBOURSE.
          </li>
          <li>
            Chaque fournisseur applique ses propres conditions de réutilisation des données, notamment pour
            l&apos;entraînement de ses modèles ; elles sont publiées sur son site.
          </li>
        </ul>

        <h3>Pays de traitement et transferts hors UEMOA et hors Union européenne</h3>
        <ul>
          <li>France / Union européenne : Supabase (base de données hébergée à Paris), Mistral AI, PostHog, Sentry (collecte en Allemagne), Hetzner (Allemagne).</li>
          <li>États-Unis : Vercel, Resend, Cloudflare, Google (Gemini), xAI, Meta (WhatsApp) ; l&apos;hébergement exact peut varier selon le service.</li>
          <li>Chine : DeepSeek, établi dans un pays sans décision d&apos;adéquation de l&apos;Union européenne.</li>
          <li>TypeSafe, Telegram, CinetPay, Chariow : selon l&apos;infrastructure propre à chaque prestataire.</li>
        </ul>
        <p>
          Ces transferts reposent sur les garanties prévues par chaque prestataire dans ses conditions contractuelles
          (clauses contractuelles types ou équivalent, lorsqu&apos;elles existent).
        </p>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Conformément à la réglementation applicable, vous disposez d&apos;un droit d&apos;accès, de
          rectification, d&apos;effacement, d&apos;opposition, de limitation et de portabilité. Pour les
          exercer, écrivez à support@westbourse.com ; vous pouvez aussi exporter vos données et supprimer
          votre compte vous-même depuis les paramètres du compte.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à
          l&apos;autorité de protection des données de votre pays de résidence (par exemple l&apos;ARTCI en Côte d&apos;Ivoire,
          la CDP au Sénégal, l&apos;APDP au Bénin, la CNIL en France).
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

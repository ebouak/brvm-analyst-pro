import { Mail, MessageCircle, Phone } from 'lucide-react';
import { SectionHeader, PremiumPanel } from '@/components/ui/premium';
import { FormulaireContact } from '@/components/contact/FormulaireContact';

export const metadata = {
  title: 'Contact et aide',
  description:
    'Écrire à WESTBOURSE par e-mail ou WhatsApp, ou demander à être rappelé par l’assistant vocal. Aucun conseil d’investissement personnalisé.',
};

const ADRESSE = 'support@westbourse.com';
const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/[^\d]/g, '');

/**
 * Page publique « Contact et aide ». Trois moyens, un seul circuit de réponse :
 * le formulaire passe par /api/contact (console /admin/contact), l'e-mail
 * arrive au même endroit, WhatsApp à la passerelle. Le rappel vocal est
 * MANUEL : un membre de l'équipe le déclenche depuis la console, jamais un
 * automate, et l'assistant ne donne aucun conseil ni aucun chiffre de marché.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <SectionHeader
        title="Contact et aide"
        subtitle="Une question sur le site, un compte, l’Academy ou un abonnement ? Choisissez le moyen qui vous convient."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PremiumPanel className="p-5">
          <div className="flex items-center gap-2 text-ivory">
            <Mail className="h-4 w-4 text-accent" aria-hidden />
            <h2 className="font-display text-lg">Par e-mail</h2>
          </div>
          <p className="mt-2 text-sm text-muted">Une personne de l’équipe vous répond, à l’adresse qui nous a écrit.</p>
          <a href={`mailto:${ADRESSE}`} className="mt-3 inline-block text-sm font-semibold text-accent underline underline-offset-2">
            {ADRESSE}
          </a>
        </PremiumPanel>

        {WHATSAPP && (
          <PremiumPanel className="p-5">
            <div className="flex items-center gap-2 text-ivory">
              <MessageCircle className="h-4 w-4 text-accent" aria-hidden />
              <h2 className="font-display text-lg">Sur WhatsApp</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Sans compte : écrivez <span className="tabular">AIDE</span> pour la liste des commandes (cours d’une
              valeur, dividendes, palmarès), et <span className="tabular">HUMAIN</span> pour écrire à l’équipe.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-accent underline underline-offset-2"
            >
              Ouvrir WhatsApp
            </a>
          </PremiumPanel>
        )}
      </div>

      <PremiumPanel className="p-5">
        <div className="flex items-center gap-2 text-ivory">
          <Phone className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="font-display text-lg">Écrire, ou être rappelé</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Posez votre question ci-dessous. Si vous préférez en parler, cochez la case : l’assistant vocal automatisé de
          WESTBOURSE vous rappelle, à nos frais, après lecture de votre message par l’équipe. Il répond aux questions
          générales sur le service, ne donne aucun conseil d’investissement ni aucun chiffre de marché, et peut vous
          passer un membre de l’équipe. Dites « stop » et il ne vous rappellera plus.
        </p>
        <div className="mt-4">
          <FormulaireContact />
        </div>
      </PremiumPanel>
    </div>
  );
}

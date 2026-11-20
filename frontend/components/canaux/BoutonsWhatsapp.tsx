import { BellRing, MessageSquareText } from 'lucide-react';
import { BASE, BoutonChaine, LienTelegram } from '@/components/canaux/BoutonChaine';
import { lienAlertesWhatsapp, lienEcrireWhatsapp } from '@/lib/acquisition/boutonsWhatsapp';

/**
 * Les trois boutons WhatsApp, côte à côte (empilés sous 640 px) :
 *  1. « Suivre la Chaîne » : BoutonChaine, lien suivi /chaine?src=…
 *  2. « Écrire sur WhatsApp » : wa.me vers le numéro du service, AIDE prérempli.
 *     Masqué si NEXT_PUBLIC_WHATSAPP_NUMBER est absente.
 *  3. « Recevoir mes alertes » : /signup?src=…&next=/parametres/alertes (le
 *     middleware renvoie un connecté vers `next`), ou /parametres/alertes quand la
 *     page sait déjà que le visiteur est connecté (`connecte`).
 *
 * Rendu serveur, aucun JavaScript, aucune lecture de session : utilisable dans
 * une page ISR. Liens <a> simples (pas de préchargement de /signup ni de /chaine).
 *
 * `inclureChaine={false}` : seulement les deux nouveaux boutons, pour un
 * emplacement où la Chaîne est déjà affichée sur sa propre ligne (accueil).
 * `sousTitre={false}` : une ligne par bouton, pour une barre dense (tableau de bord).
 */
export function BoutonsWhatsapp({
  src,
  variante = 'compacte',
  avecTelegram = false,
  connecte = false,
  inclureChaine = true,
  sousTitre = true,
  className = '',
}: {
  /** Étiquette de la source (`accueil`, `article`…), validée ^[a-z0-9-]{1,40}$. */
  src: string;
  variante?: 'compacte' | 'pleine';
  avecTelegram?: boolean;
  connecte?: boolean;
  inclureChaine?: boolean;
  sousTitre?: boolean;
  className?: string;
}) {
  const ecrire = lienEcrireWhatsapp(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
  const largeur = 'w-full sm:w-auto';
  const secondaire = `${BASE} ${largeur} border border-border-strong px-4 text-sm text-ivory hover:border-up/50 hover:text-up`;
  return (
    <div className={`flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      {inclureChaine && <BoutonChaine src={src} variante={variante} className={largeur} />}
      {ecrire && (
        <a
          href={ecrire}
          target="_blank"
          rel="noopener"
          className={`${secondaire} ${sousTitre ? 'py-1.5' : ''}`}
          aria-label="Écrire au service WhatsApp WESTBOURSE : cours, dividendes, palmarès, sans compte (ouvre WhatsApp)"
        >
          <MessageSquareText aria-hidden className="h-4 w-4 shrink-0 text-up" strokeWidth={2} />
          {sousTitre ? (
            <span className="flex flex-col items-start leading-tight">
              <span>Écrire sur WhatsApp</span>
              <span className="text-xs font-normal text-muted">Cours, dividendes, palmarès — sans compte</span>
            </span>
          ) : (
            <span>Écrire sur WhatsApp</span>
          )}
        </a>
      )}
      <a
        href={lienAlertesWhatsapp(src, connecte)}
        className={secondaire}
        aria-label={connecte ? 'Recevoir mes alertes sur WhatsApp : lier mon WhatsApp' : 'Recevoir mes alertes sur WhatsApp : créer un compte gratuit puis lier mon WhatsApp'}
      >
        <BellRing aria-hidden className="h-4 w-4 shrink-0 text-up" strokeWidth={2} />
        <span>Recevoir mes alertes</span>
      </a>
      {avecTelegram && <LienTelegram src={src} className={largeur} />}
    </div>
  );
}

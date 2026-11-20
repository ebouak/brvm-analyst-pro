import { MessageCircle, Send } from 'lucide-react';
import { cheminSuivi } from '@/lib/acquisition/suivi';

/**
 * « Suivre la Chaîne WhatsApp » — composant UNIQUE du site (accueil, tableau de
 * bord, fin d'article). Rendu serveur, aucun JavaScript : les pages ISR restent
 * statiques.
 *
 * Le lien passe par /chaine?src=<source> (compte agrégé puis 302 vers la Chaîne,
 * lib/acquisition/suivi.ts). Simple <a>, jamais next/link : un préchargement
 * compterait une visite que personne n'a faite.
 *
 * `compacte` : bouton bordé, pour une barre ou une ligne de liens.
 * `pleine`   : bouton plein, pour un appel en fin de lecture.
 * `avecTelegram` : lien secondaire vers le canal Telegram, même mécanisme.
 */
export function BoutonChaine({
  src,
  variante = 'compacte',
  avecTelegram = false,
  className = '',
}: {
  /** Étiquette de la source (`dashboard`, `article`…), validée ^[a-z0-9-]{1,40}$. */
  src: string;
  variante?: 'compacte' | 'pleine';
  avecTelegram?: boolean;
  className?: string;
}) {
  const pleine = variante === 'pleine';
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  const chaine = pleine
    ? `${base} bg-up px-5 text-sm text-bg hover:bg-up/90`
    : `${base} border border-up/50 px-4 text-sm text-up hover:bg-up/10`;
  const telegram = `${base} border border-border-strong px-4 text-sm text-ivory hover:border-accent/50 hover:text-accent-ink`;
  const lien = (
    <a
      href={cheminSuivi('chaine', src)}
      target="_blank"
      rel="noopener"
      className={avecTelegram ? chaine : `${chaine} ${className}`}
      aria-label="Suivre la Chaîne WhatsApp WESTBOURSE (ouvre WhatsApp)"
    >
      <MessageCircle aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span>{pleine ? 'Suivre la Chaîne WhatsApp' : 'Chaîne WhatsApp'}</span>
    </a>
  );
  if (!avecTelegram) return lien;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {lien}
      <a
        href={cheminSuivi('telegram', src)}
        target="_blank"
        rel="noopener"
        className={telegram}
        aria-label="Suivre le canal Telegram WESTBOURSE (ouvre Telegram)"
      >
        <Send aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>Canal Telegram</span>
      </a>
    </div>
  );
}

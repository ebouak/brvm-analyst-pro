import { CANAUX } from '@/lib/canaux';
import { LienCanal } from './LienCanal';

/**
 * WhatsApp et Telegram, toujours visibles sur l'accueil (bas droite). La séance
 * se suit sans compte : c'est l'incitation la plus légère de la page. Libellés
 * visibles à partir de 1024 px, icônes seules en dessous (nom conservé pour les
 * lecteurs d'écran). Mesuré sous l'emplacement « flottant ».
 */
export function CanauxFlottants() {
  return (
    <nav className="v-canaux-flottants" aria-label="Suivre la séance sans compte">
      <LienCanal href={CANAUX.whatsappChaine} canal="whatsapp" emplacement="flottant" className="v-canal-flottant v-canal-flottant--whatsapp">
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1 1 21 11.5z" /><path d="M9 9.5c.3 1.6 1.9 3.6 3.6 4.4l1.2-1 1.7.8c-.2 1.1-1.1 1.7-2.1 1.6-2.6-.4-5.3-3.1-5.6-5.7-.1-1 .6-1.9 1.6-2.1l.8 1.7z" /></svg>
        <span>Suivre sur WhatsApp</span>
      </LienCanal>
      <LienCanal href={CANAUX.telegram} canal="telegram" emplacement="flottant" className="v-canal-flottant v-canal-flottant--telegram">
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z" /><path d="M9 13l12-9" /></svg>
        <span>Suivre sur Telegram</span>
      </LienCanal>
    </nav>
  );
}

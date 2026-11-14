'use client';

import type { ReactNode } from 'react';
import { suivreCanal, type Canal, type EmplacementCanal } from './suivi';

/** Lien externe vers un canal public (WhatsApp, Telegram), mesuré par emplacement. */
export function LienCanal({ href, canal, emplacement, className, children }: { href: string; canal: Canal; emplacement: EmplacementCanal; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={className} onClick={() => suivreCanal(canal, emplacement)}>
      {children}
    </a>
  );
}

/** Mesure l'envoi d'un formulaire d'abonnement placé dedans (événement submit remonté). */
export function SuiviAbonnement({ canal, emplacement, children }: { canal: Canal; emplacement: EmplacementCanal; children: ReactNode }) {
  return <div onSubmitCapture={() => suivreCanal(canal, emplacement)}>{children}</div>;
}

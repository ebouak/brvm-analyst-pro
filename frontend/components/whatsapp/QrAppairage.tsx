'use client';

import { useMemo } from 'react';
import { cheminQr } from '@/lib/whatsapp/qrAppairage';

/**
 * QR code d'appairage : scanné avec l'appareil photo du téléphone, il ouvre
 * WhatsApp avec le code déjà écrit. Utile sur ordinateur ; sur téléphone on ne
 * scanne pas son propre écran, d'où `hidden sm:flex` — le bouton « Ouvrir
 * WhatsApp » reste la voie mobile.
 *
 * Modules sombres sur fond BLANC quel que soit le thème : un QR inversé (clair
 * sur sombre) n'est pas lu par tous les lecteurs.
 */
export default function QrAppairage({ lien, className = '' }: { lien: string; className?: string }) {
  const qr = useMemo(() => {
    try {
      return cheminQr(lien);
    } catch {
      return null;
    }
  }, [lien]);
  if (!qr) return null;

  return (
    <figure className={`hidden items-center gap-4 sm:flex ${className}`}>
      <svg
        viewBox={`0 0 ${qr.taille} ${qr.taille}`}
        role="img"
        aria-label="QR code : scannez-le avec votre téléphone pour ouvrir WhatsApp avec le code"
        shapeRendering="crispEdges"
        className="h-36 w-36 shrink-0 rounded-lg bg-white"
      >
        <path d={qr.d} fill="#030303" />
      </svg>
      <figcaption className="max-w-[30ch] text-xs leading-relaxed text-muted">
        <span className="mb-1 block font-semibold text-white">Sur ordinateur ?</span>
        Scannez ce QR code avec l&apos;appareil photo de votre téléphone : WhatsApp s&apos;ouvre avec le
        code déjà écrit, il ne reste qu&apos;à appuyer sur Envoyer.
      </figcaption>
    </figure>
  );
}

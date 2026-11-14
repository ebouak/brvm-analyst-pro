'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { suivreInscription, useEtatSession, type EmplacementInscription } from './suivi';

/**
 * Point d'inscription de l'accueil. Connecté : « Mon tableau de bord » à la
 * place, aucune incitation. Chaque clic anonyme envoie son emplacement.
 */
export function LienInscription({
  emplacement,
  className = 'v-bouton',
  libelle = 'Créer mon compte gratuit',
  style,
}: {
  emplacement: EmplacementInscription;
  className?: string;
  libelle?: string;
  style?: CSSProperties;
}) {
  const session = useEtatSession();
  if (session === 'connecte') {
    return <Link href="/dashboard" className={className} style={style}>Mon tableau de bord</Link>;
  }
  return (
    <Link href={`/signup?from=${emplacement}`} className={className} style={style} onClick={() => suivreInscription(emplacement)}>
      {libelle}
    </Link>
  );
}

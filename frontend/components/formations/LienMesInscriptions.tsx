'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * « Mes inscriptions » : lien vers /account/formations pour un compte connecté.
 * Résolu côté navigateur : la page des sessions est publique et mise en cache
 * (revalidate), lire la session côté serveur la rendrait dynamique pour tous.
 * Visiteur ou lecture impossible : rien n'est rendu.
 */
export default function LienMesInscriptions() {
  const [connecte, setConnecte] = useState(false);
  useEffect(() => {
    let annule = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => { if (!annule) setConnecte(Boolean(data.user)); })
      .catch(() => {});
    return () => { annule = true; };
  }, []);
  if (!connecte) return null;
  return (
    <p className="text-sm">
      <Link href="/account/formations" className="text-accent underline">Mes inscriptions</Link>
    </p>
  );
}

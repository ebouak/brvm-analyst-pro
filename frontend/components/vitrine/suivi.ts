'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { phCapture } from '@/lib/analytics/posthogClient';

/**
 * Mesure des incitations de l'accueil (spec 2026-11-12 §4) et état de session.
 * Les événements ne portent QUE l'emplacement et le canal : aucune donnée
 * personnelle. phCapture est sans effet tant que le consentement n'est pas donné.
 */

export type EmplacementInscription = 'en-tete' | 'ouverture' | 'mosaique' | 'outils' | 'communaute' | 'gratuit' | 'final' | 'bandeau';
export type EmplacementCanal = 'ouverture' | 'film' | 'canaux' | 'bandeau' | 'flottant';
export type Canal = 'whatsapp' | 'whatsapp-numero' | 'telegram' | 'email';

export function suivreInscription(emplacement: EmplacementInscription): void {
  void phCapture('vitrine_inscription_clic', { emplacement });
}

export function suivreCanal(canal: Canal, emplacement: EmplacementCanal): void {
  void phCapture('vitrine_canal_clic', { canal, emplacement });
}

export type EtatSession = 'inconnu' | 'anonyme' | 'connecte';

/* Une seule lecture de session pour toute la page, partagée par les incitations. */
let lecture: Promise<EtatSession> | null = null;
function lireSession(): Promise<EtatSession> {
  if (!lecture) {
    lecture = (async () => {
      try {
        const { data } = await createClient().auth.getSession();
        return data.session ? 'connecte' : 'anonyme';
      } catch {
        return 'anonyme';
      }
    })();
  }
  return lecture;
}

/**
 * Session lue APRÈS hydratation, sans bloquer le rendu : le HTML serveur (en
 * cache, partagé entre visiteurs) montre toujours la version anonyme.
 */
export function useEtatSession(): EtatSession {
  const [etat, setEtat] = useState<EtatSession>('inconnu');
  useEffect(() => {
    let actif = true;
    lireSession().then((e) => { if (actif) setEtat(e); });
    return () => { actif = false; };
  }, []);
  return etat;
}

'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const CLE = 'ws_geo_envoye';

/**
 * Renseigne le pays du compte, une fois par session de navigateur, pour les
 * personnes déjà connectées (les nouvelles connexions l'envoient elles-mêmes).
 * Aucune requête réseau pour un visiteur anonyme : la session se lit en local.
 */
export default function GeoCompte() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLE)) return;
    } catch { /* stockage indisponible : on tente quand même */ }
    void createClient().auth.getSession().then(({ data }) => {
      if (!data.session) return;
      return fetch('/api/crm/geo', { method: 'POST', keepalive: true }).then((r) => {
        if (r.ok) { try { sessionStorage.setItem(CLE, '1'); } catch { /* ignoré */ } }
      });
    }).catch(() => {});
  }, []);
  return null;
}

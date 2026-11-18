'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BeginnerModeProvider } from '@/lib/beginner-mode';
import ConditionalShell from '@/components/ConditionalShell';
import OnboardingModal from '@/components/OnboardingModal';
import NonEmbedChrome from '@/components/layout/NonEmbedChrome';
import { ETAT_INCONNU, etatShell, type EtatShell, type ProfilShell } from '@/lib/session/etatShell';

/**
 * Session lue dans le NAVIGATEUR, pas dans le layout racine.
 *
 * Le layout racine ne doit lire aucun cookie : sinon toutes les routes du site
 * deviennent dynamiques et le cache (ISR, CDN) ne sert plus rien — c'est ce qui
 * a épuisé le quota CPU Vercel le 2026-11-18 (voir lib/session/etatShell.ts).
 *
 * `getSession()` lit le cookie Supabase sur place (aucun appel à notre serveur).
 * Le profil (premium, onboarding, mode débutant) est lu avec la clé publique,
 * sous la RLS « profil lisible par le propriétaire » (migration 0021) : aucune
 * fonction Vercel n'est sollicitée. Rien de sensible ne dépend de cet état :
 * c'est de l'affichage. Les pages et les API privées revérifient la session
 * côté serveur, et le mur du middleware reste inchangé.
 */
function useEtatShell(): EtatShell {
  const [etat, setEtat] = useState<EtatShell>(ETAT_INCONNU);
  useEffect(() => {
    let actif = true;
    let fin: (() => void) | undefined;
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      setEtat(etatShell(null, false, null));
      return;
    }
    const lire = async (userId: string | null, email: string | null | undefined) => {
      if (!userId) {
        if (actif) setEtat(etatShell(null, false, null));
        return;
      }
      let profil: ProfilShell | null = null;
      try {
        const { data } = await sb
          .from('profiles')
          .select('is_premium, onboarding_done, mode_debutant')
          .eq('id', userId)
          .maybeSingle();
        profil = (data as ProfilShell | null) ?? null;
      } catch {
        // Base injoignable : connecté sans profil, comme l'ancien layout.
      }
      if (actif) setEtat(etatShell(email, true, profil));
    };
    sb.auth
      .getSession()
      .then(({ data }) => lire(data.session?.user.id ?? null, data.session?.user.email))
      .catch(() => { if (actif) setEtat(etatShell(null, false, null)); });
    const { data } = sb.auth.onAuthStateChange((evenement, s) => {
      // Le rafraîchissement du jeton ne change ni l'utilisateur ni son profil.
      if (evenement === 'TOKEN_REFRESHED' || evenement === 'INITIAL_SESSION') return;
      void lire(s?.user.id ?? null, s?.user.email);
    });
    fin = () => data.subscription.unsubscribe();
    return () => { actif = false; fin?.(); };
  }, []);
  return etat;
}

/**
 * Remplace, dans le layout racine, BeginnerModeProvider + ConditionalShell +
 * OnboardingModal, qui recevaient l'état de session du serveur. `chrome` porte
 * le reste du chrome (palette, service worker, bandeau cookies…), rendu à
 * l'intérieur du mode débutant comme avant.
 */
export default function SessionShell({ children, chrome }: { children: ReactNode; chrome: ReactNode }) {
  const etat = useEtatShell();
  return (
    <BeginnerModeProvider initial={etat.modeDebutant}>
      <ConditionalShell isPremium={etat.isPremium} isAdmin={etat.isAdmin} connecte={etat.connecte}>
        {children}
      </ConditionalShell>
      <NonEmbedChrome>
        {chrome}
        {etat.connecte === true && !etat.onboardingDone && <OnboardingModal />}
      </NonEmbedChrome>
    </BeginnerModeProvider>
  );
}

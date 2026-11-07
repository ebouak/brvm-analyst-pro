'use client';
// Boutons d'accès de l'en-tête public. La session n'est lue QU'APRÈS hydratation,
// dans le navigateur : aucune donnée utilisateur dans le HTML rendu côté serveur
// (les pages publiques sont en cache ISR, partagé entre visiteurs).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Etat = 'inconnu' | 'anonyme' | 'connecte';
export type VarianteSession = 'bureau' | 'compact' | 'tiroir-haut' | 'tiroir-bas';

const SECONDAIRE = 'inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ivory';
const ACCENT = 'whitespace-nowrap rounded-xl bg-accent-ink px-4 py-2 text-sm font-semibold text-bg hover:brightness-110';
const TIROIR_LIEN = 'flex min-h-[48px] items-center rounded-xl px-3 text-[15px] font-medium text-ivory hover:bg-white/[0.06]';
const TIROIR_ACCENT = 'flex min-h-[48px] items-center justify-center rounded-xl bg-accent-ink px-6 text-sm font-semibold text-bg';

export function BoutonsSession({ variante, onNavigate }: { variante: VarianteSession; onNavigate?: () => void }) {
  const [etat, setEtat] = useState<Etat>('inconnu');

  useEffect(() => {
    let actif = true;
    let desabonner: (() => void) | undefined;
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (actif) setEtat(data.session ? 'connecte' : 'anonyme');
      }).catch(() => { if (actif) setEtat('anonyme'); });
      const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (actif) setEtat(session ? 'connecte' : 'anonyme');
      });
      desabonner = () => data.subscription.unsubscribe();
    } catch {
      setEtat('anonyme');
    }
    return () => { actif = false; desabonner?.(); };
  }, []);

  // Inconnu : on rend les boutons anonymes, masqués, pour garder la place.
  const cache = etat === 'inconnu' ? 'invisible' : '';
  const connecte = etat === 'connecte';
  const espace = (classe: string) => (
    <Link href="/dashboard" onClick={onNavigate} className={classe}>Mon espace</Link>
  );

  switch (variante) {
    case 'bureau':
      return connecte ? espace(SECONDAIRE) : (
        <span className={`inline-flex items-center ${cache}`} aria-hidden={etat === 'inconnu' ? true : undefined}>
          <Link href="/login" tabIndex={etat === 'inconnu' ? -1 : undefined} className={SECONDAIRE}>Se connecter</Link>
          <Link href="/signup" tabIndex={etat === 'inconnu' ? -1 : undefined} className={`ml-1 ${ACCENT}`}>Créer mon compte gratuit</Link>
        </span>
      );
    case 'compact':
      return connecte ? espace('whitespace-nowrap rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-ivory')
        : <Link href="/signup" tabIndex={etat === 'inconnu' ? -1 : undefined} aria-hidden={etat === 'inconnu' ? true : undefined} className={`whitespace-nowrap rounded-xl bg-accent-ink px-3.5 py-2 text-sm font-semibold text-bg ${cache}`}>Créer un compte</Link>;
    case 'tiroir-haut':
      return connecte ? espace(TIROIR_LIEN)
        : <Link href="/login" onClick={onNavigate} tabIndex={etat === 'inconnu' ? -1 : undefined} aria-hidden={etat === 'inconnu' ? true : undefined} className={`${TIROIR_LIEN} ${cache}`}>Se connecter</Link>;
    case 'tiroir-bas':
      // Connecté : le lien « Mon espace » est déjà en haut du tiroir, rien en bas.
      return connecte ? null
        : <Link href="/signup" onClick={onNavigate} tabIndex={etat === 'inconnu' ? -1 : undefined} aria-hidden={etat === 'inconnu' ? true : undefined} className={`${TIROIR_ACCENT} ${cache}`}>Créer mon compte gratuit</Link>;
  }
}
export default BoutonsSession;

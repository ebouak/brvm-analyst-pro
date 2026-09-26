'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import NewsletterForm from '@/components/NewsletterForm';
import { useConsent } from '@/components/consent/ConsentProvider';

/**
 * Invitation à la newsletter, pour les visiteurs.
 *
 * NON BLOQUANTE. Une carte posée dans un coin, jamais un modal avec voile :
 * on ne prend pas en otage la lecture d'une page publique pour demander une
 * adresse. Fermable au clavier (Échap), au bouton, et mémorisée.
 *
 * RIEN DE NEUF CÔTÉ DONNÉES. Elle poste sur `/api/newsletter/subscribe` via
 * `NewsletterForm` — donc le double opt-in de `newsletter_subscribers`
 * (jeton de confirmation, email de validation) et la limitation de débit déjà
 * en place. Seul le champ `source` change, pour distinguer cette origine des
 * inscriptions faites depuis le pied de page. Aucune table, aucune migration.
 *
 * TROIS GARDE-FOUS DE COHABITATION, parce que le site a déjà deux surcouches :
 *  1. rien tant que le bandeau cookies attend une réponse — le consentement
 *     passe avant la collecte, et deux bandeaux superposés sont illisibles ;
 *  2. placée en bas à GAUCHE, quand `ContactNudge` occupe le bas à droite ;
 *  3. sur petit écran, où les deux prendraient toute la largeur, elle
 *     s'efface si `ContactNudge` est sur le point de paraître. On lit son
 *     compteur de pages, qu'il écrit déjà — aucun couplage nouveau.
 *
 * PAS AUX PERSONNES CONNECTÉES : elles règlent leurs envois dans
 * `/account/newsletters`. Un cookie de session Supabase suffit à les
 * reconnaître côté client, sans appel réseau.
 */

const CLE = 'wb_news_nudge';
const CLE_PAGES_CONTACT = 'wb_nudge_pages'; // écrite par ContactNudge
const SEUIL_PAGES_CONTACT = 3;
const TRENTE_JOURS = 30 * 24 * 60 * 60 * 1000;
/** Profondeur de lecture qui vaut engagement. Proposer avant, c'est quémander. */
const PROFONDEUR = 0.35;

function refusRecent(): boolean {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return false;
    if (brut === 'inscrit') return true;
    const t = Number(brut);
    return Number.isFinite(t) && Date.now() - t < TRENTE_JOURS;
  } catch {
    // Navigation privée, stockage bloqué : on se tait plutôt que d'insister.
    return true;
  }
}

function dejaConnecte(): boolean {
  try {
    return document.cookie.split(';').some((c) => c.trim().startsWith('sb-') && c.includes('auth-token'));
  } catch {
    return false;
  }
}

function contactNudgeImminent(): boolean {
  try {
    return Number(sessionStorage.getItem(CLE_PAGES_CONTACT) ?? '0') >= SEUIL_PAGES_CONTACT - 1;
  } catch {
    return false;
  }
}

export default function NewsletterNudge() {
  const { needsChoice } = useConsent();
  const [visible, setVisible] = useState(false);
  const [etape, setEtape] = useState<'invite' | 'saisie'>('invite');

  const fermer = useCallback((definitif: boolean) => {
    setVisible(false);
    try {
      localStorage.setItem(CLE, definitif ? 'inscrit' : String(Date.now()));
    } catch {
      /* stockage indisponible : la carte ne réapparaîtra qu'au prochain chargement */
    }
  }, []);

  useEffect(() => {
    if (needsChoice || refusRecent() || dejaConnecte()) return;
    if (window.innerWidth < 640 && contactNudgeImminent()) return;

    const auSeuil = () => {
      const h = document.documentElement;
      const parcouru = h.scrollHeight - h.clientHeight;
      if (parcouru <= 0) return;
      if (h.scrollTop / parcouru >= PROFONDEUR) {
        setVisible(true);
        window.removeEventListener('scroll', auSeuil);
      }
    };
    window.addEventListener('scroll', auSeuil, { passive: true });
    auSeuil();
    return () => window.removeEventListener('scroll', auSeuil);
  }, [needsChoice]);

  useEffect(() => {
    if (!visible) return;
    const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(false); };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [visible, fermer]);

  if (!visible) return null;

  return (
    <aside
      role="complementary"
      aria-label="Recevoir le brief BRVM par email"
      className="fixed bottom-3 left-3 right-3 z-[115] w-auto rounded-2xl border border-border bg-surface/95 p-4 shadow-[0_18px_50px_-12px_rgba(0,0,0,.55)] backdrop-blur motion-safe:animate-[nudgeIn_.45s_ease-out] sm:right-auto sm:bottom-4 sm:left-4 sm:w-[22rem]"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.07] text-accent"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">WESTBOURSE</p>
          <p className="mt-1 text-sm leading-relaxed text-ivory">
            Recevez le brief de la séance BRVM : indices, hausses, baisses et volumes, après
            chaque clôture.
          </p>

          {etape === 'invite' ? (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => fermer(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ivory"
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={() => setEtape('saisie')}
                className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90"
              >
                S’inscrire
              </button>
            </div>
          ) : (
            <div className="mt-3">
              {/* `source` distingue cette origine : sans lui, impossible de
                  savoir si la carte apporte des inscriptions ou seulement du
                  bruit — et donc de décider de la garder. */}
              <NewsletterForm source="popup-landing" compact />
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                Un email de confirmation vous sera envoyé. Désinscription en un clic.{' '}
                <Link href="/confidentialite" className="underline underline-offset-2 hover:text-muted">
                  Confidentialité
                </Link>
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => fermer(false)}
          aria-label="Fermer"
          className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-muted transition-colors hover:text-ivory"
        >
          ×
        </button>
      </div>
    </aside>
  );
}

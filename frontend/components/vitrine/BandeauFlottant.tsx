'use client';

import { useEffect, useState } from 'react';
import { CANAUX } from '@/lib/canaux';
import { bandeauVisible } from '@/lib/vitrine/basPur';
import { LienInscription } from './LienInscription';
import { LienCanal } from './LienCanal';
import { useEtatSession } from './suivi';

const CLE = 'vitrine_bandeau_ferme';

function lireFerme(): boolean {
  try { return window.sessionStorage.getItem(CLE) === '1'; } catch { return false; }
}

/**
 * Bandeau flottant (§3.15). Absent du HTML serveur : il n'apparaît qu'une fois
 * le champ d'inscription de l'ouverture (`[data-hero-cta]`) passé au-dessus de
 * l'écran, disparaît quand le bloc final (`[data-bloc-final]`) est en vue, et
 * jamais pour une session ouverte. La fermeture vaut pour la session de navigation.
 */
export function BandeauFlottant() {
  const session = useEtatSession();
  const [ferme, setFerme] = useState(true);
  const [heroDepasse, setHeroDepasse] = useState(false);
  const [finEnVue, setFinEnVue] = useState(false);

  useEffect(() => { setFerme(lireFerme()); }, []);

  useEffect(() => {
    if (session !== 'anonyme' || typeof IntersectionObserver === 'undefined') return;
    const hero = document.querySelector('[data-hero-cta]');
    const fin = document.querySelector('[data-bloc-final]');
    const obs: IntersectionObserver[] = [];
    if (hero) {
      const o = new IntersectionObserver(([e]) => setHeroDepasse(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
      o.observe(hero);
      obs.push(o);
    }
    if (fin) {
      const o = new IntersectionObserver(([e]) => setFinEnVue(e.isIntersecting), { threshold: 0, rootMargin: '0px 0px 120px 0px' });
      o.observe(fin);
      obs.push(o);
    }
    return () => obs.forEach((o) => o.disconnect());
  }, [session]);

  if (!bandeauVisible({ session, ferme, heroDepasse, finEnVue })) return null;

  const fermer = () => {
    setFerme(true);
    try { window.sessionStorage.setItem(CLE, '1'); } catch { /* stockage refusé : fermé pour cette page seulement */ }
  };

  return (
    <div className="v-flottant bande-sombre" role="region" aria-label="Créer un compte">
      <span className="v-flottant-texte">La BRVM au chiffre près. <span>Gratuit, sans carte bancaire.</span></span>
      <LienInscription emplacement="bandeau" libelle="Créer mon compte" className="v-bouton v-bouton--compact" />
      <LienCanal href={CANAUX.whatsappChaine} canal="whatsapp" emplacement="bandeau" className="v-bouton-second">WhatsApp</LienCanal>
      <button type="button" className="v-flottant-fermer" aria-label="Masquer ce bandeau" onClick={fermer}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

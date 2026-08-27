'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const SEEN_KEY = 'brvm_level_seen';
const BANNER_KEY = 'brvm_beginner_banner_dismissed';

/**
 * Bandeau discret sur la landing (`/`) orientant les débutants vers /debutant.
 * Ne s'affiche que si l'utilisateur n'a jamais répondu à la modale de niveau
 * (pas de `brvm_level_seen`) et n'a pas fermé ce bandeau. Thème sombre (app).
 */
export default function BeginnerBanner() {
  const reduire = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY) === '1';
      const dismissed = localStorage.getItem(BANNER_KEY) === '1';
      setShow(!seen && !dismissed);
    } catch {
      /* localStorage indisponible : on n'affiche rien. */
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(BANNER_KEY, '1');
    } catch {
      /* noop */
    }
    setShow(false);
  }

  return (
    // `mode="wait"` rendu explicite : le défaut "sync" superpose sortie et
    // entrée. Ici un seul élément est monté à la fois, mais le laisser
    // implicite est ce qui fait diverger le comportement le jour où un second
    // enfant apparaît.
    //
    // `height` reste animé, à l'inverse des bougies de LoginMarketBar. C'est
    // assumé : un dépliage vers `height: auto` n'a pas d'équivalent en
    // transform sans figer une hauteur, et l'animation ne joue qu'une fois à
    // l'ouverture ou au renvoi — pas en boucle. Le coût est borné.
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          // Mouvement réduit : le bandeau apparaît et disparaît sans glisser.
          transition={reduire ? { duration: 0 } : undefined}
          className="overflow-hidden border-b border-accent/20 bg-accent/5"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <p className="text-white/90">
              <span aria-hidden>🌱</span> Débutant à la BRVM ?{' '}
              <Link href="/debutant" className="font-semibold text-accent underline-offset-2 hover:underline">
                On vous accompagne pas à pas pour ouvrir votre compte →
              </Link>
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fermer le bandeau"
              className="shrink-0 rounded-full p-1 text-muted transition hover:bg-white/5 hover:text-white"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

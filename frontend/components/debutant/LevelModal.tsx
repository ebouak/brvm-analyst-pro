'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLevelModal } from './useLevelModal';
import type { LeadLevel } from '@/lib/leads';

const OPTIONS: { key: LeadLevel; label: string; desc: string; emoji: string }[] = [
  { key: 'debutant', label: 'Je débute', desc: "Je découvre la BRVM, je pars de zéro.", emoji: '🌱' },
  { key: 'intermediaire', label: 'Je connais les bases', desc: 'Je sais ce qu’est une action, je veux ouvrir un compte.', emoji: '📘' },
  { key: 'confirme', label: 'Je suis à l’aise', desc: 'Je veux juste être mis en relation avec un partenaire.', emoji: '🚀' },
];

/**
 * Modale « quel est votre niveau ? » sur /debutant uniquement. Apparaît après
 * 3,5 s, une seule fois (one-time via useLevelModal). Le choix personnalise la
 * page. Non bloquante : fermable, et ignorée si déjà répondu.
 */
export default function LevelModal() {
  const { ready, seen, setLevel, dismiss } = useLevelModal();
  const [open, setOpen] = useState(false);
  const reduire = useReducedMotion();

  useEffect(() => {
    if (!ready || seen) return;
    const t = setTimeout(() => setOpen(true), 3500);
    return () => clearTimeout(t);
  }, [ready, seen]);

  function choose(level: LeadLevel) {
    setLevel(level);
    setOpen(false);
  }
  function close() {
    dismiss();
    setOpen(false);
  }

  return (
    // `mode="wait"` : sans lui AnimatePresence vaut "sync" et fait se
    // chevaucher sortie et entrée. Sur une modale c'est là que le
    // chevauchement se voit le plus — la sortie doit finir d'abord.
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#191714]/40 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Quel est votre niveau à la BRVM ?"
        >
          <motion.div
            className="w-full max-w-md rounded-[1.6rem] border border-[#ddd7cd] bg-[#fbfaf7] p-6 shadow-[0_20px_60px_rgba(11,107,111,0.18)]"
            // Sous préférence de mouvement réduit, la modale ne glisse plus :
            // fondu seul. On ne supprime pas le retour visuel — il faut voir
            // que quelque chose s'est ouvert — on retire le déplacement, qui
            // est la partie réellement gênante.
            initial={{ y: reduire ? 0 : 28, opacity: 0, scale: reduire ? 1 : 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: reduire ? 0 : 28, opacity: 0, scale: reduire ? 1 : 0.98 }}
            transition={reduire ? { duration: 0.15 } : { type: 'spring', damping: 22, stiffness: 240 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0b6b6f]">Bienvenue</p>
                <h2 className="mt-1 text-xl font-bold text-[#191714]">Où en êtes-vous avec la BRVM ?</h2>
                <p className="mt-1 text-sm text-[#6e6a63]">On adapte le contenu à votre niveau. Aucune obligation.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer"
                className="shrink-0 rounded-full p-1 text-[#6e6a63] transition hover:bg-[#efe7db] hover:text-[#191714]"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-2.5">
              {OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => choose(o.key)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#ddd7cd] bg-white p-3.5 text-left transition hover:border-[#0b6b6f] hover:bg-[#d4ebe8]/40 active:scale-[0.99]"
                >
                  <span className="text-2xl" aria-hidden>{o.emoji}</span>
                  <span>
                    <span className="block text-sm font-semibold text-[#191714]">{o.label}</span>
                    <span className="block text-xs text-[#6e6a63]">{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

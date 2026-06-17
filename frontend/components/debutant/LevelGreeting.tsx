'use client';

import { motion } from 'framer-motion';
import { useLevelModal } from './useLevelModal';

/**
 * Bandeau d'accueil personnalisé selon le niveau stocké. Un visiteur « confirmé »
 * voit un raccourci direct vers le partenaire (il n'a pas besoin des explications) ;
 * les autres sont rassurés sur l'accompagnement. Rendu nul tant que non hydraté.
 */
export default function LevelGreeting() {
  const { ready, level } = useLevelModal();
  if (!ready) return null;

  if (level === 'confirme') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start gap-3 rounded-2xl border border-[#0b6b6f]/20 bg-[#d4ebe8]/50 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm font-medium text-[#191714]">
          Vous êtes à l’aise avec la BRVM ? Allez droit au but — un partenaire habilité vous met en relation.
        </p>
        <a
          href="#cta"
          className="shrink-0 rounded-full bg-[#0b6b6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#084d50]"
        >
          Parler à un partenaire →
        </a>
      </motion.div>
    );
  }

  const msg =
    level === 'intermediaire'
      ? 'Vous connaissez les bases — concentrons-nous sur l’ouverture de votre compte titres.'
      : 'Nouveau à la BRVM ? On vous explique chaque étape, simplement, sans jargon.';

  return (
    <motion.p
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#ddd7cd] bg-white/70 px-5 py-4 text-sm text-[#6e6a63]"
    >
      {msg}
    </motion.p>
  );
}

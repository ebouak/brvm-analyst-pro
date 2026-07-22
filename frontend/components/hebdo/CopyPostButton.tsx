'use client';
import { useState } from 'react';

/** Copie un post prêt à publier dans le presse-papier, avec retour visuel. */
export default function CopyPostButton({ texte, label }: { texte: string; label: string }) {
  const [copie, setCopie] = useState(false);
  if (!texte) return null;

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-white"
    >
      {copie ? '✓ Copié' : `Copier (${label})`}
    </button>
  );
}

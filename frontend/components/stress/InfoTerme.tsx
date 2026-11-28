import { Info } from 'lucide-react';

/**
 * Bulle « ⓘ » de définition, sans JavaScript (<details>) : clavier et lecteur
 * d'écran compris. Texte fourni par lib/stress/bulletin.ts (DEFINITIONS_COMPOSANTES).
 */
export function InfoTerme({ terme, definition }: { terme: string; definition: string }) {
  return (
    <details className="relative inline-block align-middle">
      <summary
        aria-label={`Définition : ${terme}`}
        className="inline-flex cursor-pointer list-none items-center text-faint hover:text-accent-ink [&::-webkit-details-marker]:hidden"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </summary>
      <span
        role="note"
        className="absolute left-0 top-5 z-20 block w-60 max-w-[calc(100vw-3rem)] rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-ivory shadow-card"
      >
        <span className="mb-1 block font-semibold">{terme}</span>
        {definition}
      </span>
    </details>
  );
}

/**
 * Marque une valeur légale manquante, à fournir avant le lancement public.
 * Visuellement repérable — ne JAMAIS inventer la donnée à la place.
 */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-400/20 px-1 text-amber-300" title="À compléter avant publication">
      [À COMPLÉTER : {children}]
    </mark>
  );
}

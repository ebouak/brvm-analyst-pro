import type { ReactNode } from 'react';

/** Pied de bloc : d'où viennent les chiffres et ce qu'ils mesurent. */
export function LigneSource({ children }: { children: ReactNode }) {
  return <p className="mt-3 px-1 text-xs leading-relaxed text-faint">{children}</p>;
}

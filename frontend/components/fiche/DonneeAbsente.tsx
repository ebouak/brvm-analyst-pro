import { texteAbsence, type EtatAbsence } from '@/lib/fiche/absence';

/** Rendu unique des quatre états d'absence (spec v2 § 6). */
export function DonneeAbsente(a: EtatAbsence) {
  return <p className="rounded-card border border-dashed border-border px-4 py-3 text-sm text-muted">{texteAbsence(a)}</p>;
}

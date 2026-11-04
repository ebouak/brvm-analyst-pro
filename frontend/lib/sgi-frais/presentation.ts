import type { CoutSGIResult } from './calculateur';

/** Poste de coût affiché dans la décomposition (barre empilée + légende). */
export interface SegmentCout {
  cle: 'courtage' | 'reglementaire' | 'garde' | 'tenue' | 'virement';
  label: string;
  montant: number;
  /** Part du total, en % (somme = 100). */
  part: number;
}

const POSTES: { cle: SegmentCout['cle']; label: string; champ: keyof CoutSGIResult }[] = [
  { cle: 'courtage', label: 'Courtage', champ: 'coutCourtage' },
  { cle: 'reglementaire', label: 'Commissions BRVM + DC/BR', champ: 'coutReglementaire' },
  { cle: 'garde', label: 'Droits de garde', champ: 'coutGarde' },
  { cle: 'tenue', label: 'Tenue de compte', champ: 'coutTenue' },
  { cle: 'virement', label: 'Virements', champ: 'coutVirement' },
];

/** Postes non nuls d'un coût, avec leur part du total. Total nul : liste vide. */
export function decomposerCout(r: CoutSGIResult): SegmentCout[] {
  if (r.total <= 0) return [];
  return POSTES.map((p) => ({ cle: p.cle, label: p.label, montant: r[p.champ] as number }))
    .filter((s) => s.montant > 0)
    .map((s) => ({ ...s, part: (s.montant / r.total) * 100 }));
}

/** Largeur d'une barre en % du coût le plus élevé ; un coût non nul reste visible (≥ 2 %). */
export function largeurBarre(total: number, max: number): number {
  if (max <= 0 || total <= 0) return 0;
  return Math.max(2, (total / max) * 100);
}

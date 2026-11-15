import Illustration from '@/components/academy/lecon/Illustration';
import type { Illustration as IllustrationT } from '@/lib/academy/illustrations';
import './bank.css';

/**
 * Cascade PNB → résultat net : le gabarit « cascade » des leçons Academy,
 * rendu tel quel (avenant du 2026-11-15 : pas de second composant). Les
 * données viennent de lib/bank/cascade.ts (illustrationCascade), qui les a
 * déjà validées par illustrationSchema. Le cadre `.bk-cascade` borne la
 * largeur (le dessin garde ses proportions) et coupe l'animation d'entrée,
 * qui n'a pas de sens sur une feuille imprimée.
 */
export default function CascadeBancaire({ illustration, compacte = false }: { illustration: IllustrationT; compacte?: boolean }) {
  return (
    <div className={compacte ? 'bk-cascade bk-cascade--compacte' : 'bk-cascade'}>
      <Illustration illustration={illustration} />
    </div>
  );
}

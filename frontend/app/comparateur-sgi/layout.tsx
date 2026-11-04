import PublicShell from '@/components/public/PublicShell';
import { OngletsMobile } from '@/components/comparateur-sgi/cadre/Navigation';

/**
 * Cadre commun des modules du comparateur : pleine largeur (le bandeau va
 * bord à bord), barre d'onglets basse sur mobile. Aucun loading.tsx ici :
 * la fiche /annuaire/[slug] peut répondre 404 (règle soft-404).
 */
export default function ComparateurLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell pleineLargeur>
      {/* Réserve la hauteur de la barre basse mobile pour ne rien masquer. */}
      <div className="pb-24 md:pb-0">{children}</div>
      <OngletsMobile />
    </PublicShell>
  );
}

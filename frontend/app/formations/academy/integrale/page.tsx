import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Édition Intégrale — WestBourse Academy',
  description: '44 leçons structurées, 4 niveaux. Version classique de l’Academy.',
};

/**
 * LEGACY — Édition Intégrale statique (public/academy/index.html, 44 leçons).
 * Conservée telle quelle jusqu'à la migration de son contenu en cours DB (P3).
 */
export default function AcademyIntegralePage() {
  return (
    <div className="fixed inset-0 z-0">
      <iframe
        src="/academy/index.html"
        title="WestBourse Academy — Édition Intégrale"
        className="block w-full h-full border-0"
        allow="fullscreen"
        loading="eager"
      />
    </div>
  );
}

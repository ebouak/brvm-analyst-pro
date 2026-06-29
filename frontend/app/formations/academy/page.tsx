import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WestBourse Academy — Formation complète BRVM',
  description: "44 leçons structurées, 4 niveaux certifiants, QCM interactifs. Maîtrisez l'investissement à la BRVM.",
};

/**
 * Page plein écran — WestBourse Academy.
 * L'HTML de l'Academy est servi depuis /public/academy/index.html (iframe same-origin).
 * Pour mettre à jour le contenu : remplacer public/academy/index.html.
 * Plein écran activé via ConditionalShell (BARE_PREFIXES).
 */
export default function AcademyPage() {
  return (
    <div className="fixed inset-0 z-0">
      <iframe
        src="/academy/index.html"
        title="WestBourse Academy — Formation BRVM"
        className="block w-full h-full border-0"
        allow="fullscreen"
        loading="eager"
      />
    </div>
  );
}

/**
 * Sommaire collant des chapitres d'une page de marché (même geste que la fiche
 * action). Fond opaque, pas de backdrop-blur : un flou collant au-dessus d'un
 * canvas de graphique produit des zones noires au défilement sous Chromium.
 */
export function SommaireChapitres({ chapitres }: { chapitres: { id: string; label: string }[] }) {
  if (chapitres.length < 3) return null;
  return (
    <nav aria-label="Chapitres de la page" className="sticky top-0 z-30 -mx-4 mt-6 border-b border-border/60 bg-bg px-4 py-2 md:-mx-6 md:px-6">
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto text-xs">
        {chapitres.map((c, i) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-muted transition-colors hover:bg-white/[0.04] hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 md:px-2.5"
          >
            <span className="tabular text-faint">{String(i + 1).padStart(2, '0')}</span>
            {c.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

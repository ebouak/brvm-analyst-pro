/**
 * Layout des widgets embarquables. Aucun chrome, aucun cookie, aucun traceur
 * (NonEmbedChrome les neutralise dans le layout racine).
 *
 * Le `meta refresh` maintient la fraîcheur chez un média qui laisse sa page
 * ouverte toute la journée, SANS aucun JavaScript (spec §4.1) — aligné sur
 * l'ISR de 300 s des pages.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta httpEquiv="refresh" content="300" />
      <div className="min-h-0">{children}</div>
    </>
  );
}

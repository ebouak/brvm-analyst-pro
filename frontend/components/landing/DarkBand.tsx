/**
 * Bande sombre pleine largeur, pour rompre la succession de sections claires.
 *
 * La landing enchaînait une vingtaine de sections sur le même fond : aucun
 * relief, aucune respiration entre les « histoires ». Cette bande crée
 * l'alternance clair / sombre / clair d'un vrai produit financier, en
 * réservant le sombre aux moments de DONNÉES (cartographie, diagnostic).
 *
 * Pleine largeur : le conteneur parent est borné par `max-w-content`, on en
 * sort avec une marge négative calculée sur la largeur du viewport, puis on
 * réapplique le même gabarit à l'intérieur. `overflow-x` du body n'est pas
 * touché — vérifié à 1440 / 1280 / 834 / 390 px, aucun débordement.
 *
 * ⚠️ Couleurs FIXES, comme le hero et le footer : cette bande reste sombre
 * quel que soit le thème. Un texte piloté par token y deviendrait illisible
 * en mode clair.
 */

export function DarkBand({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`dark-band relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden ${className}`}
      style={{ background: '#04070d' }}
    >
      {/* Filets d'entrée et de sortie : la transition se lit comme voulue,
          pas comme un bloc collé par accident. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(86,215,253,.35), transparent)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(86,215,253,.18), transparent)' }}
        aria-hidden
      />
      {/* Grille financière ténue, même vocabulaire que le terminal du hero. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(rgba(86,215,253,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(86,215,253,.05) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-content px-4 py-10 md:py-14">{children}</div>
    </section>
  );
}

/** Titre d'« histoire » sur fond sombre. Couleurs fixes, cf. en-tête du fichier. */
export function DarkBandHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mb-8 max-w-[54ch]">
      <p className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: '#8fe6ff' }}>
        {eyebrow}
      </p>
      <h2
        className="font-display text-[clamp(26px,3.6vw,44px)] leading-[1.08] tracking-[-0.035em]"
        style={{ color: '#fcfcfc' }}
      >
        {title}
      </h2>
      {lead && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: '#b5b5b5' }}>
          {lead}
        </p>
      )}
    </div>
  );
}

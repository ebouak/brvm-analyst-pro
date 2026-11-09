/** Style d'onglet unique des pages d'états financiers. L'actif est cyan (accent-ink, ≥ 4,5:1 dans les deux thèmes), jamais vert. */
export const styleOnglet = (actif: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${
    actif ? 'border-accent bg-accent/10 text-accent-ink' : 'border-border text-muted hover:text-ivory'
  }`;

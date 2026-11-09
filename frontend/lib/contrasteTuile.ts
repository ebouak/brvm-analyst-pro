/**
 * Encre d'une tuile de la heatmap (cartographie et grille) : le texte posé sur
 * une couleur de variation doit rester lisible dans les deux thèmes.
 *
 * Les deux encres candidates sont des JETONS du thème, jamais des couleurs en
 * dur : `--color-bg` et `--color-ivory`. Dans chaque thème l'un est sombre et
 * l'autre clair (sombre : 3 3 3 / 252 252 252 ; clair : 250 248 244 /
 * 32 28 23), donc le couple couvre toujours un fond clair comme un fond foncé.
 */

/** Luminance relative WCAG 2.x d'une couleur #rrggbb. */
export function luminanceWcag(hex: string): number {
  const c = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Rapport de contraste WCAG entre deux couleurs #rrggbb. */
export function contraste(a: string, b: string): number {
  const la = luminanceWcag(a);
  const lb = luminanceWcag(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Celle des encres qui contraste le plus avec le fond (la première à égalité). */
export function encreSur(fond: string, encres: readonly [string, string]): string {
  return contraste(fond, encres[1]) > contraste(fond, encres[0]) ? encres[1] : encres[0];
}

/** Triplet « r g b » d'un jeton CSS → #rrggbb ; `null` si illisible. */
export function tripletVersHex(t: string): string | null {
  const m = t.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (!m) return null;
  return '#' + m.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
}

/**
 * Les deux encres du thème courant, lues dans les jetons calculés. À appeler
 * côté client ; `null` hors navigateur ou si un jeton manque (l'appelant garde
 * alors la couleur de texte héritée, `text-ivory`).
 */
export function encresDuTheme(): readonly [string, string] | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = getComputedStyle(document.documentElement);
    const fonce = tripletVersHex(s.getPropertyValue('--color-bg'));
    const clair = tripletVersHex(s.getPropertyValue('--color-ivory'));
    return fonce && clair ? [fonce, clair] : null;
  } catch {
    return null;
  }
}

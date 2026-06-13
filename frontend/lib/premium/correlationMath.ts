/**
 * Mathématiques de corrélation matière première ↔ action (méthodes d'analyste).
 *
 * Best practice : corréler les VARIATIONS (rendements) mensuelles, pas les
 * niveaux — sinon deux tendances haussières donnent une fausse corrélation.
 *
 * Fonctions pures et testables.
 */

/** Rendements période à période d'une série de niveaux (longueur n-1). */
export function returns(levels: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1]!;
    out.push(prev !== 0 ? (levels[i]! - prev) / prev : 0);
  }
  return out;
}

/** Coefficient de Pearson entre deux séries de même longueur. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]!; my += ys[i]!; }
  mx /= n; my /= n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx, b = ys[i]! - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
}

/** Beta : sensibilité de y aux variations de x (pente de régression). */
export function beta(xReturns: number[], yReturns: number[]): number | null {
  const n = Math.min(xReturns.length, yReturns.length);
  if (n < 3) return null;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xReturns[i]!; my += yReturns[i]!; }
  mx /= n; my /= n;
  let cov = 0, varx = 0;
  for (let i = 0; i < n; i++) {
    const a = xReturns[i]! - mx;
    cov += a * (yReturns[i]! - my);
    varx += a * a;
  }
  return varx === 0 ? null : cov / varx;
}

/** Corrélation glissante (fenêtre w) sur deux séries de rendements alignées. */
export function rollingCorr(xReturns: number[], yReturns: number[], w = 12): (number | null)[] {
  const n = Math.min(xReturns.length, yReturns.length);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i + 1 < w) { out.push(null); continue; }
    out.push(pearson(xReturns.slice(i + 1 - w, i + 1), yReturns.slice(i + 1 - w, i + 1)));
  }
  return out;
}

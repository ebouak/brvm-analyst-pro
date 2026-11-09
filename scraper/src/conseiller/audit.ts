import type { Serie } from './types.js';

/** Sauts d'une séance à l'autre hors de [×0,6 ; ×1,6] : fractionnement possible (÷2 compris). */
export function sautsSuspects(series: Map<string, Serie>): { code: string; date: string; ratio: number }[] {
  const out: { code: string; date: string; ratio: number }[] = [];
  for (const [code, s] of series) {
    for (let i = 1; i < s.cours.length; i++) {
      const ratio = s.cours[i]! / s.cours[i - 1]!;
      if (ratio < 0.6 || ratio > 1.6) out.push({ code, date: s.dates[i]!, ratio });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function partFigee(s: Serie): number {
  return s.volumes.filter((v) => v <= 0).length / s.volumes.length;
}

/** Codes dont la dernière cotation précède `derniere` de plus de `joursMax` jours calendaires. */
export function radiees(series: Map<string, Serie>, derniere: string, joursMax: number): string[] {
  const limite = new Date(Date.parse(derniere) - joursMax * 86400000).toISOString().slice(0, 10);
  return [...series].filter(([, s]) => (s.dates.at(-1) ?? '') < limite).map(([c]) => c).sort();
}

export function couvertureParAn(lignes: { code: string; annee: number }[]): Record<number, number> {
  const m = new Map<number, Set<string>>();
  for (const l of lignes) (m.get(l.annee) ?? m.set(l.annee, new Set()).get(l.annee)!).add(l.code);
  return Object.fromEntries([...m].sort((a, b) => a[0] - b[0]).map(([a, s]) => [a, s.size]));
}

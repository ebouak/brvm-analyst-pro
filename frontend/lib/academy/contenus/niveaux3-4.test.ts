import { describe, it, expect } from 'vitest';
import { pageExiste } from '@/lib/routes/pageExiste';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Lesson } from '../types';

/**
 * Niveaux 3 (analyse technique, 7 leçons) et 4 (expert : régulation et marché
 * primaire, 5 leçons), réécrits le 2026-11-14 au format du niveau 1.
 */
const APP = fileURLToPath(new URL('../../../app/', import.meta.url));
const charger = (dossier: string): [string, Lesson, string][] => {
  const dir = fileURLToPath(new URL(`./${dossier}/`, import.meta.url));
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const brut = readFileSync(`${dir}${f}`, 'utf-8');
    return [`${dossier}/${f}`, lessonSchema.parse(JSON.parse(brut)), brut];
  });
};
const N3_TOUT = charger('niveau3');
// Leçon 0 du niveau 3 (2026-11-24) : la grille de décision, en module 0.
const L0 = N3_TOUT.find(([f]) => f === 'niveau3/l00-grille-decision.json')!;
const N3 = N3_TOUT.filter(([f]) => f !== L0[0]);
const N4 = charger('niveau4');

describe('structure', () => {
  it('niveau 3 : une leçon 0 puis sept leçons ; niveau 4 : cinq, numérotées dans l’ordre', () => {
    expect(N3_TOUT).toHaveLength(8);
    expect(N3_TOUT[0]![0]).toBe(L0[0]);
    expect(L0[1].titre.startsWith('Leçon 0 — ')).toBe(true);
    expect(L0[1].module).toMatch(/^Module 0 — /);
    expect(L0[1].nouveaute).toEqual({ type: 'nouveau', depuis: '2026-11-24' });
    expect(N3).toHaveLength(7);
    expect(N4).toHaveLength(5);
    for (const lot of [N3, N4]) lot.forEach(([, l], i) => expect(l.titre.startsWith(`Leçon ${i + 1} — `), l.titre).toBe(true));
  });
});

describe('niveau 3, leçon 0 — chiffres recalculés depuis les sources', () => {
  const src = JSON.parse(readFileSync(fileURLToPath(new URL('./niveau3/sources/liquidite-2026-11-23.json', import.meta.url)), 'utf-8')) as {
    periode: { seances: number }; valeurs: { code: string; capitaux_md: number; seances_sans_echange: number }[];
  };
  const v = [...src.valeurs].sort((a, b) => b.capitaux_md - a.capitaux_md);
  const total = v.reduce((t, x) => t + x.capitaux_md, 0);
  const part = (n: number) => ((v.slice(0, n).reduce((t, x) => t + x.capitaux_md, 0) / total) * 100).toFixed(1).replace('.', ',');
  const brut = L0[2];
  it('concentration des échanges : Sonatel, cinq et dix premières valeurs', () => {
    expect(v[0]!.code).toBe('SNTS');
    expect(brut).toContain(`Sonatel en représente à elle seule ${part(1)} %, les cinq valeurs les plus échangées ${part(5)} %, les dix premières ${part(10)} %`);
    expect(brut).toContain(`${total.toFixed(1).replace('.', ',')} milliards de FCFA ont été échangés sur les ${v.length} actions cotées`);
  });
  it('les graphiques réels citent leur source ; aucune valeur non cotée, aucun site tiers', () => {
    for (const s of L0[1].sections) for (const c of s.graphiques) if (c.reel) expect(c.note).toMatch(/Sources? : .*(19|20)[0-9]{2}/);
    expect(brut).not.toMatch(/MTN|sika|rich ?bourse|stockanalysis/i);
  });
  it('la convergence est présentée sans promesse de résultat', () => {
    expect(brut).toMatch(/Elle ne garantit aucun résultat/);
    expect(brut).not.toMatch(/probabilité de succès/);
  });
});

describe.each([L0, ...N3, ...N4])('%s — règles éditoriales', (_f, l, brut) => {
  it('cinq questions valides ; la question unique reprend la première', () => {
    expect(l.quiz).toHaveLength(5);
    for (const q of l.quiz!) expect(q.correct).toBeLessThan(q.options.length);
    expect(l.qcm).toEqual(l.quiz![0]);
  });
  it('avertissement, sous-titre, module, paragraphes courts', () => {
    expect(l.avertissement).toMatch(/pas un conseil en investissement/);
    expect(l.sous_titre).toBeTruthy();
    expect(l.module).toMatch(/^Module [0-3] — /);
    for (const s of l.sections) for (const p of s.contenu.split(/\n+/)) expect(p.length, s.titre).toBeLessThanOrEqual(650);
  });
  it('un cas « réel » lit ses chiffres en base ; un graphique écrit à la main est un exemple', () => {
    for (const s of l.sections) if (s.reel) expect(s.donnees_reelles, s.titre).toBeTruthy();
    for (const c of l.charts) {
      expect(c.reel).toBe(false);
      expect(c.note.toLowerCase()).toMatch(/exemple/);
    }
  });
  it('ni témoignage inventé, ni ancien nom du régulateur employé seul, ni article de loi cité', () => {
    expect(brut).not.toMatch(/\b(M\.|Mme|Mlle) [A-ZÉ]/);
    expect(brut).not.toMatch(/[Tt]émoignage|[Aa]rticles? \d/);
    for (const m of brut.matchAll(/CREPMF/g)) expect(brut.slice(Math.max(0, m.index! - 80), m.index + 40)).toMatch(/succédé|ex-|devient|transformé|Conseil régional|à l’AMF-UMOA/);
  });
  it('texte courant développé : au moins 2 500 caractères par leçon', () => {
    const total = l.sections.reduce((n, s) => n + s.contenu.length, 0);
    expect(total, l.titre).toBeGreaterThanOrEqual(2500);
  });
  it('les liens mènent à des pages qui existent', () => {
    for (const lien of l.liens) expect(pageExiste(APP, lien.href), lien.href).toBe(true);
  });
});

describe('réponses de calcul', () => {
  const bonne = (lot: [string, Lesson, string][], n: number, i: number) => {
    const q = lot[n - 1]![1].quiz![i]!;
    return q.options[q.correct];
  };
  it('niveau 3', () => {
    expect(bonne(N3, 3, 0)).toBe(String((200 + 210 + 190 + 220) / 4));
    expect(bonne(N3, 4, 0)).toBe(String(100 - 100 / (1 + 3)));
    expect(bonne(N3, 5, 0)).toBe('+10');
    expect(bonne(N3, 7, 0)).toBe('40 000 FCFA');
    expect(bonne(N3, 7, 1)).toBe(String(30000 / (3000 - 2700)));
    expect(bonne(N3, 7, 2)).toBe(String((1300 - 1000) / (1000 - 900)));
  });
  it('niveau 4', () => {
    expect(bonne(N4, 4, 1)).toBe('142 %');
    expect(bonne(N4, 4, 2)).toBe('Environ 70 %');
    expect(bonne(N4, 5, 3)).toBe(String(1000 / 2));
  });
});

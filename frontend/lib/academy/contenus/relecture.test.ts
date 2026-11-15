import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lessonSchema, type Lesson } from '../types';

/**
 * Relecture des niveaux 1 à 4 (2026-11-14). Chaque test ci-dessous échouait sur
 * l'ancien texte : il protège la correction contre un retour en arrière.
 */
const racine = join(__dirname);
const lire = (f: string): Lesson => lessonSchema.parse(JSON.parse(readFileSync(join(racine, f), 'utf8')));
const fichiers = [
  ...readdirSync(racine).filter((f) => f.endsWith('.json')),
  ...['niveau2', 'niveau3', 'niveau4'].flatMap((d) =>
    readdirSync(join(racine, d)).filter((f) => f.endsWith('.json')).map((f) => `${d}/${f}`),
  ),
];
const texte = (l: Lesson) => JSON.stringify(l);

describe('quiz : la longueur ne trahit pas la bonne réponse', () => {
  it('la bonne réponse est l’option strictement la plus longue dans moins de 40 % des questions', () => {
    let total = 0;
    let plusLongue = 0;
    for (const f of fichiers) {
      for (const q of lire(f).quiz ?? []) {
        total += 1;
        const autres = q.options.filter((_, i) => i !== q.correct).map((o) => o.length);
        if (q.options[q.correct]!.length > Math.max(...autres)) plusLongue += 1;
      }
    }
    expect(total).toBeGreaterThan(150);
    expect(plusLongue / total).toBeLessThan(0.4);
  });
});

describe('B1 — les DPS ne sont pas une source de gain (niveau 1, leçon 4)', () => {
  const l = lire('lecon4-gagner.json');
  it('le titre ne parle plus de trois façons de gagner', () => {
    expect(l.titre.startsWith('Leçon 4 — ')).toBe(true);
    expect(l.titre).not.toMatch(/3 façons|trois façons/i);
  });
  it('les droits compensent la dilution ; céder ne fait pas « encaisser » un gain', () => {
    expect(texte(l)).not.toMatch(/encaissez leur valeur/);
    expect(texte(l)).not.toMatch(/Trois sources de gain/);
    expect(l.sections[0]!.points!.find((p) => p.titre.includes('DPS'))!.detail).toMatch(/compensent la dilution/);
  });
});

describe('B2 — « le prix de 20 actions » affiche des cours, pas des dividendes (niveau 1, leçon 6, ex-leçon 9)', () => {
  it('le bloc lit la vue « cours »', () => {
    const s = lire('lecon6-compte-ordre.json').sections.find((x) => x.titre.includes('prix de 20 actions'))!;
    expect(s.donnees_reelles?.vue).toBe('cours');
    expect(s.donnees_reelles?.actions).toBe(20);
  });
});

describe('B3 — la mesure du score est présentée avec ses limites (niveau 3)', () => {
  const l1 = lire('niveau3/l01-lire-graphique.json');
  const l4 = lire('niveau3/l04-rsi.json');
  const bloc = l1.sections.find((s) => s.titre === 'Ce que nous avons mesuré sur la BRVM')!;
  it('horizon, cas indépendants, intervalle et chiffres du rejeu (docs/signaux/rejeu-2008-2023.md)', () => {
    expect(bloc.contenu).toMatch(/20 séances/);
    expect(bloc.contenu).toMatch(/276 indépendants/);
    expect(bloc.contenu).toMatch(/8,4 %/);
    expect(bloc.contenu).toMatch(/\+5,5 % à \+11,4 %/);
  });
  it('dit que l’effet n’est pas confirmé sur la période récente, et que ce n’est pas une promesse', () => {
    expect(bloc.contenu).toMatch(/2024-2026, cet effet n’est pas confirmé/);
    expect(bloc.contenu).toMatch(/ni une prévision/);
    expect(bloc.contenu).toMatch(/rien ne promet/);
  });
  it('le quiz donne l’horizon et la réserve', () => {
    const q = l1.quiz!.find((x) => x.question.includes('2008-2023'))!;
    expect(q.question).toMatch(/20 séances/);
    expect(q.explication).toMatch(/n’est pas confirmé/);
  });
  it('le bloc n’apparaît que dans une leçon, et la leçon RSI n’attribue plus l’effet au RSI', () => {
    expect(texte(l4)).not.toMatch(/8,4 %|109 634/);
    expect(texte(l4)).not.toMatch(/les excès ont plutôt eu tendance à se corriger/);
  });
});

describe('cohérence entre niveaux', () => {
  it('ordre « au mieux », jamais « au marché » comme type d’ordre', () => {
    for (const f of fichiers) expect(texte(lire(f)), f).not.toMatch(/[Oo]rdre au marché/);
  });
  it('même repère de diversification : 20 % par société, 35 % par secteur', () => {
    expect(texte(lire('lecon7-risques.json'))).toMatch(/20 % sur une société, ni plus de 35 % sur un secteur/);
    const t = texte(lire('niveau2/l05-diversification.json'));
    expect(t).toMatch(/Pas plus de 20 % du portefeuille/);
    expect(t).toMatch(/Pas plus de 35 % sur un seul secteur/);
    expect(t).not.toMatch(/un tiers sur un seul secteur/);
  });
  it('le dividende est versé sur le compte espèces', () => {
    expect(texte(lire('lecon5-dividendes.json'))).not.toMatch(/versé sur le compte titres/);
  });
  it('aucun fait qui périme écrit au présent', () => {
    const tout = fichiers.map((f) => texte(lire(f))).join('\n');
    expect(tout).not.toMatch(/admission la plus récente/);
    expect(tout).not.toMatch(/[Uu]ne valeur sur trois/);
    expect(tout).not.toMatch(/plus de deux cents emprunts/);
    expect(tout).not.toMatch(/4 millions de titres/);
  });
});

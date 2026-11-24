import { describe, it, expect } from 'vitest';
import { pageExiste } from '@/lib/routes/pageExiste';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Chart, type Lesson } from '../../types';

/**
 * Niveau 2 « Analyse fondamentale ».
 *  - Module 0 (2026-11-24) : le cours complet d’analyse fondamentale appliquée
 *    à la BRVM, huit leçons l00a → l00h générées par
 *    scripts/academy-module-zero.mjs depuis sources/cours-complet-2026-11-23.json.
 *  - Modules 1 à 3 (réécrits le 2026-11-14) : dix leçons l01 → l10, chiffres de
 *    marché lus en base (donnees_reelles), graphiques d’exemple déclarés comme tels.
 */
const DIR = fileURLToPath(new URL('./', import.meta.url));
const APP = fileURLToPath(new URL('../../../../app/', import.meta.url));
const FICHIERS = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const LECONS: [string, Lesson, string][] = FICHIERS.map((f) => {
  const brut = readFileSync(`${DIR}${f}`, 'utf-8');
  return [f, lessonSchema.parse(JSON.parse(brut)), brut];
});
const MODULE0 = LECONS.filter(([f]) => f.startsWith('l00'));
const NIVEAU = LECONS.filter(([f]) => !f.startsWith('l00'));
const graphiquesDe = (l: Lesson): Chart[] => [...l.charts, ...l.sections.flatMap((s) => s.graphiques)];

describe('niveau 2 — structure', () => {
  it('module 0 : huit leçons « Leçon 0.N — », dans l’ordre des fichiers, placées avant le module 1', () => {
    expect(MODULE0).toHaveLength(8);
    MODULE0.forEach(([, l], i) => {
      expect(l.titre.startsWith(`Leçon 0.${i + 1} — `), l.titre).toBe(true);
      expect(l.module).toMatch(/^Module 0 — /);
    });
    expect(FICHIERS.indexOf(MODULE0[7]![0])).toBeLessThan(FICHIERS.indexOf(NIVEAU[0]![0]));
  });

  it('module 0 : badge « nouveau » daté, sur chaque leçon', () => {
    for (const [, l] of MODULE0) expect(l.nouveaute).toEqual({ type: 'nouveau', depuis: '2026-11-24' });
  });

  it('modules 1 à 3 : dix leçons, numérotées dans l’ordre des fichiers', () => {
    expect(NIVEAU).toHaveLength(10);
    NIVEAU.forEach(([, l], i) => expect(l.titre.startsWith(`Leçon ${i + 1} — `), l.titre).toBe(true));
  });
});

describe.each(LECONS)('%s — règles éditoriales', (_f, l, brut) => {
  it('cinq questions, réponses dans les options ; la question unique reprend la première', () => {
    expect(l.quiz).toHaveLength(5);
    for (const q of l.quiz!) expect(q.correct).toBeLessThan(q.options.length);
    expect(l.qcm).toEqual(l.quiz![0]);
  });

  it('avertissement, sous-titre, module et paragraphes courts', () => {
    expect(l.avertissement).toContain('pas un conseil en investissement');
    expect(l.sous_titre).toBeTruthy();
    expect(l.module).toMatch(/^Module [0-3] — /);
    for (const s of l.sections) for (const p of s.contenu.split(/\n+/)) expect(p.length, s.titre).toBeLessThanOrEqual(650);
  });

  it('un cas « réel » lit ses chiffres en base ; un graphique écrit à la main est un exemple', () => {
    for (const s of l.sections) if (s.reel) expect(s.donnees_reelles, s.titre).toBeTruthy();
    for (const c of graphiquesDe(l)) {
      // Chiffres publiés ou calculés sur des cours réels : source ET année dans la note.
      if (c.reel) expect(c.note, c.titre).toMatch(/Sources? : .*(19|20)[0-9]{2}/);
      else expect(c.note.toLowerCase()).toMatch(/exemple/);
    }
  });

  it('ni témoignage inventé, ni ancien nom du régulateur employé seul', () => {
    expect(brut).not.toMatch(/\b(M\.|Mme|Mlle) [A-ZÉ]/);
    expect(brut).not.toMatch(/[Tt]émoignage/);
    for (const m of brut.matchAll(/CREPMF/g)) expect(brut.slice(Math.max(0, m.index! - 60), m.index)).toMatch(/succédé|ex-/);
  });

  it('texte courant développé : au moins 2 500 caractères par leçon', () => {
    const total = l.sections.reduce((n, s) => n + s.contenu.length, 0);
    expect(total, l.titre).toBeGreaterThanOrEqual(2500);
  });
  it('les liens « pratiquer » mènent à des pages qui existent', () => {
    for (const lien of l.liens) expect(pageExiste(APP, lien.href), lien.href).toBe(true);
  });
});

describe('réponses de calcul : la bonne option est le bon résultat', () => {
  const bonne = (n: number, i: number) => {
    const q = NIVEAU[n - 1]![1].quiz![i]!;
    return q.options[q.correct];
  };
  const bonne0 = (n: number, i: number) => {
    const q = MODULE0[n - 1]![1].quiz![i]!;
    return q.options[q.correct];
  };
  it('PER, BPA, ROE, P/B, rendement', () => {
    expect(bonne(2, 0)).toBe(String(4500 / 300));
    expect(bonne(2, 1)).toBe(`${5e9 / 2e7} FCFA`);
    expect(bonne(3, 0)).toBe(`${(10 / 50) * 100} %`);
    expect(bonne(3, 1)).toBe(String(8 * 0.25));
    expect(bonne(3, 2)).toBe(`${Math.round((140 / 2000) * 100)} %`);
    expect(bonne(4, 1)).toBe(`${(48 / 120) * 100} %`);
  });
  it('DPS, simulation, fiscalité, obligations, OPCVM', () => {
    expect(bonne(6, 0)).toBe(`${(8000 - 6000) / 4} FCFA`);
    expect(bonne(6, 1)).toBe('7 500 FCFA');
    expect(bonne(7, 0)).toBe('5 000 000 FCFA');
    expect(bonne(7, 1)).toBe(String((100 * 600) / 10000));
    expect(bonne(8, 0)).toBe('1 320 FCFA');
    expect(bonne(9, 0)).toBe(`${Math.round(10000 * 0.07)} FCFA`);
    expect(bonne(10, 0)).toBe('5 000 FCFA');
    expect(bonne(10, 1)).toBe('1 940 000 FCFA');
  });
  it('module 0 : TCAM, ROE moyen, PER, gearing, résultat bancaire, couverture, P/B', () => {
    expect(bonne0(2, 0)).toBe(`${Math.round((Math.pow(146.4 / 100, 1 / 4) - 1) * 100)} %`);
    expect(bonne0(2, 1)).toBe(`${((60 / ((200 + 240) / 2)) * 100).toFixed(1).replace('.', ',')} %`);
    expect(bonne0(2, 2)).toBe(String(12000 / 1500));
    expect(bonne0(2, 3)).toBe(`${((300 - 100) / 400) * 100} %`);
    expect(bonne0(3, 1)).toBe(String(100 - 45 - 5));
    expect(bonne0(3, 3)).toBe(`${(36 / 40) * 100} %`);
    expect(bonne0(6, 4)).toBe((12.5 * 0.29).toFixed(1).replace('.', ','));
  });
});

/**
 * Module 0 : chaque chiffre clé est recalculé ICI, indépendamment du
 * générateur, depuis les données sources. Un JSON régénéré à partir de
 * sources modifiées, ou retouché à la main, échoue ici.
 */
describe('module 0 — chiffres recalculés depuis les sources', () => {
  type Annee = { revenu: number; rn: number; bpa: number; dpa_comptes: number; cp: number; actif: number; cloture: number | null };
  type Societe = {
    titres: number;
    cours: Record<string, number>;
    annuel: Record<string, Annee>;
    dividende_2025: { brut: number | null; net: number };
  };
  const SRC = JSON.parse(readFileSync(`${DIR}sources/cours-complet-2026-11-23.json`, 'utf-8')) as {
    societes: Record<'ECOC' | 'SGBC' | 'SNTS' | 'ORAC', Societe>;
    bceao: { solvabilite_minimum_pct: number };
  };
  const ANS = ['2021', '2022', '2023', '2024', '2025'];
  const fr = (n: number, d: number) => {
    const [e, dec] = Math.abs(n).toFixed(d).split('.');
    return (n < 0 ? '−' : '') + e!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? `,${dec}` : '');
  };
  const texte = (prefixe: string) => MODULE0.find(([f]) => f.startsWith(prefixe))![2];
  const lecon = (prefixe: string) => MODULE0.find(([f]) => f.startsWith(prefixe))![1];
  const { ECOC, SGBC, SNTS, ORAC } = SRC.societes;
  const a = (s: Societe, y = '2025') => s.annuel[y]!;

  it('PER au 23/11/2026 sur le BPA 2025, et PER du Bulletin officiel au 20/11/2026', () => {
    expect(texte('l00d')).toContain(`le PER ressort à ${fr(ECOC.cours['2026-11-23']! / a(ECOC).bpa, 2)}`);
    expect(texte('l00e')).toContain(`le PER ressort à ${fr(SGBC.cours['2026-11-23']! / a(SGBC).bpa, 2)}`);
    const boc = [SNTS, ORAC].map((s) => fr(s.cours['2026-11-20']! / a(s).bpa, 2));
    expect(boc).toEqual(['9,77', '17,28']); // chiffres imprimés dans le Bulletin officiel de la cote du 20/11/2026
    expect(texte('l00g')).toContain(`donnait ${boc[0]} :`);
    expect(texte('l00g')).toContain(`${boc[1]} au cours du 20/11/2026`);
  });

  it('ROE de clôture et ROE moyen, TCAM du PNB (n = 4 années, pas 5)', () => {
    const roeMoy = (a(ECOC).rn / ((a(ECOC, '2024').cp + a(ECOC).cp) / 2)) * 100;
    expect(texte('l00b')).toContain(`ROE sur capitaux moyens : ${fr(roeMoy, 1)} %`);
    expect(texte('l00b')).toContain(`ROE de clôture : ${fr((a(ECOC).rn / a(ECOC).cp) * 100, 1)} %`);
    const tcam = (Math.pow(a(ECOC).revenu / a(ECOC, '2021').revenu, 1 / 4) - 1) * 100;
    expect(texte('l00b')).toContain(`un TCAM de ${fr(tcam, 1)} %`);
  });

  it('rendement du dividende : brut et net distingués, sur le cours du 23/11/2026', () => {
    const c = ECOC.cours['2026-11-23']!;
    expect(texte('l00d')).toContain(`représente ${fr((ECOC.dividende_2025.brut! / c) * 100, 2)} % du cours, soit ${fr((ECOC.dividende_2025.net / c) * 100, 2)} % après retenue`);
    expect(texte('l00g')).toContain(`${fr((SNTS.dividende_2025.net / SNTS.cours['2026-11-23']!) * 100, 2)} %`);
  });

  it('capitalisations et performances (séance, depuis le 1er janvier, un an, trois ans)', () => {
    const perf = (s: Societe, ref: number) => (s.cours['2026-11-23']! / ref - 1) * 100;
    expect(texte('l00e')).toContain(`la capitalisation atteint ${fr((SGBC.cours['2026-11-23']! * SGBC.titres) / 1e9, 1)} milliards`);
    expect(texte('l00d')).toContain(`le titre perd ${fr(-perf(ECOC, a(ECOC).cloture!), 2)} %`);
    expect(texte('l00g')).toContain(fr(perf(SNTS, SNTS.cours['2023-11-23']!), 1));
    expect(texte('l00g')).toContain(fr(perf(ORAC, ORAC.cours['2025-11-24']!), 1));
  });

  it('les graphiques réels reproduisent les séries des sources, années manquantes laissées vides', () => {
    const g = lecon('l00d').sections.flatMap((s) => s.graphiques);
    expect(g[0]!.series.map((x) => x.nom)).toEqual(['PNB', 'Résultat brut d’exploitation', 'Coût du risque', 'Résultat net']);
    expect(g[0]!.series[0]!.valeurs).toEqual(ANS.map((y) => a(ECOC, y).revenu));
    expect(g[0]!.series[3]!.valeurs).toEqual(ANS.map((y) => a(ECOC, y).rn));
    const per = lecon('l00g').sections.flatMap((s) => s.graphiques).find((c) => c.titre.startsWith('PER'))!;
    expect(per.series[1]!.valeurs[0]).toBeNull(); // ORAC n’était pas coté en 2021
    expect(per.series[0]!.valeurs).toEqual(ANS.map((y) => Number((a(SNTS, y).cloture! / a(SNTS, y).bpa).toFixed(2))));
  });

  it('corrections du cours source : solvabilité 11,5 %, Orange CI cotée fin 2022, part du groupe nommée', () => {
    const min = `${fr(SRC.bceao.solvabilite_minimum_pct, 1)} %`;
    expect(texte('l00c')).toContain(min);
    expect(texte('l00c')).not.toMatch(/minimum[^.]{0,60}12,5 %/);
    expect(texte('l00g')).not.toMatch(/cotée[^.]{0,30}2017/);
    expect(texte('l00g')).toMatch(/cotée à la BRVM depuis fin 2022/);
    expect(texte('l00g')).toMatch(/part du groupe/);
  });

  it('aucune formulation de conseil', () => {
    for (const [f, , brut] of MODULE0) {
      expect(brut, f).not.toMatch(/\b(achetez|vendez|conservez|à acheter|à vendre|objectif de cours de)\b/i);
      expect(brut, f).not.toMatch(/Why it matters/);
    }
  });

  it('aucun site d’information tiers cité, WESTBOURSE mis en avant (choix éditorial du 2026-11-24)', () => {
    for (const [f, , brut] of MODULE0) expect(brut, f).not.toMatch(/sika|rich ?bourse|stockanalysis|S&P|FGI|CGF|allAfrica|Daba/i);
    expect(readFileSync(`${DIR}sources/cours-complet-2026-11-23.json`, 'utf-8')).not.toMatch(/"tiers"|stockanalysis|sika_finance/i);
    const sources = lecon('l00a').sections.find((s) => s.titre.startsWith('Les sources'))!;
    expect(sources.etapes.map((e) => e.titre)).toContain('WESTBOURSE');
  });

  it('PER sur 12 mois glissants : exercice − période 2025 + période 2026', () => {
    const glissant = (s: Societe & { interim: Record<string, { rn: number }> }, p: string) => {
      const rn = a(s).rn - s.interim[`2025-${p}`]!.rn + s.interim[`2026-${p}`]!.rn;
      return fr(s.cours['2026-11-23']! / ((rn * 1e9) / s.titres), 2);
    };
    const S = SRC.societes as unknown as Record<string, Societe & { interim: Record<string, { rn: number }> }>;
    expect(texte('l00d')).toContain(`le PER glissant monte à ${glissant(S.ECOC!, 'S1')}`);
    expect(texte('l00g')).toContain(`Sur douze mois glissants : ${glissant(S.SNTS!, 'T3')}`);
  });

  it('dette nette et free cash flow de Sonatel 2025 : recalculés sur les comptes officiels relus sur le PDF', () => {
    const off = JSON.parse(readFileSync(`${DIR}sources/sonatel-2025.json`, 'utf-8')) as {
      bilan_passif: Record<string, number[]>; bilan_actif: Record<string, number[]>; flux_de_tresorerie: Record<string, number[]>;
    };
    const dettes = (off.bilan_passif['Passifs financiers non courants']![0]! + off.bilan_passif['Passifs financiers courants']![0]!) / 1000;
    const dispo = off.bilan_actif['Disponibilités et quasi-disponibilités']![0]! / 1000;
    expect(texte('l00b')).toContain(`sa dette financière nette est de ${fr(dettes - dispo, 1)} milliards, c’est-à-dire une trésorerie nette`);
    const fcf = (off.flux_de_tresorerie['Trésorerie générée par les activités d’exploitation']![0]! + off.flux_de_tresorerie['Acquisitions d’immobilisations corporelles et incorporelles']![0]!) / 1000;
    expect(texte('l00g')).toContain(`${fr(fcf, 1)} milliards de free cash flow en 2025`);
  });
});

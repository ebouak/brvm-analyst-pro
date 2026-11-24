import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageExiste } from '@/lib/routes/pageExiste';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Lesson } from '../types';
import { exemplesCours, lectureIndices } from '../donneesReelles';
import l1 from './lecon1-brvm.json';
import l2 from './lecon2-acteurs.json';
import l3 from './lecon3-budget.json';
import l4 from './lecon4-gagner.json';

/**
 * Leçons 1 à 4 du Niveau 1 (Module 1 : Comprendre la Bourse BRVM).
 * Enrichies le 2026-11-24 (plafonds relevés au standard des niveaux 3 et 4 :
 * 5 à 20 questions de quiz, paragraphes jusqu'à 650 caractères, graphiques
 * réels sourcés dans les sections, simulateurs interactifs et données BRVM
 * figées et vérifiées dans sources/niveau1-module1-2026-11-24.json).
 */
const LECONS: [number, unknown][] = [[1, l1], [2, l2], [3, l3], [4, l4]];
const parse = (brut: unknown): Lesson => lessonSchema.parse(brut);
const bonne = (l: Lesson, i: number) => l.quiz![i]!.options[l.quiz![i]!.correct];
const APP = fileURLToPath(new URL('../../../app/', import.meta.url));

describe.each(LECONS)('leçon %i — règles éditoriales', (n, brut) => {
  const l = parse(brut);
  const texte = JSON.stringify(brut);

  it('titre numéroté comme sa position dans le cours et module renseigné', () => {
    expect(l.titre.startsWith(`Leçon ${n} — `)).toBe(true);
    expect(l.module).toBe('Module 1 : Comprendre la Bourse BRVM');
    expect(l.nouveaute).toEqual({ type: 'mis_a_jour', depuis: '2026-11-24' });
  });

  it('au moins cinq questions valides (jusqu’à vingt) ; la question unique reprend la première', () => {
    expect(l.quiz!.length).toBeGreaterThanOrEqual(5);
    expect(l.quiz!.length).toBeLessThanOrEqual(20);
    for (const q of l.quiz!) expect(q.correct).toBeLessThan(q.options.length);
    expect(l.qcm).toEqual(l.quiz![0]);
  });

  it('avertissement, sous-titre et paragraphes lisibles (≤ 650 caractères)', () => {
    expect(l.avertissement).toContain('pas un conseil en investissement');
    expect(l.sous_titre).toBeTruthy();
    for (const s of l.sections) {
      for (const p of s.contenu.split(/\n+/)) {
        expect(p.length, `${l.titre} · ${s.titre}`).toBeLessThanOrEqual(650);
      }
    }
  });

  it('graphiques placés dans les sections ; tout cas ou graphique réel est sourcé', () => {
    expect(l.charts).toEqual([]);
    expect(l.chart ?? null).toBeNull();
    for (const s of l.sections) {
      if (s.reel) expect(s.donnees_reelles, s.titre).toBeTruthy();
      for (const g of s.graphiques) {
        if (g.reel) expect(g.note, `${l.titre} · ${g.titre}`).toMatch(/Sources? : .*(19|20)[0-9]{2}/);
        else expect(g.note.toLowerCase(), `${l.titre} · ${g.titre}`).toMatch(/exemple|pédagogique|hypothèse/);
      }
    }
  });

  it('ni témoignage inventé, ni site tiers, ni ancien nom du régulateur employé seul', () => {
    expect(texte).not.toMatch(/\b(M\.|Mme|Mlle) [A-ZÉ]/);
    expect(texte).not.toMatch(/[Tt]émoignage/);
    expect(texte).not.toMatch(/crepmf\.org|sika|rich ?bourse|stockanalysis/i);
    // « CREPMF » n'apparaît que pour dire que l'AMF-UMOA lui a succédé.
    for (const m of texte.matchAll(/CREPMF/g)) {
      expect(texte.slice(Math.max(0, m.index! - 80), m.index + 40), 'CREPMF hors contexte').toMatch(/succédé|ex-/);
    }
  });

  it('texte courant substantiel (au moins 4 000 caractères) et au moins un simulateur', () => {
    const total = l.sections.reduce((acc, s) => acc + s.contenu.length, 0);
    expect(total, l.titre).toBeGreaterThanOrEqual(4000);
    const nbSims = l.sections.reduce((acc, s) => acc + (s.simulation ? 1 : 0) + s.simulations.length, 0);
    expect(nbSims, l.titre).toBeGreaterThanOrEqual(1);
  });

  it('les liens « pratiquer » mènent à des pages qui existent', () => {
    for (const lien of l.liens) expect(pageExiste(APP, lien.href), lien.href).toBe(true);
  });
});

describe('réponses de calcul : la bonne option est bien le bon résultat', () => {
  it('leçon 3 — 10 × 2 500 + 1 % = 25 250 ; 1,5 % × 2 ≈ 3 % ; 1/5 de 50 000 × 20 % = 2 000', () => {
    expect(10 * 2500 * 1.01).toBe(25_250);
    expect(bonne(parse(l3), 0)).toBe('25 250 FCFA');
    expect(bonne(parse(l3), 1)).toBe('3 %');
    expect((50_000 / 5) * 0.2).toBe(2_000);
    expect(bonne(parse(l3), 3)).toBe('2 000 FCFA');
  });
  it('leçon 4 — (5 600 − 5 000) × 200 = 120 000 ; (80 000 + 120 000) ÷ 1 000 000 = 20 %', () => {
    expect((5600 - 5000) * 200).toBe(120_000);
    expect(bonne(parse(l4), 0)).toBe('120 000 FCFA');
    expect(((80_000 + 120_000) / 1_000_000) * 100).toBe(20);
    expect(bonne(parse(l4), 1)).toBe('20 %');
  });
});

describe('niveau 1, module 1 — chiffres vérifiés depuis la source (2026-11-24)', () => {
  const src = JSON.parse(
    readFileSync(fileURLToPath(new URL('./sources/niveau1-module1-2026-11-24.json', import.meta.url)), 'utf8'),
  ) as {
    marche: { nb_actions_cotees: number; capitalisation_totale_md: number; cours_median_fcfa: number; tranches_cours: { nb: number }[] };
    liquidite_65_seances: { capitaux_totaux_md: number; part_snts_pct: number; part_top5_pct: number; part_top10_pct: number };
    sgi: { nb_sgi_annuaire: number; nb_sgi_frais_base: number; nb_homologuees_base: number };
    ftsc_detachement_2025: { dividende_net_2024: number; seances: { date: string; cours: number }[] };
  };
  const fr = (n: number) => n.toFixed(1).replace('.', ',');
  const ent = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  it('leçon 1 reprend la capitalisation, les 48 valeurs et la concentration réelle de liquidité', () => {
    const t = JSON.stringify(l1);
    expect(t).toContain(`${src.marche.nb_actions_cotees} actions`);
    expect(t).toContain(`${ent(src.marche.capitalisation_totale_md)} Md FCFA`);
    expect(t).toContain(`${fr(src.liquidite_65_seances.part_snts_pct)} %`);
    expect(t).toContain(`${fr(src.liquidite_65_seances.part_top5_pct)} %`);
  });

  it('leçon 2 reprend les effectifs vérifiés de l’annuaire et des grilles SGI', () => {
    const t = JSON.stringify(l2);
    expect(t).toContain(`${src.sgi.nb_sgi_annuaire} SGI`);
    expect(t).toContain(`${src.sgi.nb_homologuees_base} grilles homologuées`);
  });

  it('leçon 3 reprend la médiane et les tranches réelles de cours des 48 actions', () => {
    const t = JSON.stringify(l3);
    expect(t).toContain(`${ent(src.marche.cours_median_fcfa)} FCFA`);
    const sous5000 = src.marche.tranches_cours[0]!.nb + src.marche.tranches_cours[1]!.nb;
    expect(t).toContain(`${sous5000} actions sur ${src.marche.nb_actions_cotees}`);
  });

  it('leçon 4 reprend le détachement réel Filtisac CI (26/09/2025) et le barème IRVM 2025', () => {
    const t = JSON.stringify(l4);
    const veille = src.ftsc_detachement_2025.seances.find((x) => x.date === '2025-09-25')!.cours;
    const jour = src.ftsc_detachement_2025.seances.find((x) => x.date === '2025-09-26')!.cours;
    expect(t).toContain(`${ent(veille)} FCFA`);
    expect(t).toContain(`${ent(jour)} FCFA`);
    expect(t).toContain('1 726,56 FCFA');
    expect(t).toContain('12 %');
  });
});

describe('données réelles : cours et indices', () => {
  const cot = [
    { code: 'AAAA', cours: 2500, date: '2026-11-12' },
    { code: 'BBBB', cours: 30000, date: '2026-11-13' },
  ];
  it('cours : coût de N actions, valeur sans cours nommée', () => {
    const r = exemplesCours(['AAAA', 'BBBB', 'CCCC'], { AAAA: 'Société A' }, cot, 10);
    expect(r.lignes.map((l) => [l.code, l.cout])).toEqual([['AAAA', 25_000], ['BBBB', 300_000]]);
    expect(r.lignes[0]!.nom).toBe('Société A');
    expect(r.manquants).toEqual(['CCCC']);
    expect(r.dateCours).toBe('2026-11-13');
  });
  it('cours : sans quantité, aucun coût inventé', () => {
    expect(exemplesCours(['AAAA'], {}, cot).lignes[0]!.cout).toBeNull();
  });
  it('indices : dernière valeur de chaque code, indice absent nommé', () => {
    const r = lectureIndices(['BRVMC', 'BRVM30', 'XXXX'], [
      { code: 'BRVMC', date_marche: '2026-11-12', libelle: 'BRVM Composite', valeur: 520, variation_pct: 0.1 },
      { code: 'BRVMC', date_marche: '2026-11-13', libelle: 'BRVM Composite', valeur: 530, variation_pct: 1.9 },
      { code: 'BRVM30', date_marche: '2026-11-13', libelle: 'BRVM 30', valeur: 0, variation_pct: null },
    ]);
    expect(r.lignes.map((l) => [l.code, l.valeur])).toEqual([['BRVMC', 530]]);
    expect(r.manquants).toEqual(['BRVM30', 'XXXX']);
  });
});

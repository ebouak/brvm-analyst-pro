import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Illustration from '@/components/academy/lecon/Illustration';
import {
  calculerAvantApres,
  calculerCascade,
  calculerEcheancier,
  couperLibelle,
  GABARITS,
  illustrationSchema,
  resumeIllustration,
  texteEquivalent,
  type Illustration as IllustrationT,
} from './illustrations';
import { lessonSchema, type Lesson } from './types';
import { calculerDps, calculerObligation, calculerOpcvm } from './simulateurs';

const EXEMPLES: Record<string, unknown> = {
  cascade: {
    gabarit: 'cascade', titre: 'Du chiffre d’affaires au résultat', note: 'Exemple fictif.', unite: 'Md FCFA',
    depart: { label: 'Chiffre d’affaires', valeur: 20 },
    etapes: [{ label: 'Charges', valeur: -15 }, { label: 'Produit exceptionnel', valeur: 1 }, { label: 'Impôt', valeur: -1.5 }],
    arrivee: 'Résultat net',
  },
  bilan: {
    gabarit: 'bilan', titre: 'Un bilan', note: 'Exemple fictif.', unite: 'Md FCFA',
    actif: [{ label: 'Immobilisations', valeur: 30 }, { label: 'Trésorerie', valeur: 10 }],
    passif: [{ label: 'Fonds propres', valeur: 15, nature: 'fonds_propres' }, { label: 'Dettes', valeur: 25, nature: 'dettes' }],
  },
  decomposition: {
    gabarit: 'decomposition', titre: 'P/B', note: 'Exemple fictif.', operation: 'produit',
    resultat: { label: 'P/B', valeur: 2.5 }, facteurs: [{ label: 'PER', valeur: 10 }, { label: 'ROE', valeur: 25, pourcentage: true }],
  },
  echeancier: {
    gabarit: 'echeancier', titre: 'Amorti', note: 'Exemple fictif.', unite: 'FCFA', nominal: 1_000_000, taux_pct: 6, annees: 5, mode: 'amortissable',
  },
  avant_apres: {
    gabarit: 'avant_apres', titre: 'Dilution', note: 'Exemple fictif.', unite: 'actions', part_du_premier: true,
    colonnes: [
      { label: 'Avant', segments: [{ label: 'Vos actions', valeur: 400 }, { label: 'Autres', valeur: 600 }] },
      { label: 'Après', segments: [{ label: 'Vos actions', valeur: 400 }, { label: 'Autres', valeur: 850 }] },
    ],
  },
};
const parse = (x: unknown) => illustrationSchema.parse(x);
const erreurs = (x: unknown) => {
  const r = illustrationSchema.safeParse(x);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};
const avec = (g: string, patch: Record<string, unknown>) => ({ ...(EXEMPLES[g] as object), ...patch });

describe('schéma de chaque gabarit', () => {
  it('un exemple valide par gabarit', () => {
    expect(Object.keys(EXEMPLES).sort()).toEqual([...GABARITS].sort());
    for (const g of GABARITS) expect(erreurs(EXEMPLES[g]), g).toEqual([]);
  });
  it('gabarit inconnu, note absente : refusés', () => {
    expect(erreurs({ ...(EXEMPLES.cascade as object), gabarit: 'camembert' }).length).toBeGreaterThan(0);
    expect(erreurs(avec('cascade', { note: '' })).length).toBeGreaterThan(0);
  });
  it('réel : source datée obligatoire ; fictif : pas de source', () => {
    expect(erreurs(avec('cascade', { reel: true }))).toContain('des chiffres réels exigent une source datée (au moins une année)');
    expect(erreurs(avec('cascade', { reel: true, source: 'Rapport annuel 2025' }))).toEqual([]);
    expect(erreurs(avec('cascade', { source: 'Rapport annuel 2025' }))).toContain('un exemple fictif ne cite pas de source');
  });
  it('cascade : un cumul négatif ou une étape nulle sont refusés', () => {
    expect(erreurs(avec('cascade', { etapes: [{ label: 'Pertes', valeur: -25 }] }))).toContain('le cumul d’une cascade ne passe pas sous zéro');
    expect(erreurs(avec('cascade', { etapes: [{ label: 'Rien', valeur: 0 }] })).length).toBeGreaterThan(0);
  });
  it('bilan : déséquilibré ou bloc minuscule refusés', () => {
    expect(erreurs(avec('bilan', { actif: [{ label: 'Immobilisations', valeur: 50 }] }))[0]).toMatch(/déséquilibré/);
    expect(
      erreurs(avec('bilan', { actif: [{ label: 'A', valeur: 39 }, { label: 'B', valeur: 1 }] })).some((m) => /trop petit/.test(m)),
    ).toBe(true);
  });
  it('décomposition : une égalité fausse est refusée, l’arrondi d’affichage toléré', () => {
    expect(erreurs(avec('decomposition', { resultat: { label: 'P/B', valeur: 3 } }))[0]).toMatch(/décomposition fausse/);
    const q = { gabarit: 'decomposition', titre: 'PER', note: 'n', operation: 'quotient', resultat: { label: 'PER', valeur: 13.3 }, facteurs: [{ label: 'Cours', valeur: 4000 }, { label: 'BPA', valeur: 300 }] };
    expect(erreurs(q)).toEqual([]);
    expect(erreurs({ ...q, facteurs: [...q.facteurs, { label: 'x', valeur: 1 }] })).toContain('un quotient a exactement deux termes');
    expect(erreurs({ ...q, facteurs: [{ label: 'Cours', valeur: 4000 }, { label: 'BPA', valeur: 0 }] })[0]).toMatch(/décomposition fausse/);
  });
  it('échéancier et avant/après : bornes', () => {
    expect(erreurs(avec('echeancier', { annees: 11 })).length).toBeGreaterThan(0);
    expect(erreurs(avec('echeancier', { mode: 'perpetuel' })).length).toBeGreaterThan(0);
    expect(erreurs(avec('avant_apres', { colonnes: [(EXEMPLES.avant_apres as { colonnes: unknown[] }).colonnes[0]] })).length).toBeGreaterThan(0);
  });
});

describe('calculs', () => {
  it('cascade : le total est calculé, jamais saisi', () => {
    const r = calculerCascade(parse(EXEMPLES.cascade) as Extract<IllustrationT, { gabarit: 'cascade' }>);
    expect(r.total).toBe(4.5);
    expect(r.max).toBe(20);
    expect(r.lignes.map((l) => l.nature)).toEqual(['depart', 'baisse', 'hausse', 'baisse', 'arrivee']);
    expect(r.lignes[1]).toMatchObject({ de: 5, a: 20 });
  });
  it('échéancier amortissable : celui du tableau de la leçon 9 du niveau 2', () => {
    const e = calculerEcheancier(parse(EXEMPLES.echeancier) as Extract<IllustrationT, { gabarit: 'echeancier' }>);
    expect(e.flux.map((f) => f.total)).toEqual([260000, 248000, 236000, 224000, 212000]);
    expect(e.totalCoupons).toBe(180000);
    expect(e.totalCapital).toBe(1_000_000);
  });
  it('échéancier in fine : coupons constants, nominal à la fin', () => {
    const e = calculerEcheancier(parse(avec('echeancier', { nominal: 10000, taux_pct: 6.5, mode: 'in_fine' })) as Extract<IllustrationT, { gabarit: 'echeancier' }>);
    expect(e.flux.map((f) => f.total)).toEqual([650, 650, 650, 650, 10650]);
  });
  it('avant/après : parts et couleurs stables par libellé', () => {
    const r = calculerAvantApres(parse(EXEMPLES.avant_apres) as Extract<IllustrationT, { gabarit: 'avant_apres' }>);
    expect(r.colonnes.map((c) => c.partPremierPct)).toEqual([40, 32]);
    expect(r.colonnes[1]!.segments.map((s) => s.teinte)).toEqual([0, 1]);
    expect(r.legende).toEqual(['Vos actions', 'Autres']);
  });
  it('texte équivalent et résumé reprennent chaque valeur', () => {
    const c = parse(EXEMPLES.cascade);
    expect(texteEquivalent(c)).toEqual([
      'Chiffre d’affaires : 20 Md FCFA',
      'Charges : − 15 Md FCFA',
      'Produit exceptionnel : + 1 Md FCFA',
      'Impôt : − 1,5 Md FCFA',
      'Résultat net : 4,5 Md FCFA',
    ]);
    expect(resumeIllustration(c)).toContain('4,5 Md FCFA');
    expect(texteEquivalent(parse(EXEMPLES.decomposition))[0]).toBe('P/B (2,5) = PER (10) × ROE (25 %)');
    expect(texteEquivalent(parse(EXEMPLES.avant_apres))[1]).toContain('vos actions : 32 %');
  });
  it('coupe un libellé en mots entiers', () => {
    expect(couperLibelle('Perte maximale (1 % du portefeuille)', 18)).toEqual(['Perte maximale (1', '% du portefeuille)']);
    expect(couperLibelle('PER', 18)).toEqual(['PER']);
    expect(couperLibelle('un deux trois quatre cinq six', 5, 2)).toEqual(['un', 'deux trois quatre cinq six']);
  });
});

describe('rendu de chaque gabarit', () => {
  for (const g of GABARITS) {
    it(g, () => {
      const ill = parse(EXEMPLES[g]);
      const html = renderToStaticMarkup(h(Illustration, { illustration: ill }));
      expect(html).not.toMatch(/NaN|Infinity|undefined/);
      expect(html).toContain('role="img"');
      expect(html).toContain(`aria-label="${resumeIllustration(ill).replace(/’/g, '’')}"`);
      expect(html).toContain('<svg');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('class="sr-only"');
      expect(html).toContain('Exemple fictif');
      for (const l of texteEquivalent(ill)) expect(html).toContain(l.replace(/&/g, '&amp;'));
    });
  }
  it('cascade : aucune liaison ne traverse une bande de texte (libellé ou montant)', () => {
    const html = renderToStaticMarkup(h(Illustration, { illustration: parse(EXEMPLES.cascade) }));
    const lignes = [...html.matchAll(/<line[^>]*y1="([\d.]+)" y2="([\d.]+)"[^>]*class="illu-liaison"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const textes = [...html.matchAll(/<text[^>]*y="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(lignes.length).toBeGreaterThan(0);
    for (const [a, b] of lignes) for (const t of textes) {
      // boîte d'un texte de 12,5 (ascendante et jambages compris), avec une marge
      expect(b <= t - 13 || a >= t + 5, `liaison ${a}→${b} sur le texte à ${t}`).toBe(true);
    }
  });
  it('chiffres réels : la source est affichée', () => {
    const html = renderToStaticMarkup(h(Illustration, { illustration: parse(avec('cascade', { reel: true, source: 'Rapport 2025', note: 'Chiffres de la banque.' })) }));
    expect(html).toContain('Chiffres publiés · Rapport 2025');
    expect(html).not.toContain('Exemple fictif');
  });
});

// ── Les visuels des leçons ──────────────────────────────────────────────────

const racine = join(__dirname, 'contenus');
const lecons: { fichier: string; lecon: Lesson }[] = [
  ...readdirSync(racine).filter((f) => f.endsWith('.json')),
  ...['niveau2', 'niveau3', 'niveau4'].flatMap((d) => readdirSync(join(racine, d)).filter((f) => f.endsWith('.json')).map((f) => `${d}/${f}`)),
].map((f) => ({ fichier: f, lecon: lessonSchema.parse(JSON.parse(readFileSync(join(racine, f), 'utf8'))) }));
for (const f of readdirSync(join(racine, 'autres')).filter((f) => f.endsWith('.json') && f !== 'colonnes.json')) {
  const c = JSON.parse(readFileSync(join(racine, 'autres', f), 'utf8')) as { lessons: unknown[] };
  c.lessons.forEach((l, i) => lecons.push({ fichier: `autres/${f}#${i}`, lecon: lessonSchema.parse(l) }));
}
const illustrations = lecons.flatMap(({ fichier, lecon }) =>
  lecon.sections.filter((s) => s.illustration).map((s) => ({ fichier, section: s.titre, ill: s.illustration!, lecon })),
);
const trouve = (fichier: string, section: string) => {
  const r = illustrations.find((x) => x.fichier === fichier && x.section === section);
  if (!r) throw new Error(`illustration absente : ${fichier} · ${section}`);
  return r.ill;
};

describe('chaque visuel de chaque leçon', () => {
  it('au moins une illustration dans chaque leçon d’analyse fondamentale du niveau 2 sauf la 5 et la 7', () => {
    for (const n of ['01', '02', '03', '04', '06', '08', '09', '10']) {
      expect(illustrations.some((x) => x.fichier.startsWith(`niveau2/l${n}`)), n).toBe(true);
    }
    expect(illustrations.length).toBeGreaterThanOrEqual(15);
  });
  it('passe le schéma, se rend sans valeur invalide, s’annonce comme exemple ou comme chiffre publié', () => {
    for (const { fichier, section, ill } of illustrations) {
      expect(illustrationSchema.safeParse(ill).success, `${fichier} · ${section}`).toBe(true);
      const html = renderToStaticMarkup(h(Illustration, { illustration: ill }));
      expect(html, `${fichier} · ${section}`).not.toMatch(/NaN|Infinity|undefined/);
      if (!ill.reel) expect(`${ill.titre} ${ill.note}`.toLowerCase(), `${fichier} · ${section}`).toMatch(/exemple|fictif|fictive|pédagogique|hypothèses/);
      else expect(ill.source, `${fichier} · ${section}`).toMatch(/20\d\d/);
    }
  });
  it('aucun conseil, aucune promesse de gain dans le texte des visuels', () => {
    const texte = JSON.stringify(illustrations.map((x) => x.ill)) + JSON.stringify(lecons.flatMap((l) => l.lecon.charts));
    expect(texte).not.toMatch(/achetez|vendez|conseil|recommand|garanti|à coup sûr|opportunit/i);
    expect(texte).not.toMatch(/\btu\b|\bton\b|\bta\b|\btes\b/);
  });
  it('un graphique de leçon est un exemple, ou une série HISTORIQUE datée et sourcée', () => {
    // Aucune donnée de marché « du jour » figée dans un graphique : elle serait périmée
    // à la séance suivante. Une série passée (comptes publiés, parcours 2016-2026)
    // ne se périme pas, à condition de dire sa source et son année.
    for (const { fichier, lecon } of lecons) {
      if (fichier.startsWith('autres/')) continue;
      for (const c of lecon.charts) if (c.reel) expect(c.note, fichier).toMatch(/Sources? : .*(19|20)[0-9]{2}/);
    }
  });

});

describe('les visuels concordent avec les simulateurs et le texte de leur leçon', () => {
  it('OPCVM : la cascade reproduit le simulateur (mêmes hypothèses, sans performance)', () => {
    const ill = trouve('niveau2/l10-opcvm.json', 'Ce que coûte un fonds') as Extract<IllustrationT, { gabarit: 'cascade' }>;
    const sim = calculerOpcvm({ montant: 1_000_000, annees: 5, frais_entree_pct: 2, frais_gestion_pct: 1.5, frais_sortie_pct: 0, performance_pct: 0 });
    expect(Math.abs(calculerCascade(ill).total - sim.valeurFinale)).toBeLessThan(1);
    expect(ill.note).toContain(`${Math.round(sim.totalFraisPct * 10) / 10}`.replace('.', ','));
  });
  it('DPS : la part conservée sans souscrire est celle du simulateur', () => {
    const ill = trouve('niveau2/l06-dps.json', 'Les trois choix de l’actionnaire') as Extract<IllustrationT, { gabarit: 'avant_apres' }>;
    const parts = calculerAvantApres(ill).colonnes.map((c) => c.partPremierPct);
    const sim = calculerDps({ cours: 6000, prix_emission: 4500, parite: 4, actions: 400 });
    expect(parts[1]! / parts[0]!).toBeCloseTo(sim.partConserveePct / 100, 6);
    expect(parts[2]).toBeCloseTo(parts[0]!, 6);
  });
  it('Obligation in fine : prix et coupons du simulateur de la leçon', () => {
    const l = lecons.find((x) => x.fichier === 'niveau2/l09-obligations.json')!.lecon;
    const s = l.sections.find((x) => x.titre === 'Prix, coupon couru et rendement')!;
    const ill = s.illustration as Extract<IllustrationT, { gabarit: 'echeancier' }>;
    expect(s.simulation).toMatchObject({ type: 'obligation', nominal: ill.nominal, taux_nominal_pct: ill.taux_pct, prix: ill.prix_achat, annees_restantes: ill.annees });
    const sim = calculerObligation({ nominal: 10000, taux_nominal_pct: 6.5, prix: 9800, annees_restantes: 5, jours_ecoules: 0, taux_marche_pct: 7 });
    // « le rendement réel dépasse donc le rendement courant » (note du schéma)
    expect(sim.rendementActuarielPct).toBeGreaterThan(sim.rendementCourantPct);
  });
  it('SIB 2025 : les chiffres de la cascade sont ceux de la leçon (stats et simulateur)', () => {
    const l = lecons.find((x) => x.fichier === 'niveau2/l04-banques.json')!.lecon;
    const s = l.sections.find((x) => x.titre === 'Un exemple publié : la SIB en 2025')!;
    const ill = s.illustration as Extract<IllustrationT, { gabarit: 'cascade' }>;
    expect(s.simulation).toMatchObject({ type: 'banque', pnb: ill.depart.valeur, frais_generaux: -ill.etapes[0]!.valeur, cout_risque: -ill.etapes[1]!.valeur });
    expect(calculerCascade(ill).total).toBe(55.6);
    expect(JSON.stringify(s.stats)).toContain('55,6 Md FCFA');
    expect(ill.reel).toBe(true);
  });
  it('Distribution : la cascade du rapport annuel arrive au résultat net du simulateur', () => {
    const l = lecons.find((x) => x.fichier === 'niveau2/l01-rapport-annuel.json')!.lecon;
    const s = l.sections.find((x) => x.titre === 'Le mécanisme : du chiffre d’affaires au dividende')!;
    const ill = s.illustration as Extract<IllustrationT, { gabarit: 'cascade' }>;
    expect(calculerCascade(ill).total * 1e9).toBe((s.simulation as { resultat_net: number }).resultat_net);
  });
});

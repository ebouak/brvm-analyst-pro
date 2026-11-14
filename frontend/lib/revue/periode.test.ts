import { describe, expect, it } from 'vitest';
import { periodePrincipale, chiffreGeantPeriode, constatPeriode, lignesComparaison, variationPct } from './periode';
import { dernierEvenementResultats, phraseMiseAJour } from './miseAJour';
import { lectureIntermediaire } from '@/lib/financials/interim';

const sp = (s: string | null) => s?.replace(/[  ]/g, ' ') ?? null;

const annuels = [
  { periode: '2025', revenu: 1000, resultatNet: 200 },
  { periode: '2024', revenu: 900, resultatNet: 160 },
];

describe('periodePrincipale', () => {
  it('ouvre sur l’intermédiaire postérieur au dernier exercice, comparé à la même période de l’an dernier', () => {
    const inter = lectureIntermediaire([
      { periode: '2025', revenu_total: 1000, resultat_net: 200 },
      { periode: '2026-T3', revenu_total: 800, resultat_net: 180 },
      { periode: '2025-T3', revenu_total: 700, resultat_net: 150 },
    ]);
    const p = periodePrincipale(annuels, inter)!;
    expect(p.type).toBe('intermediaire');
    expect(p.libelle).toBe('9 premiers mois de 2026');
    expect(p.comparable).toBe(true);
    expect(variationPct(p.resultatNet, p.resultatNetPrecedent)).toBeCloseTo(20, 5);
    expect(sp(constatPeriode(p))).toContain('résultat net +20,0');
  });

  it('un annuel plus récent que tout intermédiaire passe en premier', () => {
    const inter = lectureIntermediaire([
      { periode: '2025', revenu_total: 1000, resultat_net: 200 },
      { periode: '2025-S1', revenu_total: 500, resultat_net: 90 },
    ]);
    expect(inter).toBeNull();
    const p = periodePrincipale(annuels, inter)!;
    expect(p.type).toBe('annuel');
    expect(p.libelle).toBe('exercice 2025');
    expect(p.comparable).toBe(true);
  });

  it('période précédente manquante : on le dit, aucune évolution calculée', () => {
    const inter = lectureIntermediaire([
      { periode: '2025', revenu_total: 1000, resultat_net: 200 },
      { periode: '2026-S1', revenu_total: 500, resultat_net: 90 },
    ]);
    const p = periodePrincipale(annuels, inter)!;
    expect(p.comparable).toBe(false);
    expect(p.motif).toMatch(/ne sont pas disponibles/);
    expect(lignesComparaison(p).every((l) => l.evolution == null)).toBe(true);
    const g = chiffreGeantPeriode(p);
    expect(g.unite).not.toBe('%');
    expect(sp(constatPeriode(p))).not.toMatch(/%/);
  });

  it('annuel sans exercice précédent consécutif : non comparable (pas de saut d’année)', () => {
    const p = periodePrincipale([{ periode: '2025', revenu: 10, resultatNet: 1 }, { periode: '2022', revenu: 9, resultatNet: 1 }], null)!;
    expect(p.comparable).toBe(false);
    expect(p.motif).toContain('2024');
  });

  it('aucun compte : null', () => {
    expect(periodePrincipale([], null)).toBeNull();
    expect(periodePrincipale([{ periode: '2025', revenu: null, resultatNet: null }], null)).toBeNull();
  });
});

describe('chiffreGeantPeriode', () => {
  it('base négative : pas de pourcentage trompeur, repli sur le chiffre d’affaires', () => {
    const p = periodePrincipale(
      [{ periode: '2025', revenu: 120, resultatNet: 5 }, { periode: '2024', revenu: 100, resultatNet: -10 }], null)!;
    const g = chiffreGeantPeriode(p);
    expect(g.unite).toBe('%');
    expect(g.legende).toContain('chiffre d’affaires');
    expect(sp(g.valeur)).toBe('+20,0');
  });
  it('résultat net en baisse : signe moins typographique', () => {
    const p = periodePrincipale([{ periode: '2025', revenu: 100, resultatNet: 80 }, { periode: '2024', revenu: 100, resultatNet: 100 }], null)!;
    expect(chiffreGeantPeriode(p).valeur).toBe('−20,0');
  });
  it('aucun mot de recommandation dans les phrases produites', () => {
    const p = periodePrincipale(annuels, null)!;
    const t = [chiffreGeantPeriode(p).titre, chiffreGeantPeriode(p).legende, constatPeriode(p)].join(' ');
    expect(t).not.toMatch(/achat|vente|acheter|vendre|opportunit|objectif/i);
  });
});

describe('mise à jour dérivée', () => {
  it('prend la publication la plus récente', () => {
    const e = dernierEvenementResultats([
      { event_date: '2026-05-04', created_at: '2026-05-05T08:00:00Z' },
      { event_date: '2026-11-06', created_at: '2026-11-09T08:00:00Z' },
    ]);
    expect(phraseMiseAJour(e)).toBe('Mise à jour le 09/11/2026 suite à la publication du 06/11/2026.');
  });
  it('une ingestion antérieure à la publication est ramenée à la date de publication', () => {
    expect(phraseMiseAJour({ event_date: '2026-11-06', created_at: '2026-11-01T00:00:00Z' }))
      .toBe('Mise à jour le 06/11/2026 suite à la publication du 06/11/2026.');
  });
  it('sans événement : aucune mention', () => {
    expect(phraseMiseAJour(dernierEvenementResultats([]))).toBeNull();
  });
});

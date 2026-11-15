import { describe, it, expect } from 'vitest';
import {
  PANNEAUX, RUBRIQUES_BARRE, construirePanneaux, etatSeance, formaterDuree, codeContexte,
  apercuMarche, apercuRevenus, apercuPortefeuille, apercuIdee, apercuApprendre, formaterContexte,
  apercuAujourdhui, destinationsPouce, hrefPanneau, ligneAlertes, sansBarre, titreBrief,
} from './barreDeCote';
import { REGISTRE, RUBRIQUES } from './navRegistre';

const menu = REGISTRE.filter((e) => e.statut === 'menu');

describe('registre : champs de la barre de cote', () => {
  it('chaque entrée de menu porte une description de 3 à 6 mots et une colonne 1 ou 2', () => {
    for (const e of menu) {
      const mots = (e.description ?? '').trim().split(/\s+/).filter(Boolean);
      expect(mots.length, `description : ${e.chemin}`).toBeGreaterThanOrEqual(3);
      expect(mots.length, `description trop longue : ${e.chemin}`).toBeLessThanOrEqual(6);
      expect([1, 2], `colonne : ${e.chemin}`).toContain(e.colonne);
    }
  });
});

describe('panneaux dérivés du registre', () => {
  it('chaque entrée de menu apparaît dans un panneau, et un seul, une seule fois', () => {
    const vus = new Map<string, number>();
    for (const p of PANNEAUX) for (const col of p.colonnes) for (const l of col) vus.set(l.href, (vus.get(l.href) ?? 0) + 1);
    for (const e of menu) expect(vus.get(e.chemin), e.chemin).toBe(1);
    const groupes = REGISTRE.filter((e) => e.statut !== 'menu' && e.groupe);
    for (const e of groupes) expect(vus.get(e.chemin), e.chemin).toBe(1);
    expect(vus.size).toBe(menu.length + groupes.length);
  });

  it('groupe « Documents » du marché : dossiers, revues, événements, saison', () => {
    const marche = PANNEAUX.find((p) => p.id === 'marche')!;
    const docs = marche.colonnes.flat().filter((l) => l.groupe === 'Documents').map((l) => l.href);
    expect(docs).toEqual(['/rapports/dossiers', '/rapports/revues', '/dashboard/reports/events', '/rapports/saison']);
    // Un groupe est rangé en fin de colonne, jamais intercalé entre deux liens sans groupe.
    for (const col of marche.colonnes) {
      const i = col.findIndex((l) => l.groupe);
      if (i >= 0) expect(col.slice(i).every((l) => l.groupe)).toBe(true);
    }
  });

  it('une entrée groupée porte description (3 à 6 mots) et colonne', () => {
    for (const e of REGISTRE.filter((x) => x.groupe)) {
      const mots = (e.description ?? '').trim().split(/\s+/).filter(Boolean);
      expect(mots.length, e.chemin).toBeGreaterThanOrEqual(3);
      expect(mots.length, e.chemin).toBeLessThanOrEqual(6);
      expect([1, 2], e.chemin).toContain(e.colonne);
    }
  });

  it('Premium : compte gratuit renvoyé vers l’offre, visiteur et Premium en lien direct', () => {
    const l = { href: '/screener', premium: true };
    expect(hrefPanneau(l, { connecte: true, premium: false })).toBe('/premium/upgrade?from=%2Fscreener');
    expect(hrefPanneau(l, { connecte: true, premium: true })).toBe('/screener');
    expect(hrefPanneau(l, { connecte: false, premium: false })).toBe('/screener');
    expect(hrefPanneau({ href: '/actions', premium: false }, { connecte: true, premium: false })).toBe('/actions');
  });

  it('une entrée retirée du registre disparaît du panneau', () => {
    const sans = REGISTRE.filter((e) => e.chemin !== '/heatmap');
    const hrefs = construirePanneaux(sans).flatMap((p) => p.colonnes.flat()).map((l) => l.href);
    expect(hrefs).not.toContain('/heatmap');
    expect(hrefs).toContain('/actions');
  });

  it('les cellules de la barre, « Aujourd’hui » et le portefeuille couvrent les six rubriques', () => {
    const tous = new Set<string>([...RUBRIQUES_BARRE, 'aujourdhui', 'portefeuille']);
    expect([...tous].sort()).toEqual(RUBRIQUES.map((r) => r.id).sort());
  });

  it('marque le cadenas sur les entrées premium et range en deux colonnes', () => {
    const idee = PANNEAUX.find((p) => p.id === 'idee')!;
    expect(idee.colonnes[0].length).toBeGreaterThan(0);
    expect(idee.colonnes[1].length).toBeGreaterThan(0);
    expect(idee.colonnes.flat().find((l) => l.href === '/screener')?.premium).toBe(true);
  });
});

describe('état de séance', () => {
  // 2026-11-09 est un lundi
  it('séance ouverte : durée avant 16 h GMT', () => {
    const e = etatSeance(new Date('2026-11-09T14:48:00Z'));
    expect(e.ouverte).toBe(true);
    expect(e.libelle).toBe('Séance ouverte · clôture dans 1 h 12');
  });
  it('avant l’ouverture un jour de semaine', () => {
    const e = etatSeance(new Date('2026-11-09T07:00:00Z'));
    expect(e.ouverte).toBe(false);
    expect(e.libelle).toBe('Marché fermé · ouverture à 9 h GMT');
  });
  it('après la clôture du lundi au jeudi : demain', () => {
    expect(etatSeance(new Date('2026-11-10T17:00:00Z')).libelle).toBe('Marché fermé · prochaine séance demain');
  });
  it('vendredi soir et week-end : lundi', () => {
    for (const d of ['2026-11-13T17:00:00Z', '2026-11-14T10:00:00Z', '2026-11-15T10:00:00Z']) {
      expect(etatSeance(new Date(d)).libelle).toBe('Marché fermé · prochaine séance lundi');
    }
  });
  it('formaterDuree', () => {
    expect(formaterDuree(72)).toBe('1 h 12');
    expect(formaterDuree(60)).toBe('1 h');
    expect(formaterDuree(5)).toBe('5 min');
  });
});

describe('cellule de contexte', () => {
  it('reconnaît les sous-pages de /actions/[code]', () => {
    expect(codeContexte('/actions/snts/quant')).toBe('SNTS');
    expect(codeContexte('/actions/SNTS/financials')).toBe('SNTS');
  });
  it('absente sur la fiche elle-même : FicheStickyNav montre déjà le cours', () => {
    expect(codeContexte('/actions/SNTS')).toBeNull();
    expect(codeContexte('/actions/SNTS/')).toBeNull();
  });
  it('ignore les autres pages', () => {
    expect(codeContexte('/actions')).toBeNull();
    expect(codeContexte('/actions/compare')).toBeNull();
    expect(codeContexte('/societes/SNTS')).toBeNull();
    expect(codeContexte('/actions/<script>')).toBeNull();
  });
  it('formate un cours absent sans le remplacer par zéro', () => {
    expect(formaterContexte({ code: 'SNTS', cours: null, variation_pct: null })).toEqual({ cours: 'n.d.', variation: 'n.d.', sens: undefined });
  });
});

describe('aperçus (colonne vivante)', () => {
  it('marché : deux plus fortes hausses et deux plus fortes baisses, zéros exclus', () => {
    const a = apercuMarche([
      { code: 'AAA', variation_pct: 4 }, { code: 'BBB', variation_pct: 7.5 }, { code: 'CCC', variation_pct: 1 },
      { code: 'DDD', variation_pct: -3 }, { code: 'EEE', variation_pct: -9 }, { code: 'FFF', variation_pct: 0 },
      { code: 'GGG', variation_pct: null },
    ], '2026-11-13');
    expect(a.lignes.map((l) => l.texte)).toEqual(['BBB', 'AAA', 'EEE', 'DDD']);
    expect(a.lignes[0].detail).toBe('+7,50 %');
    expect(a.lignes[2].detail).toBe('−9,00 %');
    expect(a.titre).toContain('13/11/2026');
  });
  it('marché vide : aucune ligne, lien de repli conservé', () => {
    const a = apercuMarche([], null);
    expect(a.lignes).toEqual([]);
    expect(a.lien.href).toBe('/actions');
  });
  it('revenus : trois prochains détachements, passés écartés', () => {
    const a = apercuRevenus([
      { code: 'A', ex_date: '2026-11-01' }, { code: 'B', ex_date: '2026-11-20' }, { code: 'C', ex_date: '2026-11-16' },
      { code: 'D', ex_date: '2026-12-02' }, { code: 'E', ex_date: '2026-11-18' },
    ], '2026-11-14');
    expect(a.lignes.map((l) => l.texte)).toEqual(['C', 'E', 'B']);
  });
  it('idée : sans édition, seule la saisonnalité reste', () => {
    expect(apercuIdee(null).lignes.map((l) => l.texte)).toEqual(['Saisonnalité']);
    expect(apercuIdee('2026-11-07').lignes[0].href).toBe('/analyses/hebdo/2026-11-07');
  });
  it('apprendre : sans formation à venir, aucune ligne', () => {
    expect(apercuApprendre(null).lignes).toEqual([]);
  });
  it('apprendre connecté : la leçon en cours d’abord, numérotée à partir de 1', () => {
    const a = apercuApprendre({ titre: 'Conférence', date_evenement: '2026-11-20' }, { slug: 'bases', titreCours: 'Les bases', lessonIdx: 2 });
    expect(a.titre).toBe('Votre leçon en cours');
    expect(a.lignes[0]).toEqual({ texte: 'Reprendre : Les bases', detail: 'leçon 3', href: '/formations/academy/bases?lecon=3' });
    expect(a.lignes[1].texte).toBe('Conférence');
  });
  it('aujourd’hui : titre du dernier brief (celui de sa page) et sa tendance', () => {
    const a = apercuAujourdhui({ date: '2026-11-13', tendance: 'haussiere' }, null);
    expect(a.lignes[0].texte).toBe(titreBrief('2026-11-13'));
    expect(a.lignes[0].texte).toMatch(/^Brief de séance BRVM du 13 nov\.? 2026$/);
    expect(a.lignes[1].texte).toBe('Tendance haussière');
    expect(apercuAujourdhui({ date: '2026-11-13', tendance: 'inconnue' }, null).lignes).toHaveLength(1);
    expect(apercuAujourdhui(null, null).lignes).toEqual([]);
  });
  it('alertes actives : accord, zéro déclaré, lecture échouée = aucune ligne', () => {
    expect(ligneAlertes(1)?.texte).toBe('1 alerte active');
    expect(ligneAlertes(3)?.texte).toBe('3 alertes actives');
    expect(ligneAlertes(0)?.texte).toBe('Aucune alerte active');
    expect(ligneAlertes(null)).toBeNull();
    expect(apercuPortefeuille([], 2).lignes.map((l) => l.texte)).toEqual(['Aucune position enregistrée', '2 alertes actives']);
    expect(apercuPortefeuille([{ quantite: 1, cours: 100, variation_pct: 0 }], null).lignes.some((l) => /alerte/.test(l.texte))).toBe(false);
  });
  it('portefeuille : exclut et déclare les positions sans cours', () => {
    const a = apercuPortefeuille([
      { quantite: 10, cours: 1000, variation_pct: 10 },
      { quantite: 5, cours: null, variation_pct: null },
    ]);
    expect(a.lignes[0].texte).toBe('10 000 FCFA');
    expect(a.lignes[1].detail).toBe('+10,00 %');
    expect(a.lignes[2].texte).toContain('1 position sans cours');
  });
  it('portefeuille vide', () => {
    expect(apercuPortefeuille([]).lignes[0].texte).toBe('Aucune position enregistrée');
  });
  it('aucun libellé de signal d’achat ou de vente', () => {
    const tout = JSON.stringify([apercuMarche([{ code: 'A', variation_pct: 1 }], '2026-11-13'), apercuIdee('2026-11-07')]);
    expect(tout.toLowerCase()).not.toMatch(/acheter|vendre|\bbuy\b|\bsell\b/);
  });
});

describe('barre du bas (mobile)', () => {
  it('quatre destinations, chacune la première entrée de menu de sa rubrique', () => {
    expect(destinationsPouce()).toEqual([
      { rubrique: 'aujourdhui', href: '/dashboard', label: "Aujourd'hui" },
      { rubrique: 'marche', href: '/actions', label: 'Marché' },
      { rubrique: 'portefeuille', href: '/portefeuille', label: 'Portefeuille' },
      { rubrique: 'apprendre', href: '/formations', label: 'Apprendre' },
    ]);
  });
  it('suit le registre : une entrée retirée cède la place à la suivante', () => {
    const sans = REGISTRE.filter((e) => e.chemin !== '/actions');
    expect(destinationsPouce(sans)[1].href).not.toBe('/actions');
  });
});

describe('pages sans barre', () => {
  it('widgets, console, authentification, impression, lecteur de leçon', () => {
    for (const p of ['/embed/ticker', '/admin', '/admin/qualite', '/login', '/signup', '/crm/opposition', '/offre/dossier',
      '/actions/SNTS/print', '/formations/academy/les-bases']) expect(sansBarre(p), p).toBe(true);
  });
  it('partout ailleurs, Dossier et relevé compris (barre masquée à l’impression)', () => {
    for (const p of ['/', '/dashboard', '/actions', '/actions/SNTS', '/societes/SNTS', '/formations/academy',
      '/formations/academy/examen/n1', '/formations/academy/lecon-0', '/rapports/dossier/SNTS', '/rapports/releve/abc',
      '/loginx', '/embedded', '/pricing']) expect(sansBarre(p), p).toBe(false);
  });
});

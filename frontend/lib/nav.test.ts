import { describe, it, expect } from 'vitest';
import { isNavItemActive, construireFil, NAV_GROUPS, PALETTE_EXTRA, MENU_COMPTE } from './nav';
import { pagesDuDisque } from './navPagesDuDisque';

describe('isNavItemActive : la page OU un de ses parents', () => {
  const cas: [string, string, boolean][] = [
    // Sous-pages d'onglets (P1-2)
    ['/actualites', '/veille', true],
    ['/actualites', '/weekly', true],
    ['/actualites', '/weekly/thesis', true],
    ['/fondamentaux', '/notations', true],
    ['/premium/valorisation', '/premium/dcf', true],
    ['/premium/valorisation', '/premium/dcf/SNTS', true],
    ['/calendrier', '/premium/calendrier', true],
    ['/reports', '/premium/reports', true],
    ['/reports', '/dashboard/reports', true],
    ['/reports', '/dashboard/reports/instrument/SNTS', true],
    // Le tableau de bord ne s'allume pas sur les rapports (parent = Rapports)
    ['/dashboard', '/dashboard/reports', false],
    ['/dashboard', '/dashboard/personnaliser', true],
    // Comparateur SGI (P1-3)
    ['/comparateur-sgi', '/comparateur-sgi/annuaire/images-finances', true],
    ['/comparateur-sgi', '/comparateur-sgi/simuler', true],
    // Pages dynamiques
    ['/actions', '/actions/SNTS', true],
    ['/actions', '/actions/SNTS/financials', true],
    ['/actions', '/rapports/dossier/SNTS', true],
    ['/actions', '/actions/compare', true],
    ['/societes', '/societes/SNTS', true],
    ['/actions', '/societes/SNTS', false],
    // Pas d'allumage par simple préfixe
    ['/simulateur', '/simulateur-budget', true], // parent déclaré
    ['/screener', '/scanner', true],
    ['/conseiller', '/conseiller/track-record', true],
    ['/signaux', '/screener', false],
    // Query ignorée
    ['/dividendes', '/dividendes/calendrier?annee=2025', true],
    // Console admin (hors registre) : ancienne règle
    ['/admin', '/admin', true],
    ['/admin', '/admin/cles-api', false],
  ];
  for (const [href, pathname, attendu] of cas) {
    it(`${href} sur ${pathname} → ${attendu}`, () => {
      expect(isNavItemActive(href, pathname)).toBe(attendu);
    });
  }
});

describe('construireFil', () => {
  it('page de premier niveau : un seul maillon, rubrique connue', () => {
    const f = construireFil('/actualites')!;
    expect(f.rubrique).toBe("Aujourd'hui");
    expect(f.maillons).toEqual([{ libelle: 'Actualités', href: null }]);
  });

  it("onglet : parent cliquable, page courante non cliquable", () => {
    const f = construireFil('/veille')!;
    expect(f.maillons).toEqual([
      { libelle: 'Actualités', href: '/actualites' },
      { libelle: 'Veille', href: null },
    ]);
  });

  it('page dynamique : la valeur réelle du code, jamais inventée', () => {
    const f = construireFil('/actions/SNTS/financials')!;
    expect(f.rubrique).toBe('Le marché');
    expect(f.maillons).toEqual([
      { libelle: 'Actions', href: '/actions' },
      { libelle: 'SNTS', href: '/actions/SNTS' },
      { libelle: 'États financiers', href: null },
    ]);
  });

  it('dossier A4 rattaché à la fiche', () => {
    const f = construireFil('/rapports/dossier/SNTS')!;
    expect(f.maillons.map((m) => m.href)).toEqual(['/actions', '/actions/SNTS', null]);
    expect(f.maillons[2].libelle).toBe('Dossier A4');
  });

  it('libellé fourni par la page pour le dernier maillon', () => {
    const f = construireFil('/societes/SNTS', 'SONATEL')!;
    expect(f.maillons).toEqual([
      { libelle: 'Sociétés cotées', href: '/societes' },
      { libelle: 'SONATEL', href: null },
    ]);
  });

  it('sans libellé ni paramètre utile : le libellé du modèle de route', () => {
    const f = construireFil('/actualites/un-article-quelconque')!;
    expect(f.maillons[1]).toEqual({ libelle: 'Article', href: null });
  });

  it('paramètre encodé décodé (secteur)', () => {
    const f = construireFil('/dashboard/reports/sector/Consommation%20de%20base')!;
    expect(f.maillons[f.maillons.length - 1].libelle).toBe('Consommation de base');
    expect(f.maillons[0]).toEqual({ libelle: 'Rapports', href: '/reports' });
  });

  it('route statique prioritaire sur la dynamique', () => {
    const f = construireFil('/actions/compare')!;
    expect(f.maillons.map((m) => m.libelle)).toEqual(['Actions', 'Comparer des actions']);
  });

  it('compte : sans rubrique', () => {
    const f = construireFil('/account/billing')!;
    expect(f.rubrique).toBeNull();
    expect(f.maillons).toEqual([
      { libelle: 'Mon compte', href: '/parametres/compte' },
      { libelle: 'Facturation', href: null },
    ]);
  });

  it("sortie d'impression : pas de fil", () => {
    expect(construireFil('/actions/SNTS/print')!.sansFil).toBe(true);
  });

  it('adresse inconnue : null', () => {
    expect(construireFil('/admin/users')).toBeNull();
    expect(construireFil('/nexiste/pas/du/tout')).toBeNull();
  });
});

describe('menus dérivés du registre', () => {
  const surDisque = new Set(pagesDuDisque());

  it('le menu a exactement six rubriques, dans l’ordre de la spec', () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      "Aujourd'hui", 'Le marché', 'Trouver une idée', 'Mes revenus', 'Mon portefeuille', 'Apprendre',
    ]);
  });

  it('chaque entrée du menu correspond à une page', () => {
    for (const g of NAV_GROUPS) for (const it of g.items) expect(surDisque.has(it.href), it.href).toBe(true);
  });

  it('chaque entrée du menu du compte correspond à une page', () => {
    for (const it of MENU_COMPTE) expect(surDisque.has(it.href), it.href).toBe(true);
  });

  it('la palette : sans doublon, sans page du menu, rien que des pages réelles', () => {
    const menu = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
    const vus = new Set<string>();
    for (const it of PALETTE_EXTRA) {
      expect(menu.has(it.href), `${it.href} est à la fois au menu et en secondaire`).toBe(false);
      expect(vus.has(it.href)).toBe(false);
      expect(surDisque.has(it.href), it.href).toBe(true);
      vus.add(it.href);
    }
  });

  it('Premium est une marque sur l’entrée, pas une rubrique', () => {
    const prem = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.premium).map((i) => i.href).sort();
    expect(prem).toEqual(['/assistant', '/premium/classements', '/premium/diagnostic', '/premium/outils', '/premium/paper-trading', '/premium/valorisation']);
  });
});


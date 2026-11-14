import { describe, it, expect } from 'vitest';
import { executerOrdre, type NiveauCarnet, type OrdreAchat } from './carnet';
import { carnetDepuisLigne } from './carnetReel';

const CARNET: NiveauCarnet[] = [
  { prix: 3280, quantite: 3500 },
  { prix: 3290, quantite: 4500 },
  { prix: 3300, quantite: 5500 },
];
const ordre = (o: Partial<OrdreAchat>): OrdreAchat => ({
  sens: 'achat', quantite: 5000, limite: 'au_mieux', condition: 'sans', validite: 'jour', ...o,
});

describe('executerOrdre — exemples de la leçon 6', () => {
  it('au mieux 5 000 : 3 500 à 3 280 + 1 500 à 3 290, prix moyen 3 283', () => {
    const r = executerOrdre(CARNET, ordre({}));
    expect(r.statut).toBe('execute');
    expect(r.lignes).toEqual([
      { prix: 3280, quantite: 3500, montant: 11_480_000 },
      { prix: 3290, quantite: 1500, montant: 4_935_000 },
    ]);
    expect(r.prixMoyen).toBe(3283);
    expect(r.coutTotal).toBe(16_415_000);
    expect(r.reliquat).toBe(0);
  });

  it('limité à 3 270 : aucun vendeur à ce prix, rien n’est exécuté, l’ordre attend selon sa validité', () => {
    const r = executerOrdre(CARNET, ordre({ limite: { prix: 3270 }, validite: 'mensuel' }));
    expect(r.statut).toBe('non_execute');
    expect(r.quantiteServie).toBe(0);
    expect(r.prixMoyen).toBeNull();
    expect(r.reliquat).toBe(5000);
    expect(r.explication).toContain('mensuel');
  });

  it('tout ou rien 10 000 limités à 3 290 : 8 000 disponibles, rien n’est servi', () => {
    const r = executerOrdre(CARNET, ordre({ quantite: 10_000, limite: { prix: 3290 }, condition: 'tout_ou_rien' }));
    expect(r.statut).toBe('non_execute');
    expect(r.quantiteServie).toBe(0);
    expect(r.explication.replace(/\s/g, ' ')).toContain('8 000');
  });

  it('limité à 3 290 pour 5 000 : 3 500 à 3 280 + 1 500 à 3 290', () => {
    const r = executerOrdre(CARNET, ordre({ limite: { prix: 3290 } }));
    expect(r.lignes.map((l) => [l.prix, l.quantite])).toEqual([[3280, 3500], [3290, 1500]]);
    expect(r.statut).toBe('execute');
  });
});

describe('executerOrdre — règles du règlement', () => {
  it('une limite n’est jamais dépassée ; le reliquat reste au carnet selon la validité', () => {
    const r = executerOrdre(CARNET, ordre({ quantite: 20_000, limite: { prix: 3290 } }));
    expect(r.lignes.every((l) => l.prix <= 3290)).toBe(true);
    expect(r.quantiteServie).toBe(8000);
    expect(r.statut).toBe('partiel');
    expect(r.reliquat).toBe(12_000);
    expect(r.explication).toContain('restent au carnet');
  });

  it('un ordre sans limite indiquée est rejeté (art. 44)', () => {
    expect(executerOrdre(CARNET, ordre({ limite: null })).statut).toBe('rejete');
    expect(executerOrdre(CARNET, ordre({ limite: undefined })).statut).toBe('rejete');
  });

  it('quantité nulle, négative ou décimale : rejetée ; limite à zéro : rejetée', () => {
    for (const q of [0, -5, 2.5]) expect(executerOrdre(CARNET, ordre({ quantite: q })).statut).toBe('rejete');
    expect(executerOrdre(CARNET, ordre({ limite: { prix: 0 } })).statut).toBe('rejete');
  });

  it('tout ou rien servi si la quantité est disponible', () => {
    const r = executerOrdre(CARNET, ordre({ quantite: 8000, limite: { prix: 3290 }, condition: 'tout_ou_rien' }));
    expect(r.statut).toBe('execute');
    expect(r.quantiteServie).toBe(8000);
  });

  it('les niveaux sont parcourus du moins cher au plus cher même désordonnés', () => {
    const r = executerOrdre([CARNET[2]!, CARNET[0]!, CARNET[1]!], ordre({ quantite: 3600 }));
    expect(r.lignes.map((l) => l.prix)).toEqual([3280, 3290]);
  });

  it('carnet vide : rien n’est exécuté', () => {
    expect(executerOrdre([], ordre({})).statut).toBe('non_execute');
  });
});

describe('executerOrdre — carnet réel (meilleure limite seule)', () => {
  const reel = (o: Partial<Parameters<typeof carnetDepuisLigne>[0]> = {}) =>
    carnetDepuisLigne({
      code: 'SNTS', date_marche: '2026-11-06', designation: 'SONATEL', qte_achat: 100, cours_achat: 25_000,
      qte_vente: 1200, cours_vente: 25_050, achat_au_marche: false, vente_au_marche: false, cours_reference: 25_000, ...o,
    });

  it('la quantité au-delà de la meilleure limite est « inconnue », jamais exécutée', () => {
    const c = reel();
    const r = executerOrdre(c.niveaux, ordre({ quantite: 5000 }), { profondeurInconnue: c.profondeurInconnue });
    expect(r.statut).toBe('partiel');
    expect(r.quantiteServie).toBe(1200);
    expect(r.quantiteInconnue).toBe(3800);
    expect(r.reliquat).toBe(0);
  });

  it('tout ou rien au-delà du visible : indéterminé, rien d’exécuté', () => {
    const c = reel();
    const r = executerOrdre(c.niveaux, ordre({ quantite: 5000, condition: 'tout_ou_rien' }), { profondeurInconnue: true });
    expect(r.statut).toBe('indetermine');
    expect(r.quantiteServie).toBe(0);
  });

  it('un côté vente « au marché » n’a pas de prix : on ne l’invente pas', () => {
    const c = reel({ vente_au_marche: true, cours_vente: null });
    expect(c.niveaux).toEqual([{ prix: null, quantite: 1200 }]);
    const r = executerOrdre(c.niveaux, ordre({ quantite: 100 }), { profondeurInconnue: true });
    expect(r.statut).toBe('indetermine');
    expect(r.prixMoyen).toBeNull();
    expect(r.niveauxSansPrix).toBe(1);
    expect(r.explication).toContain('sans cours');
  });

  it('pas de quantité à la vente : aucun niveau', () => {
    expect(reel({ qte_vente: null, cours_vente: null }).niveaux).toEqual([]);
    expect(reel({ qte_vente: 0 }).niveaux).toEqual([]);
  });

  it('limite sous la meilleure limite : indéterminé', () => {
    const c = reel();
    const r = executerOrdre(c.niveaux, ordre({ limite: { prix: 24_000 } }), { profondeurInconnue: true });
    expect(r.statut).toBe('indetermine');
  });
});

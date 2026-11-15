import { describe, expect, it } from 'vitest';
import { illustrationCascade } from './cascade';
import { calculerCascade, illustrationSchema } from '@/lib/academy/illustrations';
import type { LectureBancaire, LigneAgregat, Unite } from './lecture';

const src = { document_url: 'https://x/a.pdf', document_libelle: 'États financiers 2025', page: 12 };
const l = (cle: LigneAgregat['cle'], v: number, unite: Unite = 'fcfa', perimetre: 'individuel' | 'consolide' | 'non_precise' = 'individuel'): LigneAgregat =>
  ({ cle, libelle: cle, unite, valeur: { valeur: v, perimetre, unite, source: src }, precedent: null, cloture: null });
const lecture = (cr: LigneAgregat[]) => ({ compteResultat: cr, libelle: 'exercice 2025', sources: [src] } as unknown as LectureBancaire);

describe('illustrationCascade : gabarit « cascade » de l’Academy', () => {
  const base = [l('pnb', 300e9), l('charges_exploitation', 150e9), l('cout_du_risque', 20e9), l('resultat_net', 95e9, 'fcfa', 'non_precise')];

  it('PNB → charges → coût du risque → autres éléments et impôt → résultat net ; le total calculé égale le résultat net publié', () => {
    const ill = illustrationCascade(lecture(base))!;
    expect(illustrationSchema.safeParse(ill).success).toBe(true);
    expect(ill.gabarit).toBe('cascade');
    if (ill.gabarit !== 'cascade') return;
    expect(ill.depart).toEqual({ label: 'Produit net bancaire', valeur: 300 });
    expect(ill.etapes).toEqual([
      { label: 'Charges d’exploitation', valeur: -150 },
      { label: 'Coût du risque', valeur: -20 },
      { label: 'Autres éléments et impôt', valeur: -35 },
    ]);
    expect(ill.arrivee).toBe('Résultat net');
    expect(calculerCascade(ill).total).toBe(95);
    expect(ill.unite).toBe('Md FCFA');
    expect(ill.reel).toBe(true);
    expect(ill.source).toMatch(/2025/);
  });

  it('une reprise nette de provisions (coût du risque négatif) est un ajout', () => {
    const ill = illustrationCascade(lecture([l('pnb', 300e9), l('charges_exploitation', 150e9), l('cout_du_risque', -5e9), l('resultat_net', 120e9)]))!;
    if (ill.gabarit !== 'cascade') throw new Error('gabarit');
    expect(ill.etapes[1]).toEqual({ label: 'Coût du risque', valeur: 5 });
  });

  it('marche « autres » nulle : retirée', () => {
    const ill = illustrationCascade(lecture([l('pnb', 300e9), l('charges_exploitation', 150e9), l('cout_du_risque', 20e9), l('resultat_net', 130e9)]))!;
    if (ill.gabarit !== 'cascade') throw new Error('gabarit');
    expect(ill.etapes.map((e) => e.label)).toEqual(['Charges d’exploitation', 'Coût du risque']);
  });

  it('USD : l’unité suit la source, sans conversion', () => {
    const usd = [l('pnb', 1.2e9, 'usd'), l('charges_exploitation', 0.8e9, 'usd'), l('cout_du_risque', 0.1e9, 'usd'), l('resultat_net', 0.2e9, 'usd')];
    expect(illustrationCascade(lecture(usd))!.unite).toBe('Md USD');
  });

  it('jamais reconstituée : un maillon manquant, des unités mêlées ou deux périmètres → null', () => {
    expect(illustrationCascade(lecture(base.filter((x) => x.cle !== 'cout_du_risque')))).toBeNull();
    expect(illustrationCascade(lecture([l('pnb', 1.2e9, 'usd'), l('charges_exploitation', 0.8e9, 'usd'), l('cout_du_risque', 0.1e9, 'usd'), l('resultat_net', 95e9)]))).toBeNull();
    expect(illustrationCascade(lecture([l('pnb', 300e9, 'fcfa', 'consolide'), l('charges_exploitation', 150e9), l('cout_du_risque', 20e9), l('resultat_net', 95e9)]))).toBeNull();
  });

  it('une perte qui ferait passer le cumul sous zéro : le gabarit refuse, null (grille de mesures à la place)', () => {
    expect(illustrationCascade(lecture([l('pnb', 100e9), l('charges_exploitation', 90e9), l('cout_du_risque', 40e9), l('resultat_net', -35e9)]))).toBeNull();
  });
});

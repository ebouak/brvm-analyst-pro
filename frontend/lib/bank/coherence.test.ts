import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const racine = path.resolve(__dirname, '../../..');
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8');

describe('lecture bancaire : une seule source', () => {
  it('la copie du scraper est identique octet pour octet', () => {
    expect(lire('scraper/src/bank/pure/lecture.ts')).toBe(lire('frontend/lib/bank/lecture.ts'));
  });
});

import { periodesDepuisLignes, lireBanque, type LigneComptesBancaire } from './lecture';
import { appliquerLecture } from './lectureKpis';
import { trajectoireBancaire, pnbParExercice } from './dossierBancaire';
import { illustrationCascade } from './cascade';
import { calculerCascade } from '@/lib/academy/illustrations';
import type { BankKpis } from './kpis';

const s = { document_url: 'https://x/a.pdf', document_libelle: 'États financiers 2025', page: 12, perimetre: 'individuel' as const };
const lg = (periode: string, v: Record<string, number>, extra: Partial<LigneComptesBancaire> = {}): LigneComptesBancaire =>
  ({ periode, lignes_specifiques: v, sources_specifiques: Object.fromEntries(Object.keys(v).map((k) => [k, s])), ...extra });

/** Trois banques témoins : complète, partielle, sans extraction. */
const BANQUES: Record<string, { income: LigneComptesBancaire[]; balance: LigneComptesBancaire[] }> = {
  SGBC: {
    income: [lg('2025', { pnb: 300e9, charges_exploitation: 150e9, resultat_brut_exploitation: 150e9, cout_du_risque: 20e9 }, { resultat_net: 95e9 }), lg('2024', { pnb: 280e9 }, { resultat_net: 80e9 })],
    balance: [lg('2025', { credits_clientele: 2900e9, depots_clientele: 3600e9, fonds_propres: 600e9, ratio_solvabilite: 14.39 })],
  },
  SIBC: { income: [lg('2025', { pnb: 120e9 }, { resultat_net: 40e9 })], balance: [] },
  CBIBF: { income: [{ periode: '2025', lignes_specifiques: { pnb: 90e9 }, sources_specifiques: null, resultat_net: 30e9 }], balance: [] },
};

describe('cohérence : le même chiffre sur chaque surface', () => {
  for (const [code, b] of Object.entries(BANQUES)) {
    it(code, () => {
      const periodes = periodesDepuisLignes(b.income, b.balance);
      const visee = { annee: 2025, code: 'exercice' as const };
      // Revue (période principale = exercice 2025), fiche, financials, dossier : même appel, même résultat.
      const revue = lireBanque(periodes, visee);
      const fiche = lireBanque(periodes, visee);
      expect(fiche).toEqual(revue);
      const pnbLecture = revue?.extrait ? revue.compteResultat.find((x) => x.cle === 'pnb')?.valeur.valeur ?? null : null;
      // Dossier : la trajectoire porte le PNB retenu de la lecture.
      const traj = trajectoireBancaire([{ exercice: '2025', chiffre_affaires: 1, resultat_net: 1 }], pnbParExercice(periodes));
      expect(traj[0]!.chiffre_affaires).toBe(pnbLecture ?? 1);
      // Carte bancaire : même coefficient que la lecture (et aucun autre).
      const coef = revue?.extrait ? revue.ratios.find((r) => r.cle === 'coefficient_exploitation')?.valeur ?? null : null;
      const k = appliquerLecture({ costIncome: 0.99, transformation: null, ratioSolvabilite: null } as unknown as BankKpis, revue?.extrait ? revue : null);
      expect(k.costIncome).toBe(coef);
      // Dossier et Revue, cascade : départ = PNB, total calculé = résultat net de la lecture.
      const casc = revue?.extrait ? illustrationCascade(revue) : null;
      if (casc && casc.gabarit === 'cascade') {
        expect(casc.depart.valeur * 1e9).toBe(pnbLecture);
        expect(calculerCascade(casc).total * 1e9).toBeCloseTo(revue!.compteResultat.find((x) => x.cle === 'resultat_net')!.valeur.valeur, -3);
      }
    });
  }

  it('aucune surface ne recalcule : chacune passe par lireBanque', () => {
    for (const f of [
      'frontend/app/actions/[code]/revue/page.tsx',
      'frontend/app/societes/[code]/page.tsx',
      'frontend/app/actions/[code]/financials/page.tsx',
      'frontend/lib/dossier/build.ts',
      'frontend/app/api/diagnostic/[code]/route.ts',
      'scraper/src/articles/runArticles.ts',
    ]) {
      const t = lire(f);
      expect(t, f).toContain('lireBanque(');
      expect(t, f).not.toMatch(/charges_exploitation\s*\/|\/\s*[a-zA-Z.?]*pnb\b/);
    }
  });
});

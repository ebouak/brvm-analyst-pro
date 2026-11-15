import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { periodesDepuisLignes, lireBanque, type LigneComptesBancaire } from './lecture';
import { montantLigne } from './format';
import { illustrationCascade } from './cascade';
import { CompteResultatBancaire, EncoursBancaire } from '@/components/bank/LectureRevue';
import TableauLecture from '@/components/bank/TableauLecture';

/**
 * Avenant du 2026-11-15 : ETIT publie en USD et s'affiche en USD. Ce test
 * ÉCHOUE si une surface écrit un montant USD suivi de « FCFA ». Il conditionne
 * l'ouverture du verrou ECRITURE_USD_AUTORISEE (scraper/src/agregats/ecritures.ts).
 */
const src = { document_url: 'https://x/etit-s1.pdf', document_libelle: 'ETI, rapport S1 2026', page: 4, perimetre: 'consolide' as const };
const usd = (periode: string, v: Record<string, number>): LigneComptesBancaire =>
  ({ periode, lignes_specifiques: v, sources_specifiques: Object.fromEntries(Object.keys(v).map((k) => [k, { ...src, unite: k === 'ratio_solvabilite' ? 'pct' as const : 'usd' as const }])) });

// Tout en USD, aucun montant de la base (résultat net en FCFA) : « FCFA » ne doit apparaître nulle part.
const lecture = lireBanque(periodesDepuisLignes(
  [usd('2026-S1', { pnb: 1.2e9, charges_exploitation: 0.84e9, cout_du_risque: 0.1e9 }), usd('2025-S1', { pnb: 1.1e9, charges_exploitation: 0.8e9 })],
  [usd('2026-S1', { credits_clientele: 15e9, depots_clientele: 20e9, fonds_propres: 2.5e9, ratio_solvabilite: 13.1 }), usd('2025-S1', { credits_clientele: 14e9 })],
), { annee: 2026, code: 'S1' })!;

const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[  ]/g, ' ');

describe('USD : aucune surface n’écrit « FCFA » à côté d’un montant en dollars', () => {
  it('la lecture est extraite et en USD', () => {
    expect(lecture.extrait).toBe(true);
    expect(lecture.compteResultat.every((l) => l.unite === 'usd')).toBe(true);
  });

  it('formateur commun', () => {
    expect(montantLigne(1.2e9, 'usd')).toMatch(/USD$/);
    expect(montantLigne(1.2e9, 'usd')).not.toMatch(/FCFA/);
    expect(montantLigne(300e9, 'fcfa')).toMatch(/FCFA$/);
  });

  it('Revue : compte de résultat et encours', () => {
    for (const C of [CompteResultatBancaire, EncoursBancaire]) {
      const t = texte(renderToStaticMarkup(createElement(C, { lecture })));
      expect(t).toMatch(/USD/);
      expect(t).not.toMatch(/FCFA/);
    }
  });

  it('fiche et carte bancaire', () => {
    const t = texte(renderToStaticMarkup(createElement(TableauLecture, { lecture })));
    expect(t).toMatch(/1,20 Md USD/);
    expect(t).not.toMatch(/FCFA/);
  });

  it('cascade (dossier et Revue) : unité de la source', () => {
    const avecRn = lireBanque(periodesDepuisLignes(
      [usd('2026-S1', { pnb: 1.2e9, charges_exploitation: 0.84e9, cout_du_risque: 0.1e9 })],
      [],
    ), { annee: 2026, code: 'S1' })!;
    // Sans résultat net en USD, pas de cascade (jamais USD et FCFA mêlés).
    expect(illustrationCascade(avecRn)).toBeNull();
  });

  it('aucune surface ne colle « FCFA » derrière une valeur de la lecture', () => {
    const racine = path.resolve(__dirname, '../..');
    for (const f of [
      'app/actions/[code]/revue/page.tsx',
      'app/societes/[code]/page.tsx',
      'app/rapports/dossier/[code]/page.tsx',
      'components/bank/LectureRevue.tsx',
      'components/bank/TableauLecture.tsx',
      'components/financials/BankScorecard.tsx',
    ]) {
      const t = readFileSync(path.join(racine, f), 'utf8');
      // Une valeur de lib/bank/lecture.ts (`.valeur.valeur`, lPnb, lRn, pnbLecture) passe par montantLigne.
      expect(t, f).not.toMatch(/(valeur\.valeur|lPnb|lRn|pnbLecture)[^\n;]{0,60}FCFA/);
    }
  });
});

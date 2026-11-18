import { describe, expect, it } from 'vitest';
import { construireNarratif } from './narratif';
import { construireSquelette } from './prose';
import { piliersThese } from './suivi';
import { controlerDossier } from './controles';
import { declarationEssentiel, constatIntermediaire } from '@/lib/document/constats';
import { fluxCompteResultat } from '@/lib/fiche/flux';
import { ligneSika } from '@/lib/fiche/comptesIfrs';

/**
 * Une banque n'a pas de chiffre d'affaires : son revenu est le produit net
 * bancaire. Toute phrase du dossier dérivée de la famille comptable le dit ;
 * une non-banque garde ses libellés AU CARACTÈRE PRÈS (le `fait` du narratif
 * entre dans l'empreinte de la prose polie : un caractère changé écarterait
 * toutes les proses déjà validées des non-banques).
 */

const CA = /chiffre d.affaires/i;

function dossier(famille: 'banque' | 'assurance' | 'general', croissance: number) {
  const d = {
    genere_le: '2026-11-17',
    identite: { code: 'TEST', designation: 'TEST SA', secteur: null, pays: null, taux_irvm: null, actions: null, flottant: null, notation: null },
    chiffres_cles: {
      exercice: '2025', cours: null, date_cours: null, variation_veille_pct: null, capitalisation: null,
      chiffre_affaires: 100e9, resultat_net: 20e9, capitaux_propres: null, dette: null, dette_perimetre: null, tresorerie: null,
      croissance_ca_1an: croissance, croissance_ca_2ans: 5, variation_capitaux_propres_1an: null,
    },
    trajectoire: [],
    dividende: { montant: null, base_fiscale: null, source: null, exercice: null, ex_date: null, payment_date: null, rendement: null, payout: null, historique: [], exercices_sans_dividende: 0 },
    detachement: null,
    technique: { date_signal: null, signal: null, score_total: null, confiance: null, explication: null, rsi: null, ma20: null, ma50: null, macd_line: null, macd_signal: null, serie: [] },
    ratios: null,
    qualite_resultat: null,
    rentabilite_actif: null,
    niveaux: null,
    lacunes: [],
    suivi: {
      famille, intermediaire: null,
      performance: { var_1m: null, var_ytd: null, position_52s: null, haut52: null, bas52: null },
      liquidite: null, medianes: null, piliers: [], rendez_vous: [], ex_date_controle: null, comparables_nommes: [],
    },
    per_glissant: null, bande_per: null, placement: null, reactions: null, historique_publications: [], nb_publications: null,
    banque: null,
  };
  return d as unknown as Parameters<typeof construireNarratif>[0];
}

const textes = (d: ReturnType<typeof dossier>) => {
  const n = construireNarratif(d);
  return [...n.forces, ...n.risques].flatMap((a) => [a.texte, a.fait]);
};

describe('narratif : vocabulaire du revenu', () => {
  it('banque en progression : produit net bancaire, jamais chiffre d’affaires', () => {
    const t = textes(dossier('banque', 0.12));
    expect(t.join(' ')).not.toMatch(CA);
    expect(t).toContain('un produit net bancaire en progression');
    expect(t.some((x) => x.startsWith('Produit net bancaire en progression : +12,0 %'))).toBe(true);
  });
  it('banque en recul : produit net bancaire, jamais chiffre d’affaires', () => {
    const t = textes(dossier('banque', -0.2));
    expect(t.join(' ')).not.toMatch(CA);
    expect(t).toContain('un produit net bancaire en recul');
  });
  it('non-banque : libellés inchangés au caractère près', () => {
    for (const famille of ['general', 'assurance'] as const) {
      expect(textes(dossier(famille, 0.12))).toContain("un chiffre d'affaires en progression");
      expect(textes(dossier(famille, 0.12))).toContain("Chiffre d'affaires en progression : +12,0 %");
      expect(textes(dossier(famille, -0.2))).toContain("un chiffre d'affaires en recul");
    }
  });
});

describe('squelette de prose', () => {
  it('banque : aucune occurrence, et une empreinte nouvelle (la prose polie déjà rangée est écartée)', () => {
    const b = dossier('banque', 0.12);
    const g = dossier('general', 0.12);
    const sb = construireSquelette(b, construireNarratif(b));
    const sg = construireSquelette(g, construireNarratif(g));
    expect(sb.sections.map((s) => s.texte).join(' ')).not.toMatch(CA);
    expect(sb.sections[0]!.texte).toMatch(/un produit net bancaire en progression/);
    expect(sg.sections[0]!.texte).toMatch(/un chiffre d'affaires en progression/);
    expect(sb.empreinte).not.toBe(sg.empreinte);
  });
});

describe('piliers de suivi', () => {
  const entree = { croissanceCA: 0.1, margeExp: null, margeExpPrecedente: null, roe: null, endettement: null, dividendes: [], per: null, perMediane: null };
  it('banque : croissance du produit net bancaire', () => {
    const p = piliersThese({ famille: 'banque', ...entree }).find((x) => x.cle === 'croissance')!;
    expect(p.libelle).toBe('Croissance du produit net bancaire');
    expect(p.seuil).toBe('Produit net bancaire du dernier exercice en hausse sur un an.');
  });
  it('non-banque : inchangé', () => {
    for (const famille of ['general', 'assurance'] as const) {
      const p = piliersThese({ famille, ...entree }).find((x) => x.cle === 'croissance')!;
      expect(p.libelle).toBe('Croissance du chiffre d’affaires');
      expect(p.seuil).toBe('Chiffre d’affaires du dernier exercice en hausse sur un an.');
    }
  });
});

describe('contrôle de cohérence', () => {
  it('banque : la croissance anormale est nommée produit net bancaire', () => {
    const a = controlerDossier(dossier('banque', 3));
    expect(a.join(' ')).toMatch(/Croissance du produit net bancaire sur un an de 300 %/);
    expect(a.join(' ')).not.toMatch(CA);
  });
  it('non-banque : inchangé', () => {
    expect(controlerDossier(dossier('general', 3)).join(' ')).toMatch(/Croissance du chiffre d’affaires sur un an de 300 %/);
  });
});

describe('couverture et « L’essentiel »', () => {
  const e = { societe: 'BANQUE SA', exercice: '2025', ca: 100e9, caPrecedent: 90e9, resultatNet: 20e9, resultatNetPrecedent: 18e9 };
  it('déclaration : produit net bancaire pour une banque, inchangée sinon', () => {
    expect(declarationEssentiel(e, 'produit net bancaire')).toMatch(/de produit net bancaire \(\+11,1\s%\)/);
    expect(declarationEssentiel(e, 'produit net bancaire')).not.toMatch(CA);
    expect(declarationEssentiel(e)).toMatch(/FCFA de chiffre d’affaires \(\+11,1\s%\)/);
  });
  it('constat intermédiaire : libellé transmis', () => {
    const i = { libelle: '9 premiers mois de 2026', periodePrecedente: '2025-9M', revenu: 110, revenuPrecedent: 100, resultatNet: 12, resultatNetPrecedent: 10 };
    expect(constatIntermediaire(i, 'produit net bancaire')).toMatch(/^Sur les 9 premiers mois de 2026 : produit net bancaire \+10,0\s%/);
    expect(constatIntermediaire(i)).toMatch(/chiffre d’affaires \+10,0\s%/);
  });
});

describe('page financials : flux et comparaison Sika', () => {
  it('le nœud de revenu du flux prend le libellé donné', () => {
    const p = { chiffreAffaires: 100, resultatExploitation: 40, resultatAvantImpot: 40, resultatNet: 30 };
    expect(fluxCompteResultat({ ...p, libelleRevenu: 'Produit net bancaire' })!.ressources[0]!.libelle).toBe('Produit net bancaire');
    expect(fluxCompteResultat(p)!.ressources[0]!.libelle).toBe("Chiffre d'affaires");
  });
  it('Sika : le poste chiffre_affaires se nomme produit net bancaire pour une banque', () => {
    const c = { referentiel_sika: 'IFRS', consulte_le: null, postes: [{ poste: 'chiffre_affaires', sika: 100e9, ecart: 0, comparable: true }] };
    expect(ligneSika(c as never, true)).toMatch(/produit net bancaire 100,00 Md FCFA/);
    expect(ligneSika(c as never, true)).not.toMatch(CA);
    expect(ligneSika(c as never)).toMatch(/chiffre d'affaires 100,00 Md FCFA/);
  });
});

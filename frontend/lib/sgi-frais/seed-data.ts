import type { SgiFrais } from './types';

/**
 * Jeu de données de démarrage — niveau 'agrege_public' pour toutes les lignes
 * (source SikaFinance, recoupement partiel RichBourse, consulté 2026-07-01).
 * Aucune valeur inventée : les champs non trouvés publiquement (frais_virement,
 * minimum_perception pour la plupart) restent `null` — l'utilisateur les
 * saisit lui-même pour lancer le calcul (badge 'saisie_utilisateur').
 *
 * `sgiNom` doit correspondre EXACTEMENT aux noms de components/landing/SgiComparator.tsx.
 * Note : la source Sika nomme la SGI béninoise « BIBE Finance & Securities »,
 * quand l'annuaire du produit l'a pour l'instant en placeholder « SGI Bénin »
 * — voir `notes` sur cette ligne. Pas de renommage de l'annuaire (hors scope).
 */

const SOURCE_URL = 'https://www.sikafinance.com/sgi_de_la_brvm';
const SOURCE_LABEL = 'SikaFinance — Liste des SGI de la BRVM';
const VERIFIE_LE = '2026-07-01';

function base(partial: Partial<SgiFrais> & { sgiNom: string }): SgiFrais {
  return {
    sgiNom: partial.sgiNom,
    courtagePctMin: partial.courtagePctMin ?? null,
    courtagePctMax: partial.courtagePctMax ?? null,
    minimumPerception: partial.minimumPerception ?? null,
    droitsGardePctMin: partial.droitsGardePctMin ?? null,
    droitsGardePctMax: partial.droitsGardePctMax ?? null,
    droitsGardeFrequence: partial.droitsGardeFrequence ?? null,
    droitsGardeMinimum: partial.droitsGardeMinimum ?? null,
    tenueCompteMontant: partial.tenueCompteMontant ?? null,
    tenueCompteFrequence: partial.tenueCompteFrequence ?? null,
    fraisVirement: partial.fraisVirement ?? null,
    depotMinimum: partial.depotMinimum ?? null,
    gestionSousMandatPctMin: partial.gestionSousMandatPctMin ?? null,
    gestionSousMandatPctMax: partial.gestionSousMandatPctMax ?? null,
    confiance: partial.confiance ?? 'agrege_public',
    sourceUrl: partial.sourceUrl ?? SOURCE_URL,
    sourceLabel: partial.sourceLabel ?? SOURCE_LABEL,
    verifieLe: partial.verifieLe ?? VERIFIE_LE,
    notes: partial.notes ?? null,
  };
}

export const SGI_FRAIS_SEED: SgiFrais[] = [
  base({ sgiNom: 'EDC Investment Corporation', courtagePctMax: 1.0, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 2500, tenueCompteFrequence: 'trimestriel', depotMinimum: 1_000_000 }),
  base({
    sgiNom: 'SOGEBOURSE',
    courtagePctMax: 0.8,
    minimumPerception: 1000,
    droitsGardePctMin: 0.26,
    droitsGardePctMax: 0.5,
    droitsGardeFrequence: 'trimestriel',
    droitsGardeMinimum: 2500,
    tenueCompteMontant: 0,
    tenueCompteFrequence: 'annuel',
    depotMinimum: 500_000,
    confiance: 'homologue_crepmf',
    sourceUrl: null,
    sourceLabel: 'Grille officielle SGI, Annexe III Tarification (réf. CREPMF 15/12/009/97)',
    verifieLe: '2026-07-02',
    notes: 'Correction 2026-07-02 (grille officielle, lue par vision IA) : les droits de garde sont UNE seule ligne trimestrielle avec un plancher intégré de 2 500 FCFA/trimestre (≤10M FCFA) ou 0,26%/trimestre (>10M FCFA) — pas deux lignes séparées "conservation annuelle" + "tenue de compte trimestrielle" comme précédemment estimé (source agrégée SikaFinance). Palier par montant non modélisé : borne max (0,5%) retenue par prudence.',
  }),
  base({
    sgiNom: 'BSIC Capital SA',
    courtagePctMin: 0.8,
    courtagePctMax: 0.81,
    droitsGardePctMin: 0.0625,
    droitsGardePctMax: 0.125,
    droitsGardeFrequence: 'trimestriel',
    tenueCompteMontant: 2500,
    tenueCompteFrequence: 'trimestriel',
    gestionSousMandatPctMin: 0.5,
    gestionSousMandatPctMax: 0.5,
    depotMinimum: 500_000,
    confiance: 'homologue_crepmf',
    sourceUrl: null,
    sourceLabel: 'Décision PAMF-UMOA/2024/163 du 26/06/2024, lue par vision IA',
    verifieLe: '2026-07-02',
    notes: 'Conservation à 3 paliers non modélisés (0,125%/trim ≤10M FCFA, 0,08%/trim >10M FCFA, 0,0625%/trim titres non cotés) — borne max retenue par prudence, borne min = palier titres non cotés. Frais de transfert de titres (25 000-34 000 FCFA/ligne) et de nantissement (10 000 FCFA/ligne) hors périmètre du calculateur (opérations ponctuelles, pas des frais récurrents de courtage/garde/tenue). Dépôt minimum sourcé RichBourse (non issu de la décision elle-même).',
  }),
  base({ sgiNom: 'Atlantique Finance', courtagePctMin: 0.65, courtagePctMax: 1.0, minimumPerception: 15_625, droitsGardePctMin: 0.3, droitsGardePctMax: 0.5, droitsGardeFrequence: 'trimestriel', tenueCompteMontant: 15_625, tenueCompteFrequence: 'annuel', depotMinimum: 2_000_000 }),
  base({ sgiNom: 'BNI Finances', courtagePctMax: 1.0, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 2000, tenueCompteFrequence: 'annuel', depotMinimum: 1_000_000 }),
  base({ sgiNom: 'BOA Capital Securities', courtagePctMin: 0.4, courtagePctMax: 1.0, droitsGardePctMin: 0.1, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 5000, tenueCompteFrequence: 'annuel', depotMinimum: 0 }),
  base({ sgiNom: 'BICI Bourse', courtagePctMax: 1.0, droitsGardePctMax: 0.3, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 0 }),
  base({ sgiNom: 'Bridge Securities', courtagePctMax: 1.0, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 2500, tenueCompteFrequence: 'trimestriel', depotMinimum: 250_000 }),
  base({ sgiNom: 'NSIA Finance', courtagePctMax: 1.0, droitsGardePctMin: 0.22, droitsGardePctMax: 0.27, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 500_000 }),
  base({ sgiNom: 'Hudson & Cie', courtagePctMax: 1.0, droitsGardePctMax: 0.25, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 500_000 }),
  base({ sgiNom: 'Phoenix Capital Management', courtagePctMax: 1.0, droitsGardePctMax: 0.25, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 200_000 }),
  base({ sgiNom: 'Sirius Capital', courtagePctMax: 1.0, droitsGardePctMax: 0.25, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 0 }),
  base({ sgiNom: 'Africaine de Bourse', courtagePctMax: 1.0, droitsGardePctMax: 0.4, droitsGardeFrequence: 'annuel', tenueCompteMontant: 25_000, tenueCompteFrequence: 'annuel', depotMinimum: 1_000_000 }),
  base({ sgiNom: 'CGF Bourse', courtagePctMax: 1.0, droitsGardePctMax: 0.25, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 0 }),
  base({ sgiNom: 'Impaxis Securities', courtagePctMax: 0.8, minimumPerception: 2000, droitsGardePctMax: 0.05, droitsGardeFrequence: 'trimestriel', tenueCompteMontant: 2000, tenueCompteFrequence: 'annuel', depotMinimum: 250_000, notes: 'Décision d\'homologation CREPMF individuelle localisée sur brvm.org mais non encore dépouillée — candidate prioritaire pour passer en niveau "homologue_crepmf" (voir /admin/sgi-frais).' }),
  base({ sgiNom: 'Everest Finance', courtagePctMax: 0.9, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 0 }),
  base({ sgiNom: 'Invictus Capital & Finance', courtagePctMax: 1.0, droitsGardePctMax: 0.25, droitsGardeFrequence: 'annuel', tenueCompteMontant: 1500, tenueCompteFrequence: 'trimestriel', depotMinimum: 0 }),
  base({ sgiNom: 'Coris Bourse', courtagePctMax: 1.0, droitsGardePctMin: 0.3, droitsGardePctMax: 0.5, droitsGardeFrequence: 'trimestriel', tenueCompteMontant: 2500, tenueCompteFrequence: 'trimestriel', depotMinimum: 100_000 }),
  base({ sgiNom: 'SBIF', courtagePctMin: 0.2, courtagePctMax: 1.0, droitsGardePctMin: 0.1, droitsGardePctMax: 0.2, droitsGardeFrequence: 'annuel', tenueCompteMontant: 2000, tenueCompteFrequence: 'annuel', depotMinimum: 68_000 }),
  base({ sgiNom: 'SGI Mali', courtagePctMax: 1.0, droitsGardePctMax: 0.5, droitsGardeFrequence: 'annuel', tenueCompteMontant: 15_500, tenueCompteFrequence: 'annuel', depotMinimum: 50_000, notes: 'Tenue de compte rapportée entre 12 500 et 15 500 FCFA/an — borne haute retenue.' }),
  base({ sgiNom: 'SGI Bénin', courtagePctMax: 1.0, droitsGardePctMin: 0.25, droitsGardePctMax: 0.35, droitsGardeFrequence: 'annuel', tenueCompteMontant: 1000, tenueCompteFrequence: 'annuel', depotMinimum: 100_000, notes: 'La source Sika nomme cette SGI « BIBE Finance & Securities » — l\'annuaire du produit utilise le placeholder « SGI Bénin ». À réconcilier si confirmé (hors scope de cette migration).' }),
  base({ sgiNom: 'SGI Togo', courtagePctMax: 1.0, droitsGardePctMax: 0.3, droitsGardeFrequence: 'annuel', tenueCompteMontant: 0, tenueCompteFrequence: 'annuel', depotMinimum: 0, notes: 'Décision d\'homologation CREPMF individuelle localisée sur brvm.org mais non encore dépouillée — candidate prioritaire pour passer en niveau "homologue_crepmf" (voir /admin/sgi-frais).' }),
  base({ sgiNom: 'SGI Niger', courtagePctMax: 1.0, droitsGardePctMax: 0.25, droitsGardeFrequence: 'annuel', tenueCompteMontant: 1500, tenueCompteFrequence: 'trimestriel', depotMinimum: 0 }),
];

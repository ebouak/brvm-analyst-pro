import type { SgiFrais } from './types';

/**
 * Commissions réglementaires BRVM + DC/BR — constante GLOBALE non nullable,
 * identique pour toutes les SGI (source officielle directe, niveau A par
 * nature) : https://www.brvm.org/fr/node/312 — « Les commissions revenant à
 * la BRVM et au Dépositaire Central / Banque de Règlement (DC/BR) sont
 * actuellement 0.2% et 0.1% du montant de la transaction, payables par
 * l'Acheteur et par le Vendeur. » Vérifié 2026-07-01.
 */
export const BRVM_DCBR_PCT = 0.3; // 0,2% + 0,1%, par ordre (achat ou vente)

const FREQ_MULT: Record<string, number> = { annuel: 1, trimestriel: 4, semestriel: 2 };

export interface CoutSGIInput {
  montant: number;
  nbOrdres: number; // achats + ventes sur la période
  dureeAns: number;
}

export interface CoutSGIResult {
  sgiNom: string;
  coutCourtage: number;
  coutReglementaire: number;
  coutGarde: number;
  coutTenue: number;
  coutVirement: number;
  total: number;
  pctCapital: number;
  champsManquants: string[]; // ex. ['frais_virement'] — signalés, jamais silencieux
}

/**
 * Calcule le coût total détaillé (5 composantes) d'une SGI pour un montant,
 * un nombre d'ordres et une durée donnés. Fonction pure, testable.
 *
 * Principe de prudence : quand une fourchette existe (min/max), la borne MAX
 * est utilisée (ne jamais sous-estimer un coût). Un champ manquant compte
 * pour 0 dans le calcul ET est signalé dans `champsManquants` — jamais
 * silencieusement ignoré.
 */
export function calculerCoutSGI(sgi: SgiFrais, input: CoutSGIInput): CoutSGIResult {
  const { montant, nbOrdres, dureeAns } = input;
  const champsManquants: string[] = [];

  // 1) Courtage — le minimum de perception agit comme un plancher qui
  // remplace le courtage proportionnel si celui-ci est plus faible.
  const courtagePct = sgi.courtagePctMax ?? sgi.courtagePctMin;
  if (courtagePct == null) champsManquants.push('courtage');
  const courtageParOrdre = courtagePct != null ? montant * (courtagePct / 100) : 0;
  const planchePerception = sgi.minimumPerception ?? 0;
  const coutCourtage = Math.max(courtageParOrdre, planchePerception) * nbOrdres;

  // 2) Frais réglementaires BRVM/DC-BR — constante, toujours appliquée.
  const coutReglementaire = montant * (BRVM_DCBR_PCT / 100) * nbOrdres;

  // 3) Droits de garde (conservation) — sur la durée de détention. Un
  // plancher par période (`droitsGardeMinimum`) agit comme le minimum de
  // perception du courtage : il remplace le taux proportionnel s'il est
  // plus élevé (ex. Sogebourse : 2 500 FCFA/trimestre plancher intégré).
  const gardePct = sgi.droitsGardePctMax ?? sgi.droitsGardePctMin;
  if (gardePct == null) champsManquants.push('droits_garde');
  const gardeMult = sgi.droitsGardeFrequence ? (FREQ_MULT[sgi.droitsGardeFrequence] ?? 1) : 1;
  const gardeParPeriode = gardePct != null ? montant * (gardePct / 100) : 0;
  const gardePlancher = sgi.droitsGardeMinimum ?? 0;
  const coutGarde = Math.max(gardeParPeriode, gardePlancher) * gardeMult * dureeAns;

  // 4) Tenue de compte — forfait, sur la durée.
  if (sgi.tenueCompteMontant == null) champsManquants.push('tenue_compte');
  const tenueMult = sgi.tenueCompteFrequence ? (FREQ_MULT[sgi.tenueCompteFrequence] ?? 1) : 1;
  const coutTenue = (sgi.tenueCompteMontant ?? 0) * tenueMult * dureeAns;

  // 5) Frais de virement — quasi jamais publiés, souvent absents.
  if (sgi.fraisVirement == null) champsManquants.push('frais_virement');
  const coutVirement = sgi.fraisVirement ?? 0;

  const total = coutCourtage + coutReglementaire + coutGarde + coutTenue + coutVirement;
  const pctCapital = montant > 0 ? (total / montant) * 100 : 0;

  return {
    sgiNom: sgi.sgiNom,
    coutCourtage,
    coutReglementaire,
    coutGarde,
    coutTenue,
    coutVirement,
    total,
    pctCapital,
    champsManquants,
  };
}

export interface SeuilRentabiliteResult {
  sgiNom: string;
  seuilPct: number; // % de hausse du cours nécessaire pour que l'aller-retour soit à l'équilibre
  coutAllerRetour: number; // FCFA (courtage + réglementaire, achat + vente)
}

/**
 * Seuil de rentabilité d'un aller-retour simple (1 achat + 1 vente au même
 * montant) : le % de hausse du cours nécessaire pour couvrir courtage +
 * frais réglementaires des deux opérations. N'inclut PAS la garde/tenue de
 * compte (frais de détention, hors périmètre d'un aller-retour ponctuel).
 */
export function calculerSeuilRentabilite(sgi: SgiFrais, montant: number): SeuilRentabiliteResult {
  const r = calculerCoutSGI(sgi, { montant, nbOrdres: 2, dureeAns: 0 });
  const coutAllerRetour = r.coutCourtage + r.coutReglementaire;
  const seuilPct = montant > 0 ? (coutAllerRetour / montant) * 100 : 0;
  return { sgiNom: sgi.sgiNom, seuilPct, coutAllerRetour };
}

/** Alerte si le montant saisi est inférieur au dépôt minimum exigé par la SGI. */
export function estSousDepotMinimum(sgi: SgiFrais, montant: number): boolean {
  return sgi.depotMinimum != null && montant < sgi.depotMinimum;
}

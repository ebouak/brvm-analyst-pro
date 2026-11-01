/**
 * État de paiement PAR PERSONNE — PUR. Le CRM ne modifie jamais
 * `billing_transactions` : il lit les paiements du compte et en DÉRIVE un état.
 * Un paiement confirmé (ou Premium) retire la personne de toute relance ; une
 * intention manuelle récente se VÉRIFIE (la personne a peut-être payé par
 * Mobile Money), elle ne se relance pas.
 *
 * Arbitrage de la spec : « paid récent » et « paid récent mais pas Premium »
 * se recouvraient. Le cas spécifique l'emporte : sans Premium, un paiement
 * confirmé de moins de 35 jours est une CONTRADICTION (activation manquée ?)
 * que l'exploitant doit voir — la classer « converti » la cacherait.
 */
import type { Dossier, Paiement } from './types';
import { fmtJour, fmtMontant, compareIso } from './score';

export const JOURS_VERIF = 30;
export const JOURS_PAYE = 35;

export type EtatPaiement = 'paye' | 'a_verifier' | 'abandonne' | 'expire' | 'aucun';
export interface EnCours { montant: number; devise: string; date: string; provider: string }
export interface ResultatPaiement { etat: EtatPaiement; detail: string; doublons: string[]; enCours: EnCours | null }

const JOUR_MS = 86_400_000;
const age = (iso: string, maintenant: Date) => (maintenant.getTime() - Date.parse(iso)) / JOUR_MS;
const dateDe = (p: Paiement) => (p.statut === 'paid' ? p.payeLe ?? p.date : p.date);
const plusRecent = (ps: readonly Paiement[]): Paiement | undefined => [...ps].sort((a, b) => compareIso(dateDe(b), dateDe(a)))[0];
const enCoursDe = (p: Paiement | undefined): EnCours | null => (p ? { montant: p.montant, devise: p.devise, date: p.date, provider: p.provider } : null);
const montantJour = (p: Paiement) => `${fmtMontant(p.montant, p.devise)} le ${fmtJour(p.date)}`;

export function etatPaiement(d: Pick<Dossier, 'premium' | 'paiements'>, maintenant: Date): ResultatPaiement {
  const dernierPaid = plusRecent(d.paiements.filter((p) => p.statut === 'paid'));
  const dateDernierPaid = dernierPaid ? dateDe(dernierPaid) : null;
  // Une intention antérieure à un paiement confirmé est un doublon : listée, puis ignorée.
  const pendings = d.paiements.filter((p) => p.statut === 'pending');
  const doublons = pendings.filter((p) => dateDernierPaid !== null && compareIso(p.date, dateDernierPaid) < 0).map((p) => p.id);
  const actifs = pendings.filter((p) => !doublons.includes(p.id));
  const dernierActif = plusRecent(actifs);
  const sortie = (etat: EtatPaiement, detail: string, enCours: EnCours | null = enCoursDe(dernierActif)): ResultatPaiement => ({ etat, detail, doublons, enCours });

  if (d.premium) {
    return sortie('paye', dernierPaid ? `Premium ; paiement de ${fmtMontant(dernierPaid.montant, dernierPaid.devise)} confirmé le ${fmtJour(dateDe(dernierPaid))}.` : 'Compte Premium.', null);
  }
  if (dernierPaid && dateDernierPaid && age(dateDernierPaid, maintenant) < JOURS_PAYE) {
    return sortie('a_verifier', `Paiement de ${fmtMontant(dernierPaid.montant, dernierPaid.devise)} confirmé le ${fmtJour(dateDernierPaid)}, mais le compte n'est pas Premium : contradiction à vérifier dans Paiements.`);
  }
  const manuelRecent = plusRecent(actifs.filter((p) => p.provider === 'manual' && age(p.date, maintenant) < JOURS_VERIF));
  if (manuelRecent) {
    return sortie('a_verifier', `Paiement manuel de ${montantJour(manuelRecent)}, non confirmé : la personne a peut-être payé.`, enCoursDe(manuelRecent));
  }
  if (dernierActif) {
    return sortie('abandonne', dernierActif.provider === 'manual'
      ? `Paiement manuel de ${montantJour(dernierActif)} resté sans confirmation depuis plus de ${JOURS_VERIF} jours.`
      : `Paiement en ligne de ${montantJour(dernierActif)} commencé, non abouti.`);
  }
  const echecRecent = plusRecent(d.paiements.filter((p) => p.statut === 'failed' && age(p.date, maintenant) < JOURS_VERIF));
  if (echecRecent && !dernierPaid) {
    return sortie('abandonne', `Paiement de ${montantJour(echecRecent)} échoué.`, enCoursDe(echecRecent));
  }
  if (dernierPaid && dateDernierPaid) {
    return sortie('expire', `Dernier paiement de ${fmtMontant(dernierPaid.montant, dernierPaid.devise)} confirmé le ${fmtJour(dateDernierPaid)}, il y a plus de ${JOURS_PAYE} jours ; plus Premium.`, null);
  }
  return sortie('aucun', 'Aucun paiement.', null);
}

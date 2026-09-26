/**
 * Règles pures des formations live. Aucune I/O : tout se teste sans base.
 *
 * Trois décisions y vivent, et elles protègent de l'encaissement fautif :
 *  · un prix absent rend `null` — l'appelant REFUSE la réservation plutôt que
 *    de retomber sur un autre montant, sans quoi on encaisserait un prix que
 *    personne n'a choisi ;
 *  · une séance qui n'est pas `ouverte` n'a jamais de place, même vide ;
 *  · une place annulée ne devient jamais payée : la transition est refusée ici,
 *    et la base ne laisse écrire le statut qu'à la clé de service.
 */

export type StatutSession = 'brouillon' | 'ouverte' | 'complete' | 'annulee' | 'terminee';
export type StatutInscription = 'reservee' | 'payee' | 'annulee' | 'presente' | 'absente';

export interface SessionTarif {
  prix: number | null;
  prix_abonne: number | null;
  places: number;
  places_prises: number;
  statut: StatutSession;
}

export function prixApplicable(s: SessionTarif, estAbonne: boolean): number | null {
  if (estAbonne && s.prix_abonne != null) return Number(s.prix_abonne);
  return s.prix == null ? null : Number(s.prix);
}

export function placeDisponible(s: SessionTarif): boolean {
  return s.statut === 'ouverte' && s.places_prises < s.places;
}

const TRANSITIONS: Record<StatutInscription, StatutInscription[]> = {
  reservee: ['payee', 'annulee'],
  payee: ['presente', 'absente', 'annulee'],
  annulee: [],
  presente: [],
  absente: [],
};

export function transitionAutorisee(de: StatutInscription, vers: StatutInscription): boolean {
  return TRANSITIONS[de].includes(vers);
}

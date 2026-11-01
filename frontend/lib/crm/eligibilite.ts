/**
 * Éligibilité à une relance — PUR (spec CRM v2 §2.1). Une seule fonction pour
 * toutes les voies d'envoi (manuelle aujourd'hui, séquences demain) : aucune ne
 * peut contourner une règle que l'autre applique. Toutes les raisons sont
 * rendues, pas seulement la première : l'exploitant voit tout ce qui bloque.
 */
import type { Dossier } from './types';
import type { Reglages } from './reglages';
import { etatPaiement } from './paiement';
import { dernierContact, decisionsCourantes } from './vues';

const JOUR_MS = 86_400_000;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function eligibilite(d: Dossier, reglages: Reglages, maintenant: Date, canal: 'email' | 'whatsapp' = 'email'): { ok: boolean; raisons: string[] } {
  const raisons: string[] = [];
  // Un e-mail signalé comme indésirable : insister par e-mail abîme la réputation d'envoi et ignore un refus explicite.
  if (canal === 'email' && d.actions.some((a) => a.type === 'relance' && a.canal === 'email' && a.livraison === 'spam')) {
    raisons.push('Un e-mail précédent a été signalé comme indésirable : plus de relance e-mail.');
  }
  // Premium implique « paye » côté paiement : on ne dit pas deux fois la même chose.
  if (d.premium || d.admin) raisons.push('Personne Premium ou administratrice : relance refusée.');
  else {
    const etat = etatPaiement(d, maintenant).etat;
    if (etat === 'paye') raisons.push('Paiement confirmé : plus de relance.');
    else if (etat === 'a_verifier') raisons.push("Paiement à vérifier d'abord dans Paiements.");
  }
  if (d.oppose) raisons.push("Cette personne s'est opposée aux propositions commerciales : plus aucun contact.");
  if (decisionsCourantes(d).cloture) raisons.push('Dossier clôturé : relance refusée.');

  const nb = d.actions.filter((a) => a.type === 'relance' && (a.statut === 'envoye' || a.statut === 'prepare' || a.statut === 'envoi')).length;
  if (nb >= reglages.max_relances) raisons.push(`Déjà ${pluriel(nb, 'relance')} (maximum ${reglages.max_relances}).`);

  const contact = dernierContact(d);
  if (contact) {
    const ecoule = maintenant.getTime() - Date.parse(contact);
    if (ecoule < reglages.delai_min_jours * JOUR_MS) {
      raisons.push(`Dernier contact il y a ${pluriel(Math.max(0, Math.floor(ecoule / JOUR_MS)), 'jour')} : délai minimal de ${reglages.delai_min_jours} jours non écoulé.`);
    }
  }
  return { ok: raisons.length === 0, raisons };
}

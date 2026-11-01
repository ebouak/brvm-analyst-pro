/**
 * Vues de travail du CRM — PUR. Chaque personne tombe dans UNE seule vue,
 * dérivée de sa fiche (`Dossier`), de l'horloge et des réglages. Aucune
 * colonne « statut » à tenir à jour : les décisions humaines sont des
 * événements datés de `crm_actions` (`type = 'decision'`), la plus récente
 * l'emporte. Les admins sont exclus par les appelants.
 */
import type { Dossier, MotifCloture } from './types';
import type { EtatPaiement, ResultatPaiement } from './paiement';
import { etatPaiement } from './paiement';
import { fmtJour, scorer, compareIso } from './score';
import { REGLAGES_PAR_DEFAUT, type Reglages } from './reglages';

export const VUES = ['a_traiter', 'jamais_contactes', 'paiements_a_verifier', 'en_attente', 'convertis', 'clotures'] as const;
export type Vue = (typeof VUES)[number];
export const LIB_VUE: Record<Vue, string> = {
  a_traiter: 'À traiter',
  jamais_contactes: 'Jamais contactés',
  paiements_a_verifier: 'Paiements à vérifier',
  en_attente: 'En attente de réponse',
  convertis: 'Convertis',
  clotures: 'Clôturés',
};
export const LIB_MOTIF: Record<MotifCloture, string> = { pas_interesse: 'pas intéressé', doublon: 'doublon', deja_abonne: 'déjà abonné' };

/** Seule la part des réglages qu'utilisent les vues ; une seule source de vérité : `reglages.ts`. */
export type ReglagesVue = Pick<Reglages, 'delai_suivi_jours'>;
export const REGLAGES_DEFAUT: ReglagesVue = { delai_suivi_jours: REGLAGES_PAR_DEFAUT.delai_suivi_jours };

export interface DecisionsCourantes {
  cloture: { motif: MotifCloture | null; date: string } | null;
  echeance: string | null;
  responsable: string | null;
  derniereReponse: string | null;
  /** Dernière « réponse traitée » : les réponses antérieures ne comptent plus. */
  derniereTraite: string | null;
}

const JOUR_MS = 86_400_000;
const jours = (depuis: string, maintenant: Date) => Math.floor((maintenant.getTime() - Date.parse(depuis)) / JOUR_MS);
const plusRecent = (xs: readonly string[]): string | null => [...xs].sort((a, b) => compareIso(b, a))[0] ?? null;

/** La décision la plus récente de chaque nature l'emporte ; une réouverture postérieure annule la clôture. */
export function decisionsCourantes(d: Pick<Dossier, 'actions'>): DecisionsCourantes {
  const decisions = d.actions.filter((a) => a.type === 'decision').sort((a, b) => compareIso(a.date, b.date));
  let cloture: DecisionsCourantes['cloture'] = null;
  let echeance: string | null = null;
  let responsable: string | null = null;
  let derniereReponse: string | null = null;
  let derniereTraite: string | null = null;
  for (const a of decisions) {
    if (a.decision === 'cloture') cloture = { motif: a.motif, date: a.date };
    else if (a.decision === 'reouverture') cloture = null;
    else if (a.decision === 'echeance') echeance = a.echeance;
    else if (a.decision === 'responsable') responsable = a.responsable;
    else if (a.decision === 'reponse') derniereReponse = a.date;
    else if (a.decision === 'traite') derniereTraite = a.date;
  }
  return { cloture, echeance, responsable, derniereReponse, derniereTraite };
}

/** Date de la dernière relance envoyée, préparée ou « en envoi » (peut-être partie : on échoue fermé). */
export function dernierContact(d: Pick<Dossier, 'actions'>): string | null {
  return plusRecent(d.actions.filter((a) => a.type === 'relance' && (a.statut === 'envoye' || a.statut === 'prepare' || a.statut === 'envoi')).map((a) => a.date));
}

/** Date de la dernière réponse postérieure au dernier contact (déclarée ou message de contact), sinon null. */
function dateReponse(d: Pick<Dossier, 'actions' | 'messages'>): string | null {
  const contact = dernierContact(d);
  if (!contact) return null;
  const { derniereReponse: rep, derniereTraite } = decisionsCourantes(d);
  // Seuil : le plus récent du dernier contact et de la dernière « réponse traitée ».
  const seuil = derniereTraite && compareIso(derniereTraite, contact) > 0 ? derniereTraite : contact;
  return plusRecent([...(rep ? [rep] : []), ...d.messages.map((m) => m.date)].filter((x) => compareIso(x, seuil) > 0));
}

export const reponseRecue = (d: Pick<Dossier, 'actions' | 'messages'>): boolean => dateReponse(d) !== null;

type Declencheur = 'echeance' | 'reponse' | 'silence';
interface Analyse { vue: Vue; echeance: string | null; raison: string; declencheur?: Declencheur }

function analyser(d: Dossier, maintenant: Date, reglages: ReglagesVue, etat: ResultatPaiement): Analyse {
  const dec = decisionsCourantes(d);
  const echeance = dec.echeance;
  const base = { echeance };
  if (etat.etat === 'paye') return { ...base, vue: 'convertis', raison: etat.detail };
  if (d.oppose) return { ...base, vue: 'clotures', raison: "Opposition aux propositions commerciales : plus aucun contact." };
  if (dec.cloture) return { ...base, vue: 'clotures', raison: `Clôturé le ${fmtJour(dec.cloture.date)}${dec.cloture.motif ? ` (${LIB_MOTIF[dec.cloture.motif]})` : ''}.` };
  if (etat.etat === 'a_verifier') return { ...base, vue: 'paiements_a_verifier', raison: etat.detail };

  const contact = dernierContact(d);
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  // Une échéance est « consommée » dès qu'une relance a eu lieu à sa date ou après.
  if (echeance && echeance <= aujourdhui && (!contact || contact.slice(0, 10) < echeance)) {
    return { ...base, vue: 'a_traiter', declencheur: 'echeance', raison: `Suivi prévu le ${fmtJour(echeance)} : échéance atteinte.` };
  }
  const rep = dateReponse(d);
  if (rep) return { ...base, vue: 'a_traiter', declencheur: 'reponse', raison: `Réponse reçue le ${fmtJour(rep)}, après le contact du ${fmtJour(contact as string)}.` };
  if (contact && jours(contact, maintenant) >= reglages.delai_suivi_jours) {
    return { ...base, vue: 'a_traiter', declencheur: 'silence', raison: `Contacté le ${fmtJour(contact)}, sans réponse depuis ${jours(contact, maintenant)} jours.` };
  }
  if (echeance && echeance > aujourdhui) return { ...base, vue: 'en_attente', raison: `Suivi prévu le ${fmtJour(echeance)}.` };
  if (contact) return { ...base, vue: 'en_attente', raison: `Contacté le ${fmtJour(contact)} ; délai de suivi de ${reglages.delai_suivi_jours} jours non écoulé.` };
  return { ...base, vue: 'jamais_contactes', raison: 'Aucune relance enregistrée.' };
}

/** Priorité : convertis > clôturés > paiements à vérifier > à traiter > en attente > jamais contactés. */
export function vueDe(d: Dossier, maintenant: Date, reglages: ReglagesVue = REGLAGES_DEFAUT): { vue: Vue; echeance: string | null; raison: string } {
  const { vue, echeance, raison } = analyser(d, maintenant, reglages, etatPaiement(d, maintenant));
  return { vue, echeance, raison };
}

/** Une action et sa justification, une phrase chacune, dérivées des seuls faits de la fiche. */
export function actionRecommandee(d: Dossier, vue: Vue, etat: ResultatPaiement | { etat: EtatPaiement; detail: string; enCours?: ResultatPaiement['enCours'] }, maintenant: Date = new Date(), reglages: ReglagesVue = REGLAGES_DEFAUT): { libelle: string; justification: string } {
  const complet: ResultatPaiement = { doublons: [], enCours: null, ...etat };
  const a = analyser(d, maintenant, reglages, complet);
  switch (vue) {
    case 'paiements_a_verifier':
      return { libelle: 'Vérifier le paiement', justification: `${complet.detail} À vérifier dans Paiements.` };
    case 'a_traiter':
      return { libelle: a.declencheur === 'reponse' ? 'Répondre' : 'Relancer', justification: a.raison };
    case 'jamais_contactes': {
      const premier = scorer(d, maintenant).raisons[0];
      return { libelle: 'Premier contact', justification: premier ? `Jamais contacté ; ${premier.texte}.` : 'Jamais contacté ; aucun signal particulier.' };
    }
    case 'en_attente':
      return { libelle: 'Attendre', justification: a.raison };
    case 'convertis':
      return { libelle: 'Aucune action', justification: complet.detail };
    case 'clotures':
      return { libelle: 'Aucune action', justification: a.raison };
  }
}

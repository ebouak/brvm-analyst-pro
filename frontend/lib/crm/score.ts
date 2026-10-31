/**
 * Score de proximité du Premium — PUR. Chaque point est justifié par un fait
 * DATÉ du dossier ; une raison n'existe que si son fait existe (aucun chiffre
 * inventé). Pondérations et fenêtres : une seule constante chacune.
 */
import type { Dossier, Niveau, Raison, Score } from './types';

export const PONDERATIONS = { paiement: 40, offre: 20, connexion7: 15, connexion30: 5, portefeuille: 10, contact: 10, newsletter: 5, academy: 5 } as const;
export const FENETRES_JOURS = { paiement: 30, offre: 14, connexionForte: 7, connexion: 30, contact: 30 } as const;
export const SEUILS = { chaud: 50, tiede: 25 } as const;

const JOUR_MS = 86_400_000;
const age = (iso: string, maintenant: Date) => (maintenant.getTime() - Date.parse(iso)) / JOUR_MS;
const plusRecent = <T extends { date: string }>(xs: readonly T[]) => [...xs].sort((a, b) => b.date.localeCompare(a.date))[0];
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export const fmtJour = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
// toLocaleString('fr-FR') sépare les milliers par une espace insécable (U+00A0 ou U+202F selon l'ICU) : on la normalise.
const nombreFr = (n: number): string => Math.round(n).toLocaleString('fr-FR').replace(/[\u00a0\u202f]/g, ' ');
export const fmtFcfa = (n: number): string => `${nombreFr(n)} FCFA`;
/** Montant dans SA devise : FCFA pour XOF/FCFA, sinon le code de la devise (jamais « FCFA » sur de l'EUR). */
export const fmtMontant = (montant: number, devise: string): string =>
  /^(xof|fcfa)$/i.test(devise.trim()) ? fmtFcfa(montant) : `${nombreFr(montant)} ${devise.trim().toUpperCase()}`;

export function estExclu(d: Dossier): boolean {
  return d.premium || d.admin || d.oppose;
}

export function scorer(d: Dossier, maintenant: Date): Score {
  const raisons: Raison[] = [];

  const paiement = plusRecent(d.paiementsEnAttente.filter((p) => age(p.date, maintenant) <= FENETRES_JOURS.paiement));
  if (paiement) raisons.push({ code: 'paiement', points: PONDERATIONS.paiement, date: paiement.date, texte: `paiement de ${fmtMontant(paiement.montant, paiement.devise)} commencé le ${fmtJour(paiement.date)}, non terminé` });

  const vues = d.offreVues.map((v) => ({ ...v, date: `${v.jour}T12:00:00Z` })).filter((v) => age(v.date, maintenant) <= FENETRES_JOURS.offre);
  const derniereVue = plusRecent(vues);
  if (derniereVue) raisons.push({ code: 'offre', points: PONDERATIONS.offre, date: derniereVue.date, texte: `a consulté l'offre ${vues.length === 1 ? 'une fois' : `${vues.length} fois`}, dernière le ${fmtJour(derniereVue.date)}` });

  if (d.derniereConnexion) {
    const a = age(d.derniereConnexion, maintenant);
    const texte = a < 1 ? "connecté aujourd'hui" : `connecté il y a ${pluriel(Math.floor(a), 'jour')}`;
    if (a <= FENETRES_JOURS.connexionForte) raisons.push({ code: 'connexion', points: PONDERATIONS.connexion7, date: d.derniereConnexion, texte });
    else if (a <= FENETRES_JOURS.connexion) raisons.push({ code: 'connexion', points: PONDERATIONS.connexion30, date: d.derniereConnexion, texte });
  }

  if (d.lignesPortefeuille > 0) raisons.push({ code: 'portefeuille', points: PONDERATIONS.portefeuille, date: null, texte: `portefeuille de ${pluriel(d.lignesPortefeuille, 'ligne')}` });

  const contacts = [
    ...d.messages.map((m) => ({ date: m.date, quoi: 'message' })),
    ...(d.prospect ? [{ date: d.prospect.date, quoi: 'formulaire prospect' }] : []),
  ].filter((c) => age(c.date, maintenant) <= FENETRES_JOURS.contact);
  const contact = plusRecent(contacts);
  if (contact) raisons.push({ code: 'contact', points: PONDERATIONS.contact, date: contact.date, texte: `${contact.quoi} du ${fmtJour(contact.date)}` });

  if (d.newsletter) raisons.push({ code: 'newsletter', points: PONDERATIONS.newsletter, date: null, texte: 'abonné à la newsletter' });
  if (d.leconsAcademy > 0) raisons.push({ code: 'academy', points: PONDERATIONS.academy, date: null, texte: `${pluriel(d.leconsAcademy, 'leçon')} de l'Academy suivie${d.leconsAcademy > 1 ? 's' : ''}` });

  const score = Math.min(100, raisons.reduce((s, r) => s + r.points, 0));
  const niveau: Niveau = score >= SEUILS.chaud ? 'chaud' : score >= SEUILS.tiede ? 'tiede' : 'froid';
  // Tri stable : à points égaux, l'ordre d'insertion est conservé (le test « cumule » s'y fie).
  return { score, niveau, raisons: raisons.sort((a, b) => b.points - a.points) };
}

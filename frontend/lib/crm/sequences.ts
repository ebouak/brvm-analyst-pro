/**
 * Séquences de relance automatiques — PUR (spec CRM v2 SP3). Aucune I/O : on
 * décide ici QUI reçoit QUELLE étape ; l'envoi (et tous ses garde-fous) vit
 * dans envoiRelance.ts. Doctrine : à la moindre ambiguïté, on s'abstient.
 *
 * - Une étape = une clé `<séquence>:<étape>`, jamais rejouée : l'index unique
 *   (email_norm, sequence_cle) de la base le garantit même si ce module se trompe.
 * - Une étape en ÉCHEC n'est PAS rejouée automatiquement : sa clé reste prise.
 *   Réessayer en boucle un envoi qui échoue (domaine, boîte pleine, quota)
 *   martèlerait le fournisseur et pourrait doubler un message parti sans accusé ;
 *   l'exploitant voit l'échec (alerte, journal) et relance à la main.
 * - Une seule étape par personne et par passage ; jamais pour un cas ancien
 *   (ancre > 30 jours) ni pour qui n'est pas éligible.
 */
import type { Dossier } from './types';
import type { Reglages } from './reglages';
import type { TemplateId } from './gabarits';
import { etatPaiement } from './paiement';
import { eligibilite } from './eligibilite';
import { decisionsCourantes } from './vues';
import { compareIso } from './score';

const JOUR_MS = 86_400_000;
export const FENETRE_ANCRE_JOURS = 30;

export const SEQUENCES = {
  paiement_inacheve: { templateId: 'paiement_inacheve', etapes: [{ etape: 1, apresJours: 1 }, { etape: 2, apresJours: 8 }] },
  offre_consultee: { templateId: 'offre_consultee', etapes: [{ etape: 1, apresJours: 2 }] },
} as const satisfies Record<string, { templateId: TemplateId; etapes: readonly { etape: number; apresJours: number }[] }>;
export type NomSequence = keyof typeof SEQUENCES;
const ORDRE: NomSequence[] = ['paiement_inacheve', 'offre_consultee'];

export interface EtapeDue { sequence: NomSequence; etape: number; cle: string; templateId: TemplateId; ancre: string; echeance: string }

export const cleEtape = (sequence: string, etape: number) => `${sequence}:${etape}`;

/** Préfixe des clés journalisées en mode simulation : elles ne consomment jamais une étape réelle. */
export const PREFIXE_SIMULATION = 'sim_';
/** Clé à écrire au journal selon le mode (valide sous le CHECK `^[a-z_]+:[0-9]+$`). */
export const cleJournal = (cle: string, simulation: boolean) => (simulation ? PREFIXE_SIMULATION + cle : cle);

/**
 * Étapes déjà au journal POUR CE MODE, quel que soit leur statut (envoyé, échec…).
 * Simulation : seules les clés `sim_` comptent (chaque étape est simulée une fois) ;
 * actif : seules les clés réelles comptent (une étape simulée part quand même, une fois).
 */
export function etapesFaites(d: Pick<Dossier, 'actions'>, simulation = false, seulementReussies = false): Set<string> {
  const out = new Set<string>();
  for (const a of d.actions) {
    const k = a.sequenceCle;
    if (typeof k !== 'string' || !k) continue;
    // « Réussie » : réellement envoyée (actif) ou simulée sans accroc (simulation). Un « envoi » indéterminé ou un échec ne l'est pas.
    if (seulementReussies && a.statut !== (simulation ? 'simulation' : 'envoye')) continue;
    if (k.startsWith(PREFIXE_SIMULATION)) { if (simulation) out.add(k.slice(PREFIXE_SIMULATION.length)); }
    else if (!simulation) out.add(k);
  }
  return out;
}

/** Date d'ancrage de la séquence si SA condition tient, sinon null. */
function ancreDe(sequence: NomSequence, d: Dossier, maintenant: Date): string | null {
  const p = etatPaiement(d, maintenant);
  if (sequence === 'paiement_inacheve') {
    // « a_verifier » se vérifie, il ne se relance pas ; seul l'abandon avéré compte.
    return p.etat === 'abandonne' && p.enCours ? p.enCours.date : null;
  }
  if (p.etat !== 'aucun' && p.etat !== 'expire') return null;
  const jours = d.offreVues.map((v) => v.jour).filter((j) => /^\d{4}-\d{2}-\d{2}$/.test(j)).sort();
  const dernier = jours[jours.length - 1];
  // Fin de journée : on ne relance jamais avant la fin du délai, quelle que soit l'heure de la visite.
  return dernier ? `${dernier}T23:59:59Z` : null;
}

/**
 * Une réponse (déclarée ou message de contact) postérieure à l'ancre arrête la
 * séquence, MÊME marquée « traitée » ensuite : un « non merci » traité ne doit
 * pas recevoir l'étape suivante. Seule une relance manuelle reprend la main.
 */
function reponseApres(d: Dossier, ancre: string): boolean {
  const dec = decisionsCourantes(d);
  const dates = [...d.messages.map((m) => m.date), ...d.actions.filter((a) => a.type === 'decision' && a.decision === 'reponse').map((a) => a.date), ...(dec.derniereReponse ? [dec.derniereReponse] : [])];
  return dates.some((x) => compareIso(x, ancre) > 0);
}

/** Au plus UNE étape due (la plus ancienne) pour cette personne. [] = rien à faire. */
export function etapesDues(d: Dossier, reglages: Reglages, maintenant: Date, dejaFaites: Set<string>, reussies: Set<string> = dejaFaites): EtapeDue[] {
  if (d.admin || d.premium || d.oppose) return [];
  if (decisionsCourantes(d).cloture) return [];
  if (!eligibilite(d, reglages, maintenant).ok) return [];

  const dues: EtapeDue[] = [];
  for (const nom of ORDRE) {
    const ancre = ancreDe(nom, d, maintenant);
    if (!ancre) continue;
    const age = maintenant.getTime() - Date.parse(ancre);
    if (!(age >= 0) || age > FENETRE_ANCRE_JOURS * JOUR_MS) continue;
    if (reponseApres(d, ancre)) continue;
    const seq = SEQUENCES[nom];
    const prochaine = seq.etapes.find((e) => !dejaFaites.has(cleEtape(nom, e.etape)));
    if (!prochaine) continue;
    // Étape n>1 : seulement si l'étape précédente est PARTIE. Échec ou état indéterminé = la séquence s'arrête.
    if (prochaine.etape > 1 && !reussies.has(cleEtape(nom, prochaine.etape - 1))) continue;
    const echeance = new Date(Date.parse(ancre) + prochaine.apresJours * JOUR_MS).toISOString();
    if (Date.parse(echeance) > maintenant.getTime()) continue;
    dues.push({ sequence: nom, etape: prochaine.etape, cle: cleEtape(nom, prochaine.etape), templateId: seq.templateId, ancre, echeance });
  }
  dues.sort((a, b) => compareIso(a.echeance, b.echeance));
  return dues.slice(0, 1);
}

/** Passage du jour : une étape par personne, plafonnée, les plus anciennes ancres d'abord. */
export function selectionnerPassage(dossiers: readonly Dossier[], reglages: Reglages, maintenant: Date): { cle: string; d: Dossier; etape: EtapeDue }[] {
  const out: { cle: string; d: Dossier; etape: EtapeDue }[] = [];
  const vus = new Set<string>();
  for (const d of dossiers) {
    if (d.admin || vus.has(d.emailNorm)) continue;
    const simul = reglages.mode_sequences === 'simulation';
    const [etape] = etapesDues(d, reglages, maintenant, etapesFaites(d, simul), etapesFaites(d, simul, true));
    if (!etape) continue;
    vus.add(d.emailNorm);
    out.push({ cle: d.cle, d, etape });
  }
  out.sort((a, b) => compareIso(a.etape.ancre, b.etape.ancre) || (a.d.emailNorm < b.d.emailNorm ? -1 : 1));
  return out.slice(0, Math.max(0, reglages.plafond_par_execution));
}

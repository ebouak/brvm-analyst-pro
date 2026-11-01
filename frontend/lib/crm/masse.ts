/**
 * Tri d'une sélection pour la relance e-mail en masse — PUR. Même règle d'éligibilité que l'envoi à l'unité
 * (voie manuelle : aucune limite de cadence), mais calculée sur des dossiers FRAIS, côté serveur : la liste
 * affichée au navigateur ne fait jamais foi. Chaque personne écartée garde sa raison, rien n'est omis en silence.
 */
import type { Dossier } from './types';
import type { Reglages } from './reglages';
import { eligibilite } from './eligibilite';
import { choisirGabarit, type TemplateId } from './gabarits';
import { scorer } from './score';

export const MAX_SELECTION_MASSE = 500;

export interface TriMasse {
  eligibles: { cle: string; nom: string; gabarit: TemplateId }[];
  ecartes: { cle: string; nom: string; raison: string }[];
}

export function classerPourMasse(cles: string[], dossiers: Dossier[], reglages: Reglages, maintenant: Date): TriMasse {
  const parCle = new Map(dossiers.map((d) => [d.cle, d]));
  const vus = new Set<string>();
  const tri: TriMasse = { eligibles: [], ecartes: [] };
  for (const cle of cles) {
    if (vus.has(cle)) continue;
    vus.add(cle);
    const d = parCle.get(cle);
    if (!d) { tri.ecartes.push({ cle, nom: cle, raison: 'Personne introuvable.' }); continue; }
    const nom = d.nom?.trim() || d.emailNorm;
    const e = eligibilite(d, reglages, maintenant, 'email', { manuel: true });
    if (!e.ok) tri.ecartes.push({ cle, nom, raison: e.raisons.join(' ; ') });
    else tri.eligibles.push({ cle, nom, gabarit: choisirGabarit(d, scorer(d, maintenant)) });
  }
  return tri;
}

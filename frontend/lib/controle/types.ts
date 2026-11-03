/**
 * Tour de contrôle (/admin/controle) — contrat commun.
 *
 * Chaque domaine (envois, tâches, données) fournit :
 *   - une fonction PURE `evaluerX(donnees, maintenant): Signal[]` (testée) ;
 *   - un chargeur serveur `chargerX()` qui LÈVE si la base ne répond pas.
 * La page transforme un chargeur en échec en signal « inconnu » : une source
 * illisible n'est JAMAIS présentée comme saine.
 *
 * Leçon d'origine (CLAUDE.md §9) : sept semaines sans e-mail avec un workflow
 * vert. Un run réussi ne prouve rien ; la donnée produite, si.
 */

export type Niveau = 'ok' | 'attention' | 'alerte' | 'inconnu';
export type Domaine = 'envois' | 'taches' | 'donnees';

export interface Signal {
  /** Identifiant stable, ex. 'envois:email', 'taches:alerts.yml', 'donnees:seance'. */
  id: string;
  domaine: Domaine;
  /** Libellé court de la chose surveillée, ex. « E-mails d'alerte ». */
  titre: string;
  niveau: Niveau;
  /** Une phrase factuelle, chiffres compris, sans jargon. */
  detail: string;
  /** Dernier fait positif connu (ISO), ex. dernier envoi réussi. */
  dernierSucces?: string | null;
  /** Lien utile (run GitHub, page admin), facultatif. */
  lien?: string | null;
}

const RANG: Record<Niveau, number> = { alerte: 0, inconnu: 1, attention: 2, ok: 3 };

/** Tri : le plus grave d'abord, puis par domaine et titre. */
export function trierSignaux(s: Signal[]): Signal[] {
  return [...s].sort((a, b) => RANG[a.niveau] - RANG[b.niveau] || a.domaine.localeCompare(b.domaine) || a.titre.localeCompare(b.titre, 'fr'));
}

/** Verdict global : jamais « ok » s'il reste une source illisible. */
export function niveauGlobal(s: Signal[]): Niveau {
  if (s.length === 0) return 'inconnu';
  return trierSignaux(s)[0].niveau;
}

export function signalInconnu(domaine: Domaine, id: string, titre: string, quoi: string): Signal {
  return { id, domaine, titre, niveau: 'inconnu', detail: `Lecture impossible (${quoi}) : rien ne peut être conclu.` };
}

/**
 * Sélection des dossiers à envoyer — PUR, testé.
 *
 * Trois règles, toutes explicites ici et nulle part ailleurs :
 *   1. FRAÎCHEUR : un PDF de plus de 3 jours n'est pas envoyé. Il est ÉCARTÉ
 *      ET NOMMÉ dans le message. Un document périmé livré sans le dire est
 *      pire qu'un document absent.
 *   2. TRI : par valorisation décroissante (quantité × dernier cours) ; cours
 *      inconnu en dernier. C'est l'ordre dans lequel un porteur regarde son
 *      portefeuille.
 *   3. PLAFOND email : 12 pièces jointes (~2 Mo). Au-delà, le reste est
 *      listé comme disponible sur /portefeuille. Telegram n'a pas ce plafond
 *      (un document par envoi).
 */

export const FRAICHEUR_MS = 3 * 24 * 3600 * 1000;
export const PLAFOND_EMAIL = 12;
export const RAISON_PERIME = 'dossier de cette semaine non disponible';

export interface LigneCandidate {
  code: string;
  designation: string;
  quantite: number;
  /** Dernier cours connu, null si aucune cotation. */
  cours: number | null;
  /** `updated_at` de `<CODE>/dernier.pdf` dans le bucket, null si absent. */
  pdf_updated_at: string | null;
}

export interface LigneRetenue {
  code: string;
  designation: string;
  valorisation: number | null;
}

export interface LigneExclue {
  code: string;
  designation: string;
  raison: string;
}

export interface Selection {
  retenues: LigneRetenue[];
  exclues: LigneExclue[];
  pieces_jointes_email: LigneRetenue[];
  reste_email: LigneRetenue[];
}

/** Lundi ISO de la semaine contenant `d`, au format AAAA-MM-JJ (UTC). */
export function cleSemaine(d: Date): string {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jour = u.getUTCDay(); // 0 = dimanche
  const recul = jour === 0 ? 6 : jour - 1;
  u.setUTCDate(u.getUTCDate() - recul);
  return u.toISOString().slice(0, 10);
}

export function selectionnerLignes(lignes: LigneCandidate[], maintenant: Date): Selection {
  const retenues: LigneRetenue[] = [];
  const exclues: LigneExclue[] = [];
  const seuil = maintenant.getTime() - FRAICHEUR_MS;

  for (const l of lignes) {
    if (!(l.quantite > 0)) continue;
    const maj = l.pdf_updated_at ? Date.parse(l.pdf_updated_at) : NaN;
    if (!Number.isFinite(maj) || maj < seuil) {
      exclues.push({ code: l.code, designation: l.designation, raison: RAISON_PERIME });
      continue;
    }
    retenues.push({
      code: l.code,
      designation: l.designation,
      valorisation: l.cours != null ? l.quantite * l.cours : null,
    });
  }

  retenues.sort((a, b) => {
    if (a.valorisation == null && b.valorisation == null) return a.code.localeCompare(b.code);
    if (a.valorisation == null) return 1;
    if (b.valorisation == null) return -1;
    return b.valorisation - a.valorisation;
  });

  return {
    retenues,
    exclues,
    pieces_jointes_email: retenues.slice(0, PLAFOND_EMAIL),
    reste_email: retenues.slice(PLAFOND_EMAIL),
  };
}

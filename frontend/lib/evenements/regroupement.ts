/**
 * Regroupement À L'AFFICHAGE des publications d'une même société, sur une même
 * période et de même famille (rapport d'activités, attestation des commissaires
 * aux comptes, états financiers…). Aucune ligne n'est supprimée en base.
 *
 * Une publication sans période reconnaissable reste seule : mieux vaut un
 * doublon visible qu'une fusion de deux documents distincts.
 */

export interface EvenementBrut {
  id: string;
  event_date: string;
  title: string;
  event_type: string;
  instrument_code: string | null;
  source_url?: string | null;
}

export interface Piece { id: string; titre: string; date: string; source_url: string | null }

export interface EvenementRegroupe {
  /** Identifiant de la pièce principale (fiche d'événement). */
  id: string;
  /** Date de la première pièce publiée : J0 de la mesure de réaction. */
  date: string;
  titre: string;
  type: string;
  code: string | null;
  periode: string | null;
  pieces: Piece[];
}

/** Période normalisée lue dans le libellé : « T3-2026 », « S1-2026 », « 9M-2026 », « A-2025 », ou null. */
export function periodeDuTitre(titre: string): string | null {
  const t = titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let m = t.match(/(\d)\s*(?:er|re|e|eme|ieme)?\s*trimestre\s*(\d{4})/);
  if (m) return `T${m[1]}-${m[2]}`;
  m = t.match(/(\d)\s*(?:er|re|e|eme|ieme)?\s*semestre\s*(\d{4})/);
  if (m) return `S${m[1]}-${m[2]}`;
  m = t.match(/9\s*mois\s*(\d{4})/);
  if (m) return `9M-${m[1]}`;
  m = t.match(/exercice\s*(\d{4})/) ?? t.match(/annuel(?:s|le|les)?\b.*?(\d{4})/);
  if (m) return `A-${m[1]}`;
  return null;
}

/** Ordre de préférence de la pièce principale : les comptes d'abord, l'attestation en dernier. */
function rang(titre: string): number {
  const t = titre.toLowerCase();
  if (/commissaires|\bcac\b|attestation/.test(t)) return 3;
  if (/[ée]tats? financiers/.test(t)) return 0;
  if (/rapport d.activit/.test(t)) return 1;
  return 2;
}

/** Entrée dans n'importe quel ordre ; sortie par date décroissante (date de la première pièce). */
export function regrouperEvenements(evts: EvenementBrut[]): EvenementRegroupe[] {
  const groupes = new Map<string, EvenementBrut[]>();
  for (const e of evts) {
    const periode = periodeDuTitre(e.title);
    const cle = e.instrument_code && periode ? `${e.instrument_code}|${e.event_type}|${periode}` : `seul|${e.id}`;
    const g = groupes.get(cle);
    if (g) g.push(e);
    else groupes.set(cle, [e]);
  }
  const out: EvenementRegroupe[] = [];
  for (const g of groupes.values()) {
    const parDate = [...g].sort((a, b) => a.event_date.localeCompare(b.event_date) || rang(a.title) - rang(b.title));
    const principale = [...g].sort((a, b) => rang(a.title) - rang(b.title) || a.event_date.localeCompare(b.event_date))[0]!;
    out.push({
      id: principale.id,
      date: parDate[0]!.event_date,
      titre: principale.title,
      type: principale.event_type,
      code: principale.instrument_code,
      periode: periodeDuTitre(principale.title),
      pieces: parDate.map((e) => ({ id: e.id, titre: e.title, date: e.event_date, source_url: e.source_url ?? null })),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

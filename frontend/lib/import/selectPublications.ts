export interface PubRow {
  id: string; code: string; libelle: string | null; date_publication: string;
  type_publication: string | null; source_url: string | null;
}
export interface SelectedPub extends PubRow { exercice: number; }

/** Extrait l'année d'exercice depuis le libellé (ex "Exercice 2025"). */
function parseExercice(libelle: string | null): number | null {
  if (!libelle) return null;
  const m = libelle.match(/[Ee]xercice\s+(20\d{2})/);
  return m ? Number(m[1]) : null;
}

/**
 * Choisit, parmi les publications d'une action, les états financiers à extraire :
 * l'exercice le plus récent (donne N et N-1 en comparatif) + l'exercice 2023 (donne 2023/2022).
 * Garde une seule publication par exercice (la plus récemment publiée si doublon).
 */
export function selectFinancialPublications(rows: PubRow[]): SelectedPub[] {
  const ef = rows
    .filter((r) => r.type_publication === 'etats_financiers' && r.source_url)
    .map((r) => ({ ...r, exercice: parseExercice(r.libelle) }))
    .filter((r): r is SelectedPub => r.exercice != null);

  // dédoublonnage par exercice : garder la date_publication la plus récente
  const parExercice = new Map<number, SelectedPub>();
  for (const r of ef) {
    const prev = parExercice.get(r.exercice);
    if (!prev || r.date_publication > prev.date_publication) parExercice.set(r.exercice, r);
  }

  const exercices = [...parExercice.keys()].sort((a, b) => b - a);
  const recent = exercices[0];
  const cibles = new Set<number>();
  if (recent != null) cibles.add(recent);
  if (parExercice.has(2023)) cibles.add(2023);

  return [...cibles].map((y) => parExercice.get(y)!).filter(Boolean);
}

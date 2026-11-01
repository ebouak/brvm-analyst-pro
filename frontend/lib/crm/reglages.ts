/**
 * Réglages du CRM — PUR. Une seule ligne (`crm_reglages`, id = 1, migration 0177).
 * Les bornes reprennent à l'identique les CHECK de la base : valider ici évite un
 * aller-retour refusé, mais la base reste l'ultime garde. Toute valeur absente ou
 * invalide retombe sur le défaut, et le mode sur « off » : une lecture dégradée ne
 * doit jamais activer des envois.
 */
export const MODES_SEQUENCES = ['off', 'simulation', 'actif'] as const;
export type ModeSequences = (typeof MODES_SEQUENCES)[number];

export interface Reglages {
  max_relances: number;
  delai_min_jours: number;
  delai_suivi_jours: number;
  fenetre_conversion_jours: number;
  mode_sequences: ModeSequences;
  plafond_par_execution: number;
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  max_relances: 3, delai_min_jours: 7, delai_suivi_jours: 7, fenetre_conversion_jours: 30, mode_sequences: 'off', plafond_par_execution: 20,
};

/** [min, max, libellé] — identiques aux CHECK de 0177. */
export const BORNES = {
  max_relances: [1, 10, 'Nombre maximal de relances'],
  delai_min_jours: [1, 60, 'Délai minimal entre deux relances'],
  delai_suivi_jours: [1, 60, 'Délai de suivi'],
  fenetre_conversion_jours: [1, 180, 'Fenêtre de conversion'],
  plafond_par_execution: [1, 200, "Plafond par exécution"],
} as const satisfies Record<string, readonly [number, number, string]>;

type ChampNumerique = keyof typeof BORNES;
const CHAMPS = Object.keys(BORNES) as ChampNumerique[];

/** Entier dans les bornes, accepté aussi sous forme de chaîne numérique ; sinon null. */
function entier(v: unknown, champ: ChampNumerique): number | null {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) return null;
  const [min, max] = BORNES[champ];
  return n >= min && n <= max ? n : null;
}

const estMode = (v: unknown): v is ModeSequences => typeof v === 'string' && (MODES_SEQUENCES as readonly string[]).includes(v);

/** Ligne brute de la base → réglages complets ; tout champ manquant ou invalide prend son défaut. */
export function normaliserReglages(row: unknown): Reglages {
  const r = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
  const sortie: Reglages = { ...REGLAGES_PAR_DEFAUT };
  for (const c of CHAMPS) sortie[c] = entier(r[c], c) ?? REGLAGES_PAR_DEFAUT[c];
  sortie.mode_sequences = estMode(r.mode_sequences) ? r.mode_sequences : 'off';
  return sortie;
}

/** Saisie d'un formulaire : STRICTE (un champ invalide est refusé, jamais remplacé par un défaut). */
export function validerReglages(saisie: unknown): { ok: true; reglages: Reglages } | { ok: false; message: string } {
  const s = saisie && typeof saisie === 'object' ? (saisie as Record<string, unknown>) : {};
  const sortie: Reglages = { ...REGLAGES_PAR_DEFAUT };
  for (const c of CHAMPS) {
    const v = entier(s[c], c);
    if (v === null) {
      const [min, max, lib] = BORNES[c];
      return { ok: false, message: `${lib} : entier entre ${min} et ${max} attendu.` };
    }
    sortie[c] = v;
  }
  if (!estMode(s.mode_sequences)) return { ok: false, message: 'Mode des séquences inconnu.' };
  sortie.mode_sequences = s.mode_sequences;
  return { ok: true, reglages: sortie };
}

import { z } from 'zod';

/**
 * Schéma du contenu d'un cours Academy généré par LLM.
 * Le LLM renvoie ce JSON ; il est validé (zod) avant rendu HTML + stockage.
 */

export const SECTION_TYPES = ['definition', 'importance', 'cas', 'piege', 'lexique', 'retenir'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const CATEGORIES = ['general', 'income', 'fundamental', 'technical', 'regulatory', 'evaluation'] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const NIVEAUX = ['debutant', 'intermediaire', 'avance', 'expert'] as const;
export type Niveau = (typeof NIVEAUX)[number];

/** Bloc « chiffres clés » — rangée de cartes KPI sous le texte de la section. */
export const statSchema = z.object({
  label: z.string().min(1).max(60),
  valeur: z.string().min(1).max(40),
  /** Précision optionnelle sous la valeur (ex. « contre 836 Md en 1998 »). */
  detail: z.string().max(120).optional().default(''),
});

/** Bloc tableau — colonnes + lignes de texte (rendu stylé, scroll horizontal). */
export const tableauSchema = z
  .object({
    colonnes: z.array(z.string().min(1).max(60)).min(2).max(6),
    lignes: z.array(z.array(z.string().max(160))).min(1).max(12),
    note: z.string().max(300).optional().default(''),
  })
  .refine((t) => t.lignes.every((l) => l.length === t.colonnes.length), {
    message: 'chaque ligne doit avoir autant de cellules que de colonnes',
  });

/** Bloc étapes — frise numérotée verticale (phases de séance, parcours, dates). */
export const etapeSchema = z.object({
  titre: z.string().min(1).max(120),
  detail: z.string().max(400).optional().default(''),
  /** Étape mise en avant (ex. la date de détachement). */
  cle: z.boolean().optional().default(false),
});

// ── Blocs éditoriaux (2026-10-20, spec 2026-10-20-academy-lecon-editoriale) ──
// Tous OPTIONNELS : les leçons existantes restent valides telles quelles.

/** Formule clé, avec son exemple chiffré. */
export const formuleSchema = z.object({
  nom: z.string().min(1).max(80),
  expression: z.string().min(1).max(160),
  exemple: z.string().max(200).optional().default(''),
});

/** Pictogrammes disponibles pour le schéma de mécanisme (components/academy/lecon/Pictogramme). */
export const ICONES_FLUX = [
  'entreprise', 'benefices', 'decision', 'actionnaires', 'paiement', 'calendrier', 'graphique', 'piece',
] as const;
export type IconeFlux = (typeof ICONES_FLUX)[number];

/** Étape d'un schéma de mécanisme (A → B → C), dessiné en chaîne. */
export const fluxEtapeSchema = z.object({
  titre: z.string().min(1).max(40),
  detail: z.string().max(120).optional().default(''),
  icone: z.enum(ICONES_FLUX),
});

/** Point d'une liste éditoriale numérotée (critère, piège, idée essentielle). */
export const pointSchema = z.object({
  titre: z.string().min(1).max(80),
  detail: z.string().max(300).optional().default(''),
  /** « À vérifier » — ce que le lecteur doit contrôler (facultatif). */
  verifier: z.string().max(160).optional().default(''),
});

/**
 * Simulation CALCULÉE au rendu (lib/academy/simulations.ts) à partir de ces
 * hypothèses — jamais des données de marché.
 */
export const simulationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('reinvestissement'),
    actions: z.number().int().positive().max(1_000_000),
    dpa: z.number().positive(),
    cours: z.number().positive(),
    croissance_pct: z.number().min(-50).max(50),
    annees: z.number().int().min(2).max(10),
  }),
  z.object({
    type: z.literal('objectif'),
    revenu_cible: z.number().positive(),
    rendements_pct: z.array(z.number().positive().max(50)).min(2).max(5),
  }),
]);
export type Simulation = z.infer<typeof simulationSchema>;

export const sectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  titre: z.string().min(1).max(120),
  contenu: z.string().min(1).max(2000),
  // ── Blocs structurés optionnels (mise en page riche type slide) ──
  stats: z.array(statSchema).max(6).optional().default([]),
  tableau: tableauSchema.nullable().optional(),
  etapes: z.array(etapeSchema).max(8).optional().default([]),
  // ── Blocs éditoriaux ──
  /** Une section `cas` ne s'intitule « Cas réel BRVM » que si elle l'est. */
  reel: z.boolean().optional().default(false),
  formules: z.array(formuleSchema).max(3).optional().default([]),
  flux: z
    .array(fluxEtapeSchema)
    .max(5)
    .optional()
    .default([])
    .refine((f) => f.length === 0 || f.length >= 2, { message: 'un schéma de mécanisme compte au moins deux étapes' }),
  points: z.array(pointSchema).max(8).optional().default([]),
  /** `frise` : étapes en frise horizontale sur ordinateur (verticale sur mobile). */
  etapes_style: z.enum(['liste', 'frise']).optional().default('liste'),
  simulation: simulationSchema.nullable().optional(),
});

export const qcmSchema = z.object({
  question: z.string().min(1).max(400),
  options: z.array(z.string().min(1).max(300)).min(2).max(5),
  correct: z.number().int().min(0),
  explication: z.string().min(1).max(600),
});

/**
 * Graphique pédagogique illustratif. Les valeurs sont des EXEMPLES (jamais
 * présentés comme des données de marché réelles) — la note porte l'interprétation.
 */
export const chartSchema = z
  .object({
    type: z.enum(['bar', 'line', 'pie']),
    titre: z.string().min(1).max(160),
    labels: z.array(z.string().min(1).max(40)).min(2).max(10),
    valeurs: z.array(z.number()).min(2).max(10),
    unite: z.string().max(20).optional().default(''),
    note: z.string().min(1).max(700), // interprétation pédagogique
    // true = données RÉELLES sourcées (études de cas) ; false = valeurs d'exemple.
    reel: z.boolean().optional().default(false),
  })
  .refine((c) => c.labels.length === c.valeurs.length, {
    message: 'labels et valeurs doivent avoir la même longueur',
  });

/** Image illustrative d'une leçon — remplie côté serveur après recherche Pexels. */
export const lessonImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(300).default(''),
  credit: z.string().max(200).default(''),
});

export const lessonSchema = z.object({
  titre: z.string().min(1).max(160),
  categorie: z.enum(CATEGORIES).default('general'),
  /** Sous-titre pédagogique de l'en-tête éditorial (facultatif). */
  sous_titre: z.string().max(160).nullable().optional(),
  resume: z.string().min(1).max(600),
  /** Mention réglementaire affichée en pied d'article (facultatif). */
  avertissement: z.string().max(300).nullable().optional(),
  sections: z.array(sectionSchema).min(1).max(8),
  chart: chartSchema.nullable().optional(),
  // Graphiques multiples (leçons enrichies) — rendus après `chart`.
  charts: z.array(chartSchema).max(4).optional().default([]),
  qcm: qcmSchema.nullable().optional(),
  // Mots-clés EN fournis par le LLM pour rechercher une image (ex. "stock market chart").
  imageQuery: z.string().max(120).nullable().optional(),
  // Rempli côté serveur après fetch Pexels (absent de la sortie LLM).
  image: lessonImageSchema.nullable().optional(),
  // ── Academy v2 ──
  // Durée de lecture estimée, affichée dans le sommaire.
  duree_min: z.number().int().min(1).max(60).nullable().optional(),
  // Liens « Pratiquer sur WESTBOURSE » (onglet Ressources du shell).
  liens: z
    .array(z.object({ label: z.string().min(1).max(120), href: z.string().min(1).max(300) }))
    .max(6)
    .optional()
    .default([]),
  // P3 : identifiant d'exercice live (registre lib/academy/exercises.ts).
  exercice_id: z.string().max(60).nullable().optional(),
  // Nom du module — regroupe les leçons dans le sommaire (organisation par niveau).
  module: z.string().max(160).nullable().optional(),
});

export const glossaireItemSchema = z.object({
  terme: z.string().min(1).max(120),
  definition: z.string().min(1).max(500),
});

export const courseContentSchema = z.object({
  titre: z.string().min(1).max(200),
  niveau: z.enum(NIVEAUX),
  intro: z.string().min(1).max(1200),
  // Visuel de couverture (bannière en tête), défini côté serveur/admin — jamais
  // par le LLM. Stocké dans content pour survivre à la régénération (préservé).
  coverUrl: z.string().url().nullable().optional(),
  // Liens « À lire aussi » vers d'autres cours (navigation pleine page).
  relatedLinks: z
    .array(z.object({ slug: z.string().min(1), label: z.string().min(1).max(120) }))
    .optional()
    .default([]),
  lessons: z.array(lessonSchema).min(1).max(20),
  glossaire: z.array(glossaireItemSchema).max(40).optional().default([]),
});

export type CourseContent = z.infer<typeof courseContentSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionStat = z.infer<typeof statSchema>;
export type SectionTableau = z.infer<typeof tableauSchema>;
export type SectionEtape = z.infer<typeof etapeSchema>;
export type Qcm = z.infer<typeof qcmSchema>;
export type Chart = z.infer<typeof chartSchema>;
export type LessonImage = z.infer<typeof lessonImageSchema>;

export const NIVEAU_LABEL: Record<Niveau, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export const CATEGORIE_LABEL: Record<Categorie, string> = {
  general: 'Général',
  income: 'Revenus',
  fundamental: 'Fondamental',
  technical: 'Technique',
  regulatory: 'Réglementaire',
  evaluation: 'Évaluation',
};

export const SECTION_LABEL: Record<SectionType, string> = {
  definition: 'Définition',
  importance: 'Pourquoi c’est important',
  // « Cas réel BRVM » s'affichait aussi sur des simulations : le libellé par
  // défaut est neutre, le réel se déclare (`reel: true`, voir libelleSection).
  cas: 'Exemple',
  piege: 'Pièges fréquents',
  lexique: 'Lexique',
  retenir: 'À retenir',
};

/** Libellé d'une section ; « Cas réel BRVM » seulement pour un cas déclaré réel. */
export function libelleSection(s: Pick<Section, 'type' | 'reel'>): string {
  if (s.type === 'cas' && s.reel) return 'Cas réel BRVM';
  return SECTION_LABEL[s.type];
}

/** Slug URL-safe depuis un titre. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

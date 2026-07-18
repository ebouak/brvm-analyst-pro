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

export const sectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  titre: z.string().min(1).max(120),
  contenu: z.string().min(1).max(2000),
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
  resume: z.string().min(1).max(600),
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
  cas: 'Cas réel BRVM',
  piege: 'Pièges fréquents',
  lexique: 'Lexique',
  retenir: 'À retenir',
};

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

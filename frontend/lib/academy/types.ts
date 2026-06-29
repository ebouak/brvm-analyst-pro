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
    type: z.enum(['bar', 'line']),
    titre: z.string().min(1).max(160),
    labels: z.array(z.string().min(1).max(40)).min(2).max(10),
    valeurs: z.array(z.number()).min(2).max(10),
    unite: z.string().max(20).optional().default(''),
    note: z.string().min(1).max(700), // interprétation pédagogique
  })
  .refine((c) => c.labels.length === c.valeurs.length, {
    message: 'labels et valeurs doivent avoir la même longueur',
  });

export const lessonSchema = z.object({
  titre: z.string().min(1).max(160),
  categorie: z.enum(CATEGORIES).default('general'),
  resume: z.string().min(1).max(600),
  sections: z.array(sectionSchema).min(1).max(8),
  chart: chartSchema.nullable().optional(),
  qcm: qcmSchema.nullable().optional(),
});

export const glossaireItemSchema = z.object({
  terme: z.string().min(1).max(120),
  definition: z.string().min(1).max(500),
});

export const courseContentSchema = z.object({
  titre: z.string().min(1).max(200),
  niveau: z.enum(NIVEAUX),
  intro: z.string().min(1).max(1200),
  lessons: z.array(lessonSchema).min(1).max(20),
  glossaire: z.array(glossaireItemSchema).max(40).optional().default([]),
});

export type CourseContent = z.infer<typeof courseContentSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Qcm = z.infer<typeof qcmSchema>;
export type Chart = z.infer<typeof chartSchema>;

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

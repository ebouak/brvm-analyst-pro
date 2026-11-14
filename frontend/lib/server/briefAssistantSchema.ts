import { z } from 'zod';

/**
 * Corps accepté par /api/brief-assistant. Les rôles `system` et `tool` sont
 * refusés : un appelant pouvait sinon injecter ses propres consignes système
 * ou de faux retours d'outils dans la conversation.
 */
export const briefBodySchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(8)
    .default([]),
});

export type BriefBody = z.infer<typeof briefBodySchema>;

// frontend/lib/forum/validation.ts
import type { TopicCategory } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const TITLE_MIN = 5;
const TITLE_MAX = 140;
const BODY_TOPIC_MIN = 10;
const BODY_MAX = 10_000;
const BODY_POST_MIN = 2;

export function validateTopicInput(input: { title: string; body: string }): Result<{ title: string; body: string }> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < TITLE_MIN) return { ok: false, error: 'Titre trop court (5 caractères minimum).' };
  if (title.length > TITLE_MAX) return { ok: false, error: 'Titre trop long (140 caractères maximum).' };
  if (body.length < BODY_TOPIC_MIN) return { ok: false, error: 'Message trop court (10 caractères minimum).' };
  if (body.length > BODY_MAX) return { ok: false, error: 'Message trop long (10 000 caractères maximum).' };
  return { ok: true, value: { title, body } };
}

export function validatePostInput(input: { body: string }): Result<{ body: string }> {
  const body = input.body.trim();
  if (body.length < BODY_POST_MIN) return { ok: false, error: 'Réponse trop courte.' };
  if (body.length > BODY_MAX) return { ok: false, error: 'Réponse trop longue (10 000 caractères maximum).' };
  return { ok: true, value: { body } };
}

export function resolveTopicLink(input: { instrumentCode: string | null; eventId: string | null }): Result<{
  instrumentCode: string | null;
  eventId: string | null;
  category: TopicCategory;
}> {
  const hasInstrument = !!input.instrumentCode;
  const hasEvent = !!input.eventId;
  if (hasInstrument && hasEvent) return { ok: false, error: "Un sujet ne peut être rattaché qu’à une action OU un événement." };
  const category: TopicCategory = hasInstrument ? 'instrument' : hasEvent ? 'evenement' : 'general';
  return { ok: true, value: { instrumentCode: input.instrumentCode, eventId: input.eventId, category } };
}

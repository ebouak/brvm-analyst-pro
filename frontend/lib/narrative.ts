// Génération de texte analytique DÉRIVÉ des métriques (§14) — jamais inventé.
import { fmtPctSigneTexte as fmtPctSigne } from './format';

export interface EventNarrativeInput {
  eventDate: string;
  code: string;
  abnormalReturnPost: number | null;
  reaction: 'positive' | 'neutral' | 'negative';
  window: number;
}

export function eventHeadline(e: EventNarrativeInput): string {
  if (e.abnormalReturnPost == null) {
    return `L’événement du ${frDate(e.eventDate)} n’a pas pu être relié à une réaction mesurable de ${e.code}.`;
  }
  const qual =
    e.reaction === 'positive' ? 'd’une surperformance' :
    e.reaction === 'negative' ? 'd’une sous-performance' : 'd’un écart';
  const seances = `${e.window} séance${e.window > 1 ? 's' : ''}`;
  return `L’événement du ${frDate(e.eventDate)} a été suivi ${qual} de ${fmtPctSigne(e.abnormalReturnPost, 1)} par rapport au BRVM Composite sur ${seances} (${e.code}).`;
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

import {
  CONSENT_VERSION,
  CONSENT_CATEGORIES,
  type ConsentCategoryId,
} from './registry';

export interface ConsentChoice {
  version: number;
  timestamp: string;
  granted: Record<ConsentCategoryId, boolean>;
}

function build(allNonEssential: boolean): ConsentChoice {
  const granted = {} as Record<ConsentCategoryId, boolean>;
  for (const cat of CONSENT_CATEGORIES) {
    granted[cat.id] = cat.required ? true : allNonEssential;
  }
  return { version: CONSENT_VERSION, timestamp: new Date().toISOString(), granted };
}

export function defaultDenied(): ConsentChoice {
  return build(false);
}

export function acceptAll(): ConsentChoice {
  return build(true);
}

export function serialize(choice: ConsentChoice): string {
  return JSON.stringify(choice);
}

export function parse(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<ConsentChoice>;
    if (obj.version !== CONSENT_VERSION || typeof obj.granted !== 'object' || !obj.granted) {
      return null;
    }
    return obj as ConsentChoice;
  } catch {
    return null;
  }
}

export function has(choice: ConsentChoice | null, id: ConsentCategoryId): boolean {
  if (!choice) return false;
  return choice.granted[id] === true;
}

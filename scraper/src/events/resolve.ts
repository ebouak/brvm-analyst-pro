/**
 * Associe des codes d'instruments à un événement à partir du nom d'émetteur
 * ou du titre, en s'appuyant sur le référentiel brvm_instruments.
 */
import type { MarketEvent } from './types.js';

export interface InstrumentRef {
  code: string;
  designation: string;
}

/** Tente de rattacher un événement à des titres connus. */
export function resolveCodes(
  event: MarketEvent,
  refs: InstrumentRef[],
): string[] {
  const found = new Set<string>(event.related_codes);
  if (event.instrument_code) found.add(event.instrument_code);

  const hay = `${event.title} ${event.issuer_name ?? ''}`.toLowerCase();
  for (const r of refs) {
    const code = r.code.toLowerCase();
    const name = r.designation.toLowerCase();
    // Match sur le code (mot entier) ou un nom suffisamment distinctif.
    if (new RegExp(`\\b${escapeRe(code)}\\b`).test(hay)) found.add(r.code);
    else if (name.length >= 4 && hay.includes(name)) found.add(r.code);
  }
  return [...found];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

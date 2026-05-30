/**
 * Helpers purs pour le calendrier économique BRVM.
 * Séparé de lib/calendar.ts (qui gère les jours de bourse).
 */

export interface CalendarItem {
  id: string;
  date: string; // YYYY-MM-DD
  datetime?: string | null; // ISO si disponible
  kind: 'ex-date' | 'payment' | 'AG' | 'RESULTAT' | 'COMMUNIQUE' | 'INTRODUCTION' | 'AUTRE';
  code: string | null;
  societe: string | null;
  secteur: string | null;
  pays: string | null;
  detail: string;
  montant?: number | null;
  href?: string;
  importance?: number | null;
}

function mapEventType(
  raw: string,
): 'AG' | 'RESULTAT' | 'COMMUNIQUE' | 'INTRODUCTION' | 'AUTRE' {
  const t = raw?.toUpperCase() ?? '';
  if (t === 'AG' || t.includes('ASSEMBL')) return 'AG';
  if (t === 'RESULTAT' || t.includes('RESULT')) return 'RESULTAT';
  if (t === 'COMMUNIQUE' || t.includes('COMMUN')) return 'COMMUNIQUE';
  if (t === 'INTRODUCTION' || t.includes('INTRO')) return 'INTRODUCTION';
  return 'AUTRE';
}

export function combineDividendsAndEvents(args: {
  dividends: Array<{
    id: string;
    code: string;
    ex_date: string | null;
    payment_date: string | null;
    montant: number;
    exercice: number | null;
  }>;
  events: Array<{
    id: string;
    event_date: string;
    event_datetime: string | null;
    title: string;
    event_type: string;
    instrument_code: string | null;
    issuer_name: string | null;
    sector: string | null;
    country_code: string | null;
    importance_level: number | null;
  }>;
  instruments: Record<string, { designation: string | null; secteur: string | null; pays: string | null }>;
}): CalendarItem[] {
  const { dividends, events, instruments } = args;
  const items: CalendarItem[] = [];

  for (const d of dividends) {
    const instr = instruments[d.code] ?? null;
    const societe = instr?.designation ?? d.code;
    const secteur = instr?.secteur ?? null;
    const pays = instr?.pays ?? null;
    const href = `/actions/${d.code}`;
    const exLabel = d.exercice ? ` exercice ${d.exercice}` : '';

    if (d.ex_date) {
      items.push({
        id: `div-ex-${d.id}`,
        date: d.ex_date,
        kind: 'ex-date',
        code: d.code,
        societe,
        secteur,
        pays,
        detail: `Ex-date dividende${exLabel}`,
        montant: d.montant,
        href,
      });
    }

    if (d.payment_date) {
      items.push({
        id: `div-pay-${d.id}`,
        date: d.payment_date,
        kind: 'payment',
        code: d.code,
        societe,
        secteur,
        pays,
        detail: `Paiement dividende${exLabel}`,
        montant: d.montant,
        href,
      });
    }
  }

  for (const e of events) {
    const kind = mapEventType(e.event_type);
    const code = e.instrument_code ?? null;
    const instr = code ? (instruments[code] ?? null) : null;
    const societe = instr?.designation ?? e.issuer_name ?? null;
    const secteur = instr?.secteur ?? e.sector ?? null;
    const pays = instr?.pays ?? e.country_code ?? null;
    const href = code
      ? `/actions/${code}`
      : `/dashboard/reports/events/${e.id}`;

    items.push({
      id: `evt-${e.id}`,
      date: e.event_date,
      datetime: e.event_datetime,
      kind,
      code,
      societe,
      secteur,
      pays,
      detail: e.title,
      importance: e.importance_level,
      href,
    });
  }

  // Sort ASC
  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}

export function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const arr = map.get(item.date) ?? [];
    arr.push(item);
    map.set(item.date, arr);
  }
  return map;
}

export function filterByKind(
  items: CalendarItem[],
  type: 'dividende' | 'event' | 'all',
): CalendarItem[] {
  if (type === 'all') return items;
  if (type === 'dividende') return items.filter((i) => i.kind === 'ex-date' || i.kind === 'payment');
  return items.filter((i) => i.kind !== 'ex-date' && i.kind !== 'payment');
}

export function iconForKind(kind: CalendarItem['kind']): string {
  switch (kind) {
    case 'ex-date': return '💰';
    case 'payment': return '💵';
    case 'AG': return '🏛️';
    case 'RESULTAT': return '📊';
    case 'COMMUNIQUE': return '📰';
    case 'INTRODUCTION': return '🆕';
    default: return '📌';
  }
}

export function colorForKind(kind: CalendarItem['kind']): string {
  switch (kind) {
    case 'ex-date':
    case 'payment': return 'border-l-2 border-l-warn';
    case 'AG': return 'border-l-2 border-l-blue';
    case 'RESULTAT': return 'border-l-2 border-l-up';
    case 'COMMUNIQUE': return 'border-l-2 border-l-purple';
    default: return 'border-l-2 border-l-muted';
  }
}

/** "2026-05-30" → "SAMEDI 30 mai 2026" */
export function fmtDateLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).toUpperCase();
}

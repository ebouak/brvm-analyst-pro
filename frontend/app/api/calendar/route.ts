import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 3600;

/**
 * Calendrier BRVM abonnable (iCalendar / RFC 5545) : ex-dates et paiements de
 * dividendes à venir + événements de marché datés (AG, résultats…).
 * S'abonne dans Google Calendar / Apple / Outlook via l'URL de ce flux —
 * les nouvelles dates apparaissent automatiquement. Données réelles uniquement.
 */

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Plie les lignes à 75 octets (RFC 5545 §3.1) — continuation par espace. */
function foldLine(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

interface IcsEvent {
  uid: string;
  date: string; // YYYY-MM-DD (événement jour entier)
  summary: string;
  description?: string;
}

function buildIcs(events: IcsEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WESTBOURSE//Calendrier BRVM//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine('X-WR-CALNAME:BRVM — Dividendes & événements (WESTBOURSE)'),
    foldLine('X-WR-CALDESC:Ex-dates et paiements de dividendes + événements de marché BRVM. Données réelles, mise à jour automatique.'),
    'X-WR-TIMEZONE:GMT',
  ];
  for (const e of events) {
    const d = e.date.replace(/-/g, '');
    // DTEND exclusif : événement « jour entier » = jour suivant.
    const next = new Date(e.date + 'T00:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    const dEnd = next.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      foldLine(`UID:${e.uid}@westbourse.com`),
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${dEnd}`,
      foldLine(`SUMMARY:${icsEscape(e.summary)}`),
      ...(e.description ? [foldLine(`DESCRIPTION:${icsEscape(e.description)}`)] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export async function GET() {
  const sb = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 365);
  const end = horizon.toISOString().slice(0, 10);

  const [{ data: divs }, { data: evts }] = await Promise.all([
    sb
      .from('dividends')
      .select('id, code, exercice, ex_date, payment_date, montant, devise')
      .or(`and(ex_date.gte.${today},ex_date.lte.${end}),and(payment_date.gte.${today},payment_date.lte.${end})`)
      .limit(500),
    sb
      .from('market_events')
      .select('id, event_date, title, event_type, instrument_code')
      .gte('event_date', today)
      .lte('event_date', end)
      .order('event_date', { ascending: true })
      .limit(200),
  ]);

  const events: IcsEvent[] = [];
  const fmtMontant = (m: number, devise: string | null) =>
    `${m.toLocaleString('fr-FR')} ${devise ?? 'FCFA'}`;

  for (const d of (divs ?? []) as {
    id: string; code: string; exercice: number | null; ex_date: string | null;
    payment_date: string | null; montant: number; devise: string | null;
  }[]) {
    const ex = d.exercice ? ` (exercice ${d.exercice})` : '';
    if (d.ex_date && d.ex_date >= today && d.ex_date <= end) {
      events.push({
        uid: `div-ex-${d.id}`,
        date: d.ex_date,
        summary: `📅 ${d.code} — ex-date dividende ${fmtMontant(d.montant, d.devise)}`,
        description: `Dernier jour pour détenir ${d.code} et toucher le dividende de ${fmtMontant(d.montant, d.devise)}${ex}. Détails : https://www.westbourse.com/actions/${d.code}`,
      });
    }
    if (d.payment_date && d.payment_date >= today && d.payment_date <= end) {
      events.push({
        uid: `div-pay-${d.id}`,
        date: d.payment_date,
        summary: `💰 ${d.code} — paiement dividende ${fmtMontant(d.montant, d.devise)}`,
        description: `Mise en paiement du dividende ${d.code}${ex}. Détails : https://www.westbourse.com/actions/${d.code}`,
      });
    }
  }

  for (const e of (evts ?? []) as {
    id: string; event_date: string; title: string; event_type: string | null; instrument_code: string | null;
  }[]) {
    events.push({
      uid: `evt-${e.id}`,
      date: e.event_date,
      summary: `${e.instrument_code ? `${e.instrument_code} — ` : ''}${e.title}`,
      description: e.instrument_code
        ? `Événement ${e.event_type ?? 'marché'} · https://www.westbourse.com/actions/${e.instrument_code}`
        : `Événement ${e.event_type ?? 'marché'} BRVM · https://www.westbourse.com`,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  return new Response(buildIcs(events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="westbourse-brvm.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

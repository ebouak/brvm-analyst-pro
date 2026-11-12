import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildEventReport } from '@/lib/reports';
import { fmtDateCourte } from '@/lib/format';
import { libelleEvenement } from '@/lib/evenements/libelles';
import { periodeDuTitre, type EvenementBrut } from '@/lib/evenements/regroupement';
import EventImpactCard from '@/components/EventImpactCard';
import ReportSummaryCard from '@/components/ReportSummaryCard';

export const dynamic = 'force-dynamic';

const FENETRE = 5;

export default async function EventReportPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createClient();
  const report = await buildEventReport(supabase, params.id, FENETRE);

  if (!report) {
    return (
      <div className="p-6">
        <Link href="/dashboard/reports/events" className="text-xs text-accent-ink">← Événements</Link>
        <div className="mt-4 bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Événement introuvable.
        </div>
      </div>
    );
  }

  const { event } = report;

  // Autres documents de la même publication (même société, même type, même période).
  const periode = periodeDuTitre(event.title);
  let pieces: EvenementBrut[] = [];
  if (periode && event.instrument_code) {
    const { data } = await supabase
      .from('market_events')
      .select('id, event_date, title, event_type, instrument_code, source_url')
      .eq('instrument_code', event.instrument_code)
      .eq('event_type', event.event_type)
      .order('event_date', { ascending: true })
      .limit(60);
    pieces = ((data ?? []) as EvenementBrut[]).filter((p) => periodeDuTitre(p.title) === periode);
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <Link href="/dashboard/reports/events" className="text-xs text-accent-ink">← Événements</Link>
        <h1 className="text-2xl font-semibold mt-1">{event.title}</h1>
        <p className="text-xs text-muted mt-1">
          {fmtDateCourte(event.event_date)} · {libelleEvenement(event.event_type)}
          {event.source_url && (
            <> · <a href={event.source_url} target="_blank" rel="noreferrer" className="text-accent-ink underline">document source</a></>
          )}
        </p>
      </div>

      {event.summary && (
        <div className="bg-surface border border-border rounded-xl p-4 text-sm text-muted">{event.summary}</div>
      )}

      {pieces.length > 1 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Documents de cette publication</h2>
          <ul className="space-y-1 text-sm">
            {pieces.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-x-2">
                <span className="tabular text-muted">{fmtDateCourte(p.event_date)}</span>
                {p.source_url
                  ? <a href={p.source_url} target="_blank" rel="noreferrer" className="text-accent-ink underline">{p.title}</a>
                  : <span>{p.title}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ReportSummaryCard headline={report.explanation.headline} why={report.explanation.why} whyTitle="Analyse" />

      <div>
        <h2 className="text-sm font-semibold mb-2">Cours autour de la publication, comparé au BRVM Composite ({FENETRE} séances)</h2>
        {report.relatedCodes.length === 0 ? (
          <p className="text-xs text-muted">Aucun titre rattaché à cet événement.</p>
        ) : (
          <div className="space-y-3">
            {report.relatedCodes.map((code) => {
              const imp = report.impact[code];
              if (!imp || !imp.found) {
                return <p key={code} className="text-xs text-muted">{code} : aucune séance cotée à partir de la date de l&apos;événement.</p>;
              }
              return <EventImpactCard key={code} code={code} impact={imp} window={FENETRE} detachements={report.detachements[code] ?? []} />;
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted">
        Écart au BRVM Composite = rendement du titre − rendement de l&apos;indice sur la fenêtre qui suit l&apos;événement.
        Mesuré autour de la date, non attribué à la publication.
      </p>
    </div>
  );
}

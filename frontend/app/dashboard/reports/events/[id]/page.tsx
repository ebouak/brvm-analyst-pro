import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildEventReport } from '@/lib/reports';
import EventImpactCard from '@/components/EventImpactCard';
import ReportSummaryCard from '@/components/ReportSummaryCard';

export const dynamic = 'force-dynamic';

export default async function EventReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const report = await buildEventReport(supabase, params.id, 5);

  if (!report) {
    return (
      <div className="p-6">
        <Link href="/dashboard/reports/events" className="text-xs text-up">← Événements</Link>
        <div className="mt-4 bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Événement introuvable.
        </div>
      </div>
    );
  }

  const { event } = report;
  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <Link href="/dashboard/reports/events" className="text-xs text-up">← Événements</Link>
        <h1 className="text-2xl font-semibold mt-1">{event.title}</h1>
        <p className="text-xs text-muted mt-1">
          {event.event_date} · {event.source} · {event.source_type} · {event.event_type}
          {event.source_url && (
            <> · <a href={event.source_url} target="_blank" rel="noreferrer" className="text-up underline">source</a></>
          )}
        </p>
      </div>

      {event.summary && (
        <div className="bg-surface border border-border rounded-xl p-4 text-sm text-muted">{event.summary}</div>
      )}

      <ReportSummaryCard headline={report.explanation.headline} why={report.explanation.why} whyTitle="Analyse" />

      <div>
        <h2 className="text-sm font-semibold mb-2">Impact avant / après (event-study, fenêtre 5 séances)</h2>
        {report.relatedCodes.length === 0 ? (
          <p className="text-xs text-muted">Aucun titre rattaché à cet événement.</p>
        ) : (
          <div className="space-y-3">
            {report.relatedCodes.map((code) => {
              const imp = report.impact[code];
              if (!imp || !imp.found) {
                return <p key={code} className="text-xs text-muted">{code} : historique insuffisant autour de l’événement.</p>;
              }
              return <EventImpactCard key={code} code={code} impact={imp} />;
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted">
        Rendement excédentaire = rendement du titre − rendement du BRVM Composite sur la fenêtre post-événement.
        Lecture indicative, non assimilable à une étude académique.
      </p>
    </div>
  );
}

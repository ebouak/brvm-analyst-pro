import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DiagnosticClient from '@/components/premium/DiagnosticClient';

interface Props { params: { code: string } }

export default async function DiagnosticPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const supa = createClient();

  const { data: instrument } = await supa
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('code', code)
    .single();

  if (!instrument) notFound();

  const { data: cached } = await supa
    .from('diagnostic_reports')
    .select('markdown_content, generated_at')
    .eq('code', code)
    .single();

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center gap-2 text-sm">
          <Link href="/actions" className="text-muted hover:text-white transition-colors">Marché</Link>
          <span className="text-faint">/</span>
          <Link href={`/actions/${code}/financials`} className="text-muted hover:text-white transition-colors">{code}</Link>
          <span className="text-faint">/</span>
          <span className="text-white">Diagnostic</span>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{code}</h1>
              <span className="px-2 py-0.5 rounded text-xs bg-warn/10 text-warn border border-warn/20 font-medium">★ Premium</span>
            </div>
            {instrument.designation && <p className="text-sm text-muted mt-0.5">{instrument.designation}</p>}
            {instrument.secteur && <p className="text-xs text-faint">{instrument.secteur}</p>}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-sm text-muted">
            Analyse sell-side générée par IA (DeepSeek / Mistral / Grok) : rentabilité, bilan, flux,
            valorisation DCF + multiples, dividende, risques et recommandation ACHAT/CONSERVER/VENDRE.
            Basée sur les états financiers disponibles. Cache 7 jours.
          </p>
        </div>

        <DiagnosticClient
          code={code}
          cachedMarkdown={cached?.markdown_content ?? null}
          cachedAt={cached?.generated_at ?? null}
        />

      </div>
    </div>
  );
}

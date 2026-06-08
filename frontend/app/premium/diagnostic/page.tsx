import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DiagnosticIndexPage() {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login');

  const { data: instruments } = await supa
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('type', 'action')
    .order('code');

  const { data: cached } = await supa
    .from('diagnostic_reports')
    .select('code, generated_at');

  const cachedMap = new Map((cached ?? []).map((r) => [r.code, r.generated_at]));

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Diagnostic financier IA</h1>
          <p className="text-sm text-muted mt-1">
            Rapport sell-side complet généré par IA (DeepSeek / Mistral / Grok) pour chaque action BRVM.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(instruments ?? []).map((inst) => {
            const gen = cachedMap.get(inst.code);
            return (
              <Link
                key={inst.code}
                href={`/premium/diagnostic/${inst.code}`}
                className="bg-surface border border-border rounded-xl p-4 hover:border-up/40 hover:bg-elevated transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{inst.code}</p>
                    {inst.designation && <p className="text-xs text-muted mt-0.5 line-clamp-1">{inst.designation}</p>}
                    {inst.secteur && <p className="text-xs text-faint">{inst.secteur}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {gen ? (
                      <span className="text-[10px] text-up font-medium">
                        ✓ {new Date(gen).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-faint">À générer</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {(!instruments || instruments.length === 0) && (
          <div className="bg-surface border border-border rounded-xl p-10 text-center">
            <p className="text-muted text-sm">Aucun instrument disponible.</p>
          </div>
        )}
      </div>
    </div>
  );
}

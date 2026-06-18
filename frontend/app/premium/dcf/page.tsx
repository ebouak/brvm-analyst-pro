import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SectionHeader, StatPill } from '@/components/ui/premium';

export const metadata = { title: 'Valorisation DCF — WESTBOURSE' };

export default async function DcfIndexPage() {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login');

  const { data: instruments } = await supa
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('type', 'action')
    .order('code');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Intelligence fondamentale"
        title="Valorisation DCF"
        subtitle="Juste-valeur par flux de trésorerie actualisés, avec un WACC dérivé du MEDAF (taux sans risque souverain, bêta réel, primes de risque pays UEMOA). Hypothèses transparentes et ajustables."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(instruments ?? []).map((inst) => (
          <Link
            key={inst.code}
            href={`/premium/dcf/${inst.code}`}
            className="bg-surface border border-border rounded-xl p-4 hover:border-info/40 hover:bg-elevated transition-all"
          >
            <p className="text-sm font-semibold text-white">{inst.code}</p>
            {inst.designation && <p className="text-xs text-muted mt-0.5 line-clamp-1">{inst.designation}</p>}
            {inst.secteur && <p className="text-xs text-faint">{inst.secteur}</p>}
          </Link>
        ))}
      </div>

      {(!instruments || instruments.length === 0) && (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">Aucun instrument disponible.</p>
        </div>
      )}
    </div>
  );
}

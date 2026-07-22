import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Analyses hebdomadaires BRVM — valeurs en vue',
  description: 'Chaque semaine, l’analyse technique des valeurs BRVM les plus actives : cours, RSI, niveaux à surveiller.',
};

export default async function HebdoIndexPage() {
  const db = createPublicClient();
  const { data } = await db
    .from('hebdo_editions')
    .select('date_edition')
    .order('date_edition', { ascending: false })
    .limit(52);
  const editions = (data ?? []) as { date_edition: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <SectionHeader
        kicker="Analyses"
        title="Analyses hebdomadaires"
        subtitle="Les valeurs BRVM en vue chaque semaine, en hausse comme en baisse."
      />
      {editions.length === 0 ? (
        <EmptyStatePremium title="Pas encore d’édition" hint="La première analyse hebdomadaire paraîtra samedi prochain." />
      ) : (
        <PremiumPanel>
          <ul className="divide-y divide-border/40">
            {editions.map((e) => (
              <li key={e.date_edition}>
                <Link href={`/analyses/hebdo/${e.date_edition}`}
                  className="flex items-center justify-between py-3 text-sm text-ivory transition-colors hover:text-accent">
                  <span>Semaine du {e.date_edition}</span>
                  <span aria-hidden className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </PremiumPanel>
      )}
    </div>
  );
}

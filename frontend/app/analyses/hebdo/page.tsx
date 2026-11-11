import type { Metadata } from 'next';
import FilAriane from '@/components/nav/FilAriane';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { fmtDateCourte } from '@/lib/format';
import { createPublicClient } from '@/lib/supabase/public';
import { EmptyStatePremium } from '@/components/ui/premium';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';

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
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <FilAriane variante="public" className="mb-6" />
      <EnTeteCote
        titre="Analyses hebdomadaires"
        description="Chaque samedi, les valeurs de la BRVM qui ont le plus bougé dans la semaine, en hausse comme en baisse, lues sur leurs cours et leur RSI."
        seance={editions[0]?.date_edition ?? null}
        libelleSeance="Dernière édition :"
        compte={editions.length > 0 ? { n: editions.length, libelle: editions.length > 1 ? 'éditions' : 'édition' } : null}
        source={null}
      />

      <div className="mt-8 border-t border-border-strong pt-6">
        {editions.length === 0 ? (
          <EmptyStatePremium title="Pas encore d’édition" hint="La première analyse hebdomadaire paraîtra samedi prochain." />
        ) : (
          <ul className="divide-y divide-border/60 rounded-card border border-border bg-surface">
            {editions.map((e, i) => (
              <li key={e.date_edition}>
                <Link
                  href={`/analyses/hebdo/${e.date_edition}`}
                  className="flex min-h-[52px] items-center justify-between gap-4 px-4 text-sm transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:px-5"
                >
                  <span className="text-ivory">
                    Semaine du <time dateTime={e.date_edition} className="tabular">{fmtDateCourte(e.date_edition)}</time>
                    {i === 0 && <span className="ml-2 text-xs text-accent-ink">la plus récente</span>}
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <LigneSource>
          Analyses produites automatiquement à partir des cours de clôture publiés par la BRVM. Contenu informatif et
          pédagogique, pas un conseil en investissement.
        </LigneSource>
      </div>
    </div>
  );
}

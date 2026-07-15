import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analyses BRVM — rendement, fiscalité, comparatifs',
  description:
    "Analyses BRVM sourcées et datées : classement du rendement du dividende, coût réel des SGI, que faire avec un budget donné. Données vérifiées, méthode reproductible.",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export default async function AnalysesIndex() {
  const db = createPublicClient();
  const { data } = await db
    .from('citable_pages')
    .select('slug, title, question, short_answer, updated_at, kind')
    .eq('published', true)
    .order('updated_at', { ascending: false });

  const pages = (data ?? []) as {
    slug: string; title: string; question: string; short_answer: string; updated_at: string; kind: string;
  }[];

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="font-display tracking-tight text-white hover:text-accent">WESTBOURSE</Link>
          <Link href="/" className="text-sm text-muted hover:text-white">← Accueil</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <SectionHeader
          kicker="Analyses"
          title="Analyses BRVM"
          subtitle="Sourcées, datées, reproductibles. Une question, une réponse, la méthode."
        />

        {pages.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
            Aucune analyse publiée pour le moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {pages.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/analyses/${p.slug}`}
                  className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
                >
                  <h2 className="font-display text-lg text-white">{p.title}</h2>
                  <p className="mt-1 text-sm text-muted">{p.short_answer.slice(0, 160)}…</p>
                  {fmtDate(p.updated_at) && (
                    <p className="mt-2 text-[11px] text-faint">Mis à jour le {fmtDate(p.updated_at)}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

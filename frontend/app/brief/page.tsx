import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';
import { fmtDateFR, fmtDateCourte } from '@/lib/format';

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
const TELEGRAM_CHANNEL_URL = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL ?? '';

export const metadata: Metadata = {
  title: 'Brief quotidien BRVM — Résumé de séance',
  description:
    'Le résumé quotidien de la séance BRVM : indices, plus fortes hausses et baisses, volumes et actualités. Gratuit, composé après chaque clôture depuis les données officielles.',
  alternates: { canonical: `${SITE_URL}/brief` },
};

const BOUTON_SECONDAIRE =
  'inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-xs text-muted transition-colors hover:border-border-strong hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-[32px]';

export default async function BriefPage() {
  const supabase = createPublicClient();
  const { data: briefs } = await supabase
    .from('brief_daily')
    .select('date_marche, contenu, sent_at')
    .order('date_marche', { ascending: false })
    .limit(20);

  const list = (briefs ?? []) as Array<{ date_marche: string; contenu: string; sent_at: string | null }>;

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl">
        <EnTeteCote
          titre="Le résumé de séance, chaque jour"
          description="Indices, hausses, baisses, volumes et actualités, composés après chaque clôture à partir des données officielles de la BRVM."
          seance={list[0]?.date_marche ?? null}
          libelleSeance="Dernier brief : séance du"
          source="Source BRVM"
          actions={
            TELEGRAM_CHANNEL_URL ? (
              <a
                href={TELEGRAM_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-5 text-sm font-semibold text-bg transition-colors hover:bg-accent/90 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Recevoir le brief sur Telegram
              </a>
            ) : undefined
          }
        />

        <div className="mt-8 border-t border-border-strong pt-6">
          {list.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-5 py-6 text-sm text-muted">
              Le premier brief sera publié après la prochaine clôture de séance.
            </p>
          ) : (
            <ol className="space-y-4">
              {list.map((b) => (
                <li key={b.date_marche}>
                  <article aria-labelledby={`b-${b.date_marche}`} className="rounded-card border border-border bg-surface p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 id={`b-${b.date_marche}`} className="text-base font-medium text-ivory">
                        <Link href={`/brief/${b.date_marche}`} className="rounded hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                          Séance du <time dateTime={b.date_marche} className="tabular">{fmtDateCourte(b.date_marche)}</time>
                        </Link>
                      </h2>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(b.contenu)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={BOUTON_SECONDAIRE}
                        aria-label={`Partager le brief du ${fmtDateFR(b.date_marche)} sur WhatsApp`}
                      >
                        Partager sur WhatsApp
                      </a>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ivory/90">{b.contenu}</pre>
                    <Link href={`/brief/${b.date_marche}`} className="mt-3 inline-flex min-h-[44px] items-center rounded text-sm text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0">
                      Lire la note complète
                    </Link>
                  </article>
                </li>
              ))}
            </ol>
          )}
          <LigneSource>Les vingt dernières séances. Chiffres tirés des cours et indices publiés par la BRVM.</LigneSource>
        </div>
      </div>
    </PublicShell>
  );
}

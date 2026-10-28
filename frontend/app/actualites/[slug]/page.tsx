import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createPublicClient } from '@/lib/supabase/public';
import { jsonLdScript } from '@/lib/jsonLd';
import { COLONNES_ARTICLE, LIBELLE_TYPE, type Article } from '@/lib/articles/types';

/*
 * Article de presse généré depuis la donnée BRVM (spec 2026-10-28). Public, ISR.
 * PAS de loading.tsx au-dessus de cette route : notFound() doit rendre un vrai
 * 404, pas un 200 diffusé en flux (CLAUDE.md, soft-404 du 2026-09-17).
 */
export const revalidate = 300;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

async function charger(slug: string): Promise<Article | null> {
  const { data } = await createPublicClient().from('articles').select(COLONNES_ARTICLE).eq('slug', slug).maybeSingle();
  return (data as Article | null) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await charger(params.slug);
  if (!a) return {};
  const image = `${SITE}/api/articles/${a.slug}/image`;
  return {
    title: a.titre,
    description: a.chapo,
    alternates: { canonical: `${SITE}/actualites/${a.slug}` },
    openGraph: { type: 'article', title: a.titre, description: a.chapo, images: [image], publishedTime: a.publie_le ?? undefined },
    twitter: { card: 'summary_large_image', title: a.titre, description: a.chapo, images: [image] },
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const a = await charger(params.slug);
  if (!a) notFound();

  const date = new Date(a.publie_le ?? `${a.date_fait}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.titre,
    description: a.chapo,
    image: [`${SITE}/api/articles/${a.slug}/image`],
    datePublished: a.publie_le,
    author: { '@type': 'Organization', name: 'WESTBOURSE' },
    publisher: { '@type': 'Organization', name: 'WESTBOURSE' },
    mainEntityOfPage: `${SITE}/actualites/${a.slug}`,
  };

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />
      <nav className="text-xs text-faint">
        <Link href="/actualites" className="hover:text-accent">
          Actualités
        </Link>
        {' · '}
        {LIBELLE_TYPE[a.type] ?? 'Article'}
        {a.code ? (
          <>
            {' · '}
            <Link href={`/societes/${a.code}`} className="hover:text-accent">
              {a.code}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="space-y-3">
        <h1 className="font-display text-2xl text-white md:text-3xl">{a.titre}</h1>
        <p className="text-[15px] leading-relaxed text-ivory">{a.chapo}</p>
        <p className="text-xs text-faint">{date} · La rédaction WESTBOURSE</p>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/articles/${a.slug}/image`}
        alt={a.titre}
        width={1200}
        height={630}
        className="w-full rounded-xl border border-border"
      />

      <div className="space-y-3 text-sm leading-relaxed text-muted [&_a]:text-accent [&_a]:underline [&_em]:text-faint [&_h2]:pt-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-white [&_strong]:text-ivory">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.corps_md}</ReactMarkdown>
      </div>

      {Array.isArray(a.chiffres.liens) && a.chiffres.liens.length > 0 ? (
        <aside className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wide text-faint">À lire aussi</p>
          <ul className="space-y-1.5">
            {(a.chiffres.liens as { slug: string; titre: string }[]).map((l) => (
              <li key={l.slug}>
                <Link href={`/actualites/${l.slug}`} className="text-sm text-ivory hover:text-accent">
                  {l.titre}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {a.sources.length > 0 ? (
        <footer className="border-t border-border/60 pt-4 text-xs text-faint">
          Sources :{' '}
          {a.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 ? ' ; ' : ''}
              <a href={s.url} className="hover:text-accent" rel="noopener noreferrer" target="_blank">
                {s.label}
              </a>
            </span>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

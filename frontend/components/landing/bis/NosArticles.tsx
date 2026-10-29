import Link from 'next/link';
import { LIBELLE_TYPE } from '@/lib/articles/types';
import type { ArticleLanding } from '@/lib/landing/articlesUne';

/**
 * « Nos articles » — la une (un décryptage récent de préférence) et les trois
 * articles suivants. Rendu serveur, aucun JavaScript. Sans article publié, la
 * section n'existe pas : pas de bloc vide sur la vitrine.
 */
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const jour = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d);
};
const kicker = (a: ArticleLanding) => `${LIBELLE_TYPE[a.type] ?? 'Article'}${a.code ? ` · ${a.code}` : ''} · ${jour(a.date_fait)}`;

export function NosArticles({ une, autres }: { une: ArticleLanding | null; autres: ArticleLanding[] }) {
  if (!une) return null;
  return (
    <section className="articles" aria-labelledby="h-articles">
      <div className="articles-head">
        <div>
          <p className="over">Analyses et actualités</p>
          <h2 id="h-articles">Nos articles</h2>
          <p className="lead">Rédigés à partir des données de la plateforme, sources citées. Aucun n&apos;est un conseil en investissement.</p>
        </div>
        <Link href="/actualites" className="btn btn-ghost">
          Toutes les actualités <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className={`articles-grid${autres.length === 0 ? ' seul' : ''}`}>
        <Link href={`/actualites/${une.slug}`} className="card art-une">
          {/* Image générée par /api/articles/[slug]/image (mise en cache 24 h) ; décorative, le titre suit. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/articles/${encodeURIComponent(une.slug)}/image`} alt="" width={1200} height={630} loading="lazy" decoding="async" />
          <div className="art-txt">
            <p className="over">{kicker(une)}</p>
            <h3>{une.titre}</h3>
            <p>{une.chapo}</p>
            <span className="lire">
              {une.type === 'decryptage' ? 'Lire le décryptage' : "Lire l'article"} <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
        {autres.length > 0 && (
          <ul className="art-liste">
            {autres.map((a) => (
              <li key={a.slug}>
                <Link href={`/actualites/${a.slug}`} className="card art-mini">
                  <p className="over">{kicker(a)}</p>
                  <h3>{a.titre}</h3>
                  <p>{a.chapo}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

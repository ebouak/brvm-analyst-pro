import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import ArticleStatutBoutons from '@/components/admin/ArticleStatutBoutons';
import { LIBELLE_TYPE } from '@/lib/articles/types';
import type { DecryptageDonnees } from '@/lib/articles/decryptage';
import DecryptageVue from '@/components/decryptage/DecryptageVue';

export const dynamic = 'force-dynamic';

/**
 * Relecture d'un article AVANT publication : la RLS le cache au public tant
 * qu'il n'est pas publié, la page le lit donc côté serveur (content.publish).
 */
export default async function RelireArticlePage({ params }: { params: { id: string } }) {
  await requirePermission('content.publish');
  const { data } = await getServiceClient()
    .from('articles')
    .select('id, slug, type, titre, chapo, corps_md, chiffres, statut, raison_blocage, date_fait')
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as { id: string; slug: string; type: string; titre: string; chapo: string; corps_md: string; chiffres: { decryptage?: DecryptageDonnees } | null; statut: string; raison_blocage: string | null; date_fait: string };
  const decryptage = a.chiffres?.decryptage?.version === 1 ? a.chiffres.decryptage : null;

  return (
    <div className={`${decryptage ? 'max-w-5xl' : 'max-w-3xl'} space-y-6 p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/articles" className="text-xs text-faint hover:text-accent">
          ← Articles de presse
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Statut : {a.statut}</span>
          <ArticleStatutBoutons id={a.id} statut={a.statut} />
        </div>
      </div>
      {a.raison_blocage ? <p className="text-xs text-down">Verrous en échec : {a.raison_blocage}</p> : null}
      {decryptage ? (
        <DecryptageVue d={decryptage} />
      ) : (
        <>
      <p className="text-[11px] uppercase tracking-wide text-accent">
        {LIBELLE_TYPE[a.type] ?? a.type} · {a.date_fait}
      </p>
      <h1 className="font-display text-2xl text-white">{a.titre}</h1>
      <p className="text-[15px] leading-relaxed text-ivory">{a.chapo}</p>
      <div className="space-y-3 text-sm leading-relaxed text-muted [&_a]:text-accent [&_a]:underline [&_em]:text-faint [&_h2]:pt-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-white [&_strong]:text-ivory [&_table]:w-full [&_table]:text-xs [&_td]:border-b [&_td]:border-border/40 [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-faint [&_ul]:list-disc [&_ul]:pl-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.corps_md}</ReactMarkdown>
      </div>
        </>
      )}
    </div>
  );
}

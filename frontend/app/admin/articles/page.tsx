import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import ArticleStatutBoutons from '@/components/admin/ArticleStatutBoutons';
import GenererDecryptage from '@/components/admin/GenererDecryptage';
import { LIBELLE_TYPE } from '@/lib/articles/types';
import EnvoyerArticleEmail from '@/components/admin/EnvoyerArticleEmail';
import { chargerCampagnes, compterAbonnesConfirmes } from '@/lib/admin/articleCampagnes';
import { libelleCampagne, peutRelancer } from '@/lib/email/articleEmail';

export const dynamic = 'force-dynamic';

const ORDRE = ['a_valider', 'brouillon', 'publie', 'rejete'];
const TON: Record<string, string> = { publie: 'text-up', brouillon: 'text-down', a_valider: 'text-accent', rejete: 'text-faint' };

export default async function AdminArticlesPage() {
  await requirePermission('content.publish');
  const svc = getServiceClient();
  const { data: instr } = await svc.from('brvm_instruments').select('code').eq('type', 'action').eq('actif', true).order('code');
  const codes = ((instr ?? []) as { code: string }[]).map((i) => i.code);
  const { data } = await svc
    .from('articles')
    .select('id, slug, type, titre, statut, raison_blocage, date_fait, diffuse')
    .order('created_at', { ascending: false })
    .limit(60);
  const articles = (
    (data ?? []) as {
      id: string;
      slug: string;
      type: string;
      titre: string;
      statut: string;
      raison_blocage: string | null;
      date_fait: string;
      diffuse: { mode?: string; whatsapp?: string; telegram?: string } | null;
    }[]
  ).sort((a, b) => ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut));
  const [campagnes, abonnes] = await Promise.all([
    chargerCampagnes(svc, articles.filter((a) => a.statut === 'publie').map((a) => a.id)),
    compterAbonnesConfirmes(svc),
  ]);

  return (
    <div className="space-y-4 p-6">
      <h1 className="font-display text-xl text-white">Articles de presse</h1>
      <p className="text-sm text-muted">
        Dividendes, détachements, paiements, opérations sur titres et séances hors norme sont publiés automatiquement
        quand leurs verrous passent. Un brouillon indique le verrou qui a échoué. Les décryptages arrivent « à
        valider » : relisez-les sur la page avant de publier. Un article publié peut être envoyé une fois aux abonnés
        confirmés de la newsletter (colonne Diffusion).
      </p>
      <GenererDecryptage codes={codes} />
      {articles.length === 0 ? (
        <p className="text-sm text-faint">Aucun article pour le moment.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
              <th className="px-3 py-2">Article</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Diffusion</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id} className="border-b border-border/40 align-top">
                <td className="px-3 py-2">
                  <span className="text-[11px] uppercase text-accent">
                    {LIBELLE_TYPE[a.type] ?? a.type} · {a.date_fait}
                  </span>
                  <p className="text-ivory">{a.titre}</p>
                  {a.statut === 'publie' ? (
                    <Link href={`/actualites/${a.slug}`} className="text-xs text-faint hover:text-accent">
                      Voir la page
                    </Link>
                  ) : a.statut === 'a_valider' ? (
                    <Link href={`/admin/articles/${a.id}`} className="text-xs text-accent hover:underline">
                      Relire avant publication
                    </Link>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span className={TON[a.statut] ?? 'text-faint'}>{a.statut}</span>
                  {a.raison_blocage ? <p className="text-xs text-faint">{a.raison_blocage}</p> : null}
                </td>
                <td className="space-y-2 px-3 py-2 text-xs text-muted">
                  <p>{a.diffuse ? `${a.diffuse.mode ?? ''} · WA ${a.diffuse.whatsapp ?? '—'} · TG ${a.diffuse.telegram ?? '—'}` : '—'}</p>
                  {a.statut === 'publie' &&
                    (() => {
                      const c = campagnes.get(a.id) ?? null;
                      return (
                        <EnvoyerArticleEmail
                          id={a.id}
                          titre={a.titre}
                          abonnes={abonnes}
                          trace={c ? libelleCampagne(c) : null}
                          relancable={peutRelancer(c)}
                        />
                      );
                    })()}
                </td>
                <td className="px-3 py-2">
                  <ArticleStatutBoutons id={a.id} statut={a.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

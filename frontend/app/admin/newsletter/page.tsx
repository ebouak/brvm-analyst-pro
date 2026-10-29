import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadNewsletter } from '@/lib/admin/newsletter';
import { CampaignForm, UnsubscribeButton, ResendConfirmationsButton } from './CampaignForm';
import Link from 'next/link';
import { getServiceClient } from '@/lib/billing/serviceClient';
import EnvoyerArticleEmail from '@/components/admin/EnvoyerArticleEmail';
import { chargerCampagnes } from '@/lib/admin/articleCampagnes';
import { libelleCampagne, peutRelancer } from '@/lib/email/articleEmail';
import { LIBELLE_TYPE } from '@/lib/articles/types';

/** Derniers articles publiés, avec leur trace d'envoi email (migration 0169). */
async function articlesEnvoyables() {
  const db = getServiceClient();
  const { data } = await db
    .from('articles')
    .select('id, slug, type, titre, date_fait')
    .eq('statut', 'publie')
    .order('publie_le', { ascending: false })
    .limit(6);
  const articles = (data ?? []) as { id: string; slug: string; type: string; titre: string; date_fait: string }[];
  const campagnes = await chargerCampagnes(db, articles.map((a) => a.id));
  return articles.map((a) => ({ ...a, campagne: campagnes.get(a.id) ?? null }));
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Newsletter — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function Page({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await requirePermission('content.read');
  const search = searchParams.q ?? '';
  const { subscribers, kpis } = await loadNewsletter(search);
  const canCampaign = ctx.isSuperAdmin || ctx.permissions.has('content.publish');
  const envoyables = canCampaign ? await articlesEnvoyables() : [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Administration" title="Newsletter" subtitle="Abonnés, export et campagne d'emailing." />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Abonnés" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Confirmés" value={nf.format(kpis.confirmed)} accent="emerald" />
        <MetricCard label="Taux de confirmation" value={kpis.rate == null ? DASH : `${Math.round(kpis.rate * 100)} %`} accent="neutral" />
      </div>

      {canCampaign && <ResendConfirmationsButton pending={kpis.total - kpis.confirmed} />}
      {canCampaign && (
        <section className="rounded-panel border border-border bg-surface p-5">
          <h2 className="font-display text-base text-ivory">Envoyer un article publié</h2>
          <p className="mt-1 text-xs text-muted">
            Titre, image, chapô et, pour un décryptage, ses chiffres clés, avec un lien vers la page. Une seule fois par
            article, aux abonnés confirmés.
          </p>
          {envoyables.length === 0 ? (
            <p className="mt-3 text-sm text-faint">Aucun article publié.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/40">
              {envoyables.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <span className="text-[11px] uppercase text-accent">
                      {LIBELLE_TYPE[a.type] ?? a.type} · {a.date_fait}
                    </span>
                    <Link href={`/actualites/${a.slug}`} className="block text-sm text-ivory hover:text-accent">
                      {a.titre}
                    </Link>
                  </div>
                  <EnvoyerArticleEmail
                    id={a.id}
                    titre={a.titre}
                    abonnes={kpis.confirmed}
                    trace={a.campagne ? libelleCampagne(a.campagne) : null}
                    relancable={peutRelancer(a.campagne)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {canCampaign && <CampaignForm />}

      <div className="flex items-center justify-between gap-3">
        <form className="flex-1" action="/admin/newsletter" method="get">
          <input name="q" defaultValue={search} placeholder="Rechercher un email…" className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory" />
        </form>
        <a href="/admin/newsletter/export" className="rounded-lg border border-border px-4 py-2 text-sm text-ivory hover:bg-surface">Exporter CSV</a>
      </div>

      {subscribers.length === 0 ? (
        <EmptyStatePremium title="Aucun abonné" hint="Les inscriptions à la newsletter apparaîtront ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Inscrit le</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-ivory">{s.email}</td>
                  <td className="px-4 py-2.5">{s.confirmed ? <StatPill tone="emerald">Confirmé</StatPill> : <StatPill tone="neutral">En attente</StatPill>}</td>
                  <td className="px-4 py-2.5 text-muted">{s.source}</td>
                  <td className="px-4 py-2.5 text-muted tabular">{fmtDate(s.subscribed_at)}</td>
                  <td className="px-4 py-2.5">{s.confirmed ? <UnsubscribeButton id={s.id} /> : <span className="text-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}

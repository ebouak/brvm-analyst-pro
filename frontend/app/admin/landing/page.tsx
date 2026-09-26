import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { PERMANENT_SLIDES, MAX_SLIDES, MIN_PERMANENT, estAffichable, publicImageUrl, type LandingSlideRow } from '@/lib/landing/slides';
import { SlideForm, SlideRowActions } from './SlideForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Landing — À la une — Administration' };

const fmt = (d: string | null) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default async function Page() {
  const ctx = await requirePermission('content.read');
  const canEdit = ctx.isSuperAdmin || ctx.permissions.has('content.publish');
  const db = getServiceClient();
  const { data } = await db.from('landing_slides')
    .select('id, kind, title, subtitle, cta_label, link_url, image_path, sponsor_name, starts_at, ends_at, is_active, position, placement, created_at')
    .order('position').order('starts_at');
  const rows = (data ?? []) as (LandingSlideRow & { created_at: string })[];
  const now = new Date();
  const affichables = rows.filter((r) => estAffichable(r, now));
  const visibles = affichables.filter((r) => (r.placement ?? 'hero') === 'hero').length;
  const enBandeau = affichables.filter((r) => r.placement === 'billboard').length;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Administration" title="Landing — À la une" subtitle="Publicités et annonces : en bandeau (toutes tournent, une par chargement) ou dans le carrousel du hero, en plus des vues permanentes du produit." />
      <div className="gold-rule" />
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Vues permanentes" value={String(PERMANENT_SLIDES.length)} accent="sapphire" />
        <MetricCard label="Créations en bandeau" value={String(enBandeau)} accent="emerald" />
        <MetricCard label="Carrousel" value={`${Math.min(visibles, MAX_SLIDES - MIN_PERMANENT)} / ${MAX_SLIDES - MIN_PERMANENT} places`} accent="neutral" />
      </div>

      {canEdit && <SlideForm />}

      {rows.length === 0 ? (
        <EmptyStatePremium title="Aucune diapositive admin" hint="La landing n'affiche que ses vues permanentes." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Aperçu</th>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Emplacement</th>
                <th className="px-4 py-3 font-medium">Fenêtre</th>
                <th className="px-4 py-3 font-medium">Pos.</th>
                <th className="px-4 py-3 font-medium">État</th>
                {canEdit && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = estAffichable(r, now);
                return (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={publicImageUrl(base, r.image_path)} alt="" width={96} height={64} className="h-16 w-24 rounded-md object-cover" loading="lazy" />
                    </td>
                    <td className="px-4 py-2.5 text-ivory">{r.title}{r.sponsor_name && <span className="block text-xs text-muted">{r.sponsor_name}</span>}</td>
                    <td className="px-4 py-2.5">{(r.placement ?? 'hero') === 'billboard' ? <StatPill tone="emerald">Bandeau</StatPill> : <StatPill tone="neutral">Carrousel</StatPill>}</td>
                    <td className="px-4 py-2.5">{r.kind === 'ad' ? <StatPill tone="neutral">Publicité</StatPill> : <StatPill tone="emerald">Maison</StatPill>}</td>
                    <td className="px-4 py-2.5 text-xs text-muted tabular">{fmt(r.starts_at)} → {r.ends_at ? fmt(r.ends_at) : 'sans fin'}</td>
                    <td className="px-4 py-2.5 tabular">{r.position}</td>
                    <td className="px-4 py-2.5">{on ? <StatPill tone="emerald">Visible</StatPill> : r.is_active ? <StatPill tone="neutral">Hors fenêtre</StatPill> : <StatPill tone="neutral">Inactive</StatPill>}</td>
                    {canEdit && <td className="px-4 py-2.5"><SlideRowActions id={r.id} active={r.is_active} /></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}

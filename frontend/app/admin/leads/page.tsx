import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadLeads } from '@/lib/admin/leads';
import { LEAD_STATUTS, STATUT_LABEL, type LeadStatut } from '@/lib/leads';
import LeadRowActions from './LeadRowActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads débutants — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

const NIVEAU_LABEL: Record<string, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  confirme: 'Confirmé',
};

const STATUT_TONE: Record<LeadStatut, 'sapphire' | 'gold' | 'emerald' | 'neutral'> = {
  nouveau: 'sapphire',
  contacte: 'gold',
  converti: 'emerald',
  perdu: 'neutral',
};

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function Page({ searchParams }: { searchParams: { q?: string; statut?: string } }) {
  const ctx = await requirePermission('leads.read');
  const search = searchParams.q ?? '';
  const statut = searchParams.statut ?? 'tous';
  const { rows, kpis } = await loadLeads({ search, statut });
  const canWrite = ctx.isSuperAdmin || ctx.permissions.has('leads.write');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Leads débutants"
        subtitle="Demandes de contact issues du tunnel /debutant. Recontactez par WhatsApp et suivez l'avancement."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Nouveaux" value={nf.format(kpis.nouveau)} accent="gold" />
        <MetricCard label="Contactés" value={nf.format(kpis.contacte)} accent="neutral" />
        <MetricCard label="Convertis" value={nf.format(kpis.converti)} accent="emerald" />
      </div>

      <form className="flex flex-wrap items-center gap-3" action="/admin/leads" method="get">
        <input
          name="q"
          defaultValue={search}
          placeholder="Rechercher un nom ou email…"
          className="flex-1 min-w-[12rem] max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory"
        />
        <select
          name="statut"
          aria-label="Filtrer par statut"
          defaultValue={statut}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory"
        >
          <option value="tous">Tous les statuts</option>
          {LEAD_STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_LABEL[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm text-ivory hover:bg-surface">
          Filtrer
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyStatePremium title="Aucun lead" hint="Les demandes de contact des débutants apparaîtront ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Niveau</th>
                <th className="px-4 py-3 font-medium">Pays</th>
                <th className="px-4 py-3 font-medium">Reçu le</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-border/40 align-top last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ivory">{l.nom}</div>
                    <div className="text-xs text-muted">{l.email}</div>
                    {l.telephone && <div className="text-xs text-muted tabular">{l.telephone}</div>}
                    {l.message && <div className="mt-1 max-w-xs text-xs italic text-faint line-clamp-2">« {l.message} »</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{l.niveau ? NIVEAU_LABEL[l.niveau] : DASH}</td>
                  <td className="px-4 py-2.5 text-muted">{l.pays ?? DASH}</td>
                  <td className="px-4 py-2.5 text-muted tabular">{fmtDate(l.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <StatPill tone={STATUT_TONE[l.statut]}>{STATUT_LABEL[l.statut]}</StatPill>
                  </td>
                  <td className="px-4 py-2.5">
                    <LeadRowActions id={l.id} statut={l.statut} nom={l.nom} telephone={l.telephone} canWrite={canWrite} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}

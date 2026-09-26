import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, PremiumPanel, MetricCard, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import SessionForm from './SessionForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sessions live — administration' };

export default async function AdminFormationsSessionsPage() {
  await requirePermission('content.read');
  const db = getServiceClient();

  const { data: sessions } = await db
    .from('formation_sessions')
    .select('id, titre, niveau, debut_at, modalite, places, places_prises, prix, statut')
    .order('debut_at', { ascending: false });

  const { data: inscriptions } = await db
    .from('formation_inscriptions')
    .select('id, statut, session_id, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const lignes = (sessions ?? []) as { id: string; titre: string; niveau: string; debut_at: string; modalite: string; places: number; places_prises: number; prix: number; statut: string }[];
  const ins = (inscriptions ?? []) as { id: string; statut: string; session_id: string }[];
  const payees = ins.filter((i) => i.statut === 'payee').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <SectionHeader kicker="Administration" title="Formations en direct" subtitle="Séances, places et inscriptions." />
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Séances" value={String(lignes.length)} accent="sapphire" />
        <MetricCard label="Inscriptions" value={String(ins.length)} accent="neutral" />
        <MetricCard label="Places payées" value={String(payees)} accent="emerald" />
      </div>

      <SessionForm />

      {lignes.length === 0 ? (
        <EmptyStatePremium title="Aucune séance" hint="Créez une séance ci-dessus : elle démarre en brouillon." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Séance</th>
                <th scope="col" className="px-4 py-3 font-medium">Début</th>
                <th scope="col" className="px-4 py-3 font-medium">Places</th>
                <th scope="col" className="px-4 py-3 font-medium">Prix</th>
                <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-ivory">{s.titre}</th>
                  <td className="px-4 py-2.5 tabular text-xs text-muted">{new Date(s.debut_at).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 tabular">{s.places_prises} / {s.places}</td>
                  <td className="px-4 py-2.5 tabular">{Number(s.prix).toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-2.5"><StatPill tone={s.statut === 'ouverte' ? 'emerald' : 'neutral'}>{s.statut}</StatPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}

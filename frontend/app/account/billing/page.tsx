import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Facturation' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS: Record<string, { label: string; tone: 'gold' | 'emerald' | 'sapphire' | 'neutral' }> = {
  paid: { label: 'Payé', tone: 'emerald' },
  pending: { label: 'En attente', tone: 'sapphire' },
  failed: { label: 'Échec', tone: 'gold' },
  refunded: { label: 'Remboursé', tone: 'neutral' },
};

interface TxnRow {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string | null;
}

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const { data } = await db
    .from('billing_transactions')
    .select('id, provider, amount, currency, status, paid_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const txns: TxnRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    provider: r.provider as string,
    amount: Number(r.amount ?? 0),
    currency: (r.currency as string) ?? 'XOF',
    status: r.status as string,
    paid_at: (r.paid_at as string) ?? null,
    created_at: (r.created_at as string) ?? null,
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Compte" title="Facturation" subtitle="Historique de vos transactions." />
      <div className="gold-rule" />

      {txns.length === 0 ? (
        <EmptyStatePremium title="Aucune transaction" hint="Vos paiements apparaîtront ici après votre première souscription." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Référence</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const st = STATUS[t.status] ?? { label: t.status, tone: 'neutral' as const };
                return (
                  <tr key={t.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-muted tabular">{fmtDate(t.paid_at ?? t.created_at)}</td>
                    <td className="px-4 py-2.5 text-muted">{t.id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5 text-right text-ivory tabular">{nf.format(Math.round(t.amount))} {t.currency}</td>
                    <td className="px-4 py-2.5"><StatPill tone={st.tone}>{st.label}</StatPill></td>
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

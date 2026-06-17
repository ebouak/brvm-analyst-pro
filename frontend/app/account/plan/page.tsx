import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { PlanClient, type PlanOption } from './PlanClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mon abonnement' };

const DASH = '—';

function fmtDate(d: string | null | undefined): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const [{ data: profile }, { data: plansRaw }, { data: sub }] = await Promise.all([
    db.from('profiles').select('is_premium, premium_since').eq('id', user.id).maybeSingle(),
    db
      .from('subscription_plans')
      .select('code, name, price_monthly, price_yearly, currency')
      .eq('is_active', true)
      .neq('code', 'free')
      .order('sort_order', { ascending: true }),
    db
      // Exclut l'abonnement « free » (trace du choix gratuit) : seul un
      // abonnement payant pending/active bloque une nouvelle souscription.
      .from('subscriptions')
      .select('id, status, billing_cycle, renews_at, subscription_plans!inner(code)')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active'])
      .neq('subscription_plans.code', 'free')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const isPremium = Boolean(profile?.is_premium);
  const plans: PlanOption[] = (plansRaw ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    price_monthly: Number(p.price_monthly ?? 0),
    price_yearly: p.price_yearly == null ? null : Number(p.price_yearly),
    currency: (p.currency as string) ?? 'XOF',
  }));

  const subStatus = sub?.status as string | undefined;
  const canSubscribe = !sub;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Compte" title="Mon abonnement" subtitle="Votre formule et vos options Premium." />
      <div className="gold-rule" />

      <div className="rounded-panel border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Statut actuel</p>
            <p className="mt-1 font-display text-lg text-ivory">{isPremium ? 'Premium' : 'Gratuit'}</p>
          </div>
          {isPremium ? (
            <StatPill tone="gold">Actif</StatPill>
          ) : subStatus === 'pending' ? (
            <StatPill tone="sapphire">En attente</StatPill>
          ) : (
            <StatPill tone="neutral">Gratuit</StatPill>
          )}
        </div>
        {isPremium && (
          <p className="mt-3 text-sm text-muted">
            Premium depuis le {fmtDate(profile?.premium_since)}
            {sub?.renews_at ? ` · prochaine échéance le ${fmtDate(sub.renews_at)}` : ''}.
          </p>
        )}
        {subStatus === 'pending' && !isPremium && (
          <p className="mt-3 text-sm text-muted">
            Votre demande Premium est enregistrée et en attente de confirmation du paiement.
          </p>
        )}
      </div>

      <PlanClient plans={plans} canSubscribe={canSubscribe} />
    </div>
  );
}

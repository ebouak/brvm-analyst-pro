import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { niveauxAchetes } from '@/lib/server/academyAccess';
import { NIVEAU_LABEL, type Niveau } from '@/lib/academy/types';
import { prixAffiche } from '@/lib/billing/chariow/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mes achats' };

/**
 * « Mes achats » : commandes Chariow et droits ouverts. Lecture par la
 * SESSION : la RLS n'expose que les lignes de l'utilisateur connecté.
 */

const STATUT: Record<string, { label: string; tone: 'gold' | 'sapphire' | 'neutral' }> = {
  paid: { label: 'Payé', tone: 'gold' },
  pending: { label: 'En attente', tone: 'sapphire' },
  failed: { label: 'Non abouti', tone: 'neutral' },
  refunded: { label: 'Remboursé', tone: 'neutral' },
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const p = new Date(d);
  return Number.isNaN(p.getTime()) ? '—' : p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function MesAchatsPage() {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login?next=/account/achats');

  const [{ data: txns }, { data: droits }, ouverts] = await Promise.all([
    db
      .from('billing_transactions')
      .select('id, objet, product_code, amount, currency, status, created_at, paid_at')
      .eq('provider', 'chariow')
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('user_entitlements')
      .select('id, product_code, niveau, granted_at, revoked_at')
      .order('granted_at', { ascending: false }),
    niveauxAchetes(user.id),
  ]);

  const commandes = (txns ?? []) as {
    id: string; objet: string; product_code: string | null; amount: number; currency: string;
    status: string; created_at: string; paid_at: string | null;
  }[];
  const acces = (droits ?? []) as {
    id: string; product_code: string; niveau: Niveau | null; granted_at: string; revoked_at: string | null;
  }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <SectionHeader kicker="Compte" title="Mes achats" subtitle="Niveaux de l’Academy et pass achetés via Chariow." />

      <section aria-labelledby="h-acces" className="rounded-panel border border-border bg-surface p-5">
        <h2 id="h-acces" className="font-display text-lg text-white">Mes accès</h2>
        {acces.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Aucun niveau acheté à l’unité.{' '}
            <Link href="/formations/academy" className="text-accent underline">
              Voir l’Academy
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {acces.map((a) => {
              const actif = !a.revoked_at && !!a.niveau && ouverts.has(a.niveau);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm text-ivory">
                      Academy · niveau {a.niveau ? NIVEAU_LABEL[a.niveau] : a.product_code}
                    </p>
                    <p className="text-xs text-muted">Depuis le {fmtDate(a.granted_at)}</p>
                  </div>
                  <StatPill tone={actif ? 'gold' : 'neutral'}>
                    {a.revoked_at ? 'Révoqué' : actif ? 'Actif' : 'Nouvelle version disponible'}
                  </StatPill>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="h-commandes" className="rounded-panel border border-border bg-surface p-5">
        <h2 id="h-commandes" className="font-display text-lg text-white">Mes commandes</h2>
        {commandes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucune commande pour le moment.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-4 font-normal">Date</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Produit</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Montant</th>
                  <th scope="col" className="py-2 font-normal">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {commandes.map((c) => {
                  const s = STATUT[c.status] ?? { label: c.status, tone: 'neutral' as const };
                  return (
                    <tr key={c.id}>
                      <td className="py-2.5 pr-4 text-muted">{fmtDate(c.created_at)}</td>
                      <td className="py-2.5 pr-4 text-ivory">{c.objet === 'pass' ? 'Pass premium' : 'Niveau Academy'}</td>
                      <td className="tabular py-2.5 pr-4 text-right text-ivory">
                        {prixAffiche(Number(c.amount), c.currency)}
                      </td>
                      <td className="py-2.5">
                        <StatPill tone={s.tone}>{s.label}</StatPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Les reçus de paiement sont émis par Chariow et envoyés à l’adresse de votre compte.
      </p>
    </div>
  );
}

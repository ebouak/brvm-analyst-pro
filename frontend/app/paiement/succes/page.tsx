import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/premium';
import SuiviPaiement from '@/components/billing/SuiviPaiement';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Paiement', robots: { index: false, follow: false } };

/**
 * Page de retour après Chariow (`redirect_url`). N'accorde JAMAIS rien :
 * n'importe qui peut forger cette URL. Elle affiche le statut que le webhook,
 * seul habilité, a écrit — lu sous RLS, pour le seul compte connecté.
 */
export default function PaiementSuccesPage({ searchParams }: { searchParams: { txn?: string } }) {
  const txn = searchParams.txn ?? '';
  const valide = /^[0-9a-f-]{36}$/i.test(txn);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <SectionHeader kicker="Paiement" title="Merci pour votre achat" subtitle="Vérification de la commande auprès de Chariow." />
      {valide ? (
        <SuiviPaiement txn={txn} />
      ) : (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          Référence de commande absente. Retrouvez vos commandes dans{' '}
          <Link href="/account/achats" className="text-accent underline">
            Mes achats
          </Link>
          .
        </p>
      )}
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/premium';

export const metadata: Metadata = { title: 'Paiement annulé', robots: { index: false, follow: false } };

/** Paiement abandonné : rien n'a été accordé pour cette commande. */
export default function PaiementAnnulePage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <SectionHeader
        kicker="Paiement"
        title="Paiement annulé"
        subtitle="La commande n’a pas été validée. Vous pouvez la reprendre quand vous le souhaitez."
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/formations/academy"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-bg transition hover:opacity-90"
        >
          Revenir à l’Academy
        </Link>
        <Link
          href="/account/plan"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-sm text-ivory transition hover:border-accent/50 hover:text-accent"
        >
          Voir les formules
        </Link>
      </div>
    </main>
  );
}

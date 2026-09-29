'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Suit le statut d'une transaction après le retour de Chariow. Lecture seule :
 * c'est le webhook, côté serveur, qui accorde l'accès — cette page ne fait
 * qu'attendre qu'il l'ait fait. Interrogation bornée (20 × 3 s) pour ne pas
 * tourner indéfiniment si la notification tarde.
 */

type Etat = 'attente' | 'paid' | 'failed' | 'inconnu' | 'delai';

const ESSAIS = 20;
const INTERVALLE_MS = 3000;

export default function SuiviPaiement({ txn }: { txn: string }) {
  const [etat, setEtat] = useState<Etat>('attente');
  const [objet, setObjet] = useState<string | null>(null);

  useEffect(() => {
    let essais = 0;
    let arret = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    async function sonder() {
      essais++;
      try {
        const r = await fetch(`/api/payments/chariow/status?txn=${encodeURIComponent(txn)}`, { cache: 'no-store' });
        if (r.status === 404 || r.status === 400) {
          setEtat('inconnu');
          return;
        }
        const j = (await r.json()) as { status?: string; objet?: string };
        setObjet(j.objet ?? null);
        if (j.status === 'paid') return setEtat('paid');
        if (j.status === 'failed') return setEtat('failed');
      } catch {
        /* réseau : on retente au tour suivant */
      }
      if (arret) return;
      if (essais >= ESSAIS) return setEtat('delai');
      minuteur = setTimeout(sonder, INTERVALLE_MS);
    }

    sonder();
    return () => {
      arret = true;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [txn]);

  const destination =
    objet === 'pass'
      ? { href: '/dashboard', label: 'Aller au tableau de bord' }
      : { href: '/formations/academy', label: 'Ouvrir l’Academy' };

  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-border bg-surface p-6">
      {etat === 'attente' && (
        <>
          <p className="font-display text-lg text-white">Confirmation du paiement en cours…</p>
          <p className="mt-2 text-sm text-muted">
            Nous attendons la confirmation de Chariow. Cela prend en général quelques secondes, parfois plus avec le
            Mobile Money. Vous pouvez laisser cette page ouverte.
          </p>
        </>
      )}
      {etat === 'paid' && (
        <>
          <p className="font-display text-lg text-white">Paiement confirmé — votre accès est ouvert.</p>
          <Link
            href={destination.href}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-bg transition hover:opacity-90"
          >
            {destination.label} →
          </Link>
        </>
      )}
      {etat === 'failed' && (
        <>
          <p className="font-display text-lg text-white">Le paiement n’a pas abouti.</p>
          <p className="mt-2 text-sm text-muted">Aucun paiement n’a été validé pour cette commande. Vous pouvez réessayer.</p>
          <Link href="/account/achats" className="mt-4 inline-block text-sm text-accent underline">
            Voir mes achats
          </Link>
        </>
      )}
      {etat === 'delai' && (
        <>
          <p className="font-display text-lg text-white">La confirmation tarde.</p>
          <p className="mt-2 text-sm text-muted">
            Si vous avez payé, l’accès s’ouvrira automatiquement dès que Chariow nous aura prévenus — inutile de payer
            une seconde fois. Vérifiez dans quelques minutes dans « Mes achats ».
          </p>
          <Link href="/account/achats" className="mt-4 inline-block text-sm text-accent underline">
            Voir mes achats
          </Link>
        </>
      )}
      {etat === 'inconnu' && (
        <p className="text-sm text-muted">
          Commande introuvable pour ce compte. Êtes-vous connecté avec le compte utilisé pour l’achat ?
        </p>
      )}
    </div>
  );
}

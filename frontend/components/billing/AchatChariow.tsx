'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { prixAffiche } from '@/lib/billing/chariow/format';

/**
 * Bouton d'achat Chariow : déplie un court formulaire (prénom, nom,
 * téléphone), exigé par Chariow pour le paiement Mobile Money / carte.
 *
 * N'envoie QUE le code produit et l'identité. Le prix affiché ici est
 * informatif : le serveur relit le sien au catalogue et ignore tout le reste.
 * WestBourse ne conserve ni le nom ni le téléphone : ils partent à Chariow
 * pour ce paiement.
 */

const PAYS: { code: string; nom: string }[] = [
  { code: 'CI', nom: 'Côte d’Ivoire' },
  { code: 'SN', nom: 'Sénégal' },
  { code: 'BF', nom: 'Burkina Faso' },
  { code: 'ML', nom: 'Mali' },
  { code: 'BJ', nom: 'Bénin' },
  { code: 'TG', nom: 'Togo' },
  { code: 'NE', nom: 'Niger' },
  { code: 'GW', nom: 'Guinée-Bissau' },
  { code: 'CM', nom: 'Cameroun' },
  { code: 'GN', nom: 'Guinée' },
  { code: 'FR', nom: 'France' },
];

export default function AchatChariow({
  productCode,
  libelle,
  montant,
  devise,
  connecte,
  retour,
  cta = 'Acheter',
}: {
  productCode: string;
  libelle: string;
  montant: number;
  devise: string;
  connecte: boolean;
  /** Page où revenir après connexion. */
  retour: string;
  cta?: string;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!connecte) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(retour)}`}
        className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-bg transition hover:opacity-90"
      >
        Se connecter pour acheter · {prixAffiche(montant, devise)}
      </Link>
    );
  }

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/payments/chariow/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode,
          firstName: String(f.get('prenom') ?? ''),
          lastName: String(f.get('nom') ?? ''),
          phone: { number: String(f.get('telephone') ?? ''), countryCode: String(f.get('pays') ?? 'CI') },
        }),
      });
      const json = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !json.url) {
        setErreur(json.error ?? 'Le paiement n’a pas pu être initialisé.');
        setEnvoi(false);
        return;
      }
      // `assign` : le bouton « retour » ramène ici si l'utilisateur renonce.
      window.location.assign(json.url);
    } catch {
      setErreur('Connexion interrompue. Réessayez.');
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-bg transition hover:opacity-90 active:scale-[0.98]"
      >
        {cta} · {prixAffiche(montant, devise)}
      </button>
    );
  }

  const champ =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30';

  return (
    <form onSubmit={soumettre} className="space-y-3 rounded-xl border border-border bg-bg/40 p-4" aria-describedby={`${id}-info`}>
      <p className="text-sm text-ivory">
        {libelle} — <span className="tabular">{prixAffiche(montant, devise)}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Prénom
          <input name="prenom" required maxLength={50} autoComplete="given-name" className={`${champ} mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Nom
          <input name="nom" required maxLength={50} autoComplete="family-name" className={`${champ} mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Pays
          <select name="pays" defaultValue="CI" className={`${champ} mt-1`}>
            {PAYS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Téléphone (Mobile Money)
          <input
            name="telephone"
            required
            inputMode="tel"
            autoComplete="tel-national"
            pattern="[0-9 +.\-]{6,20}"
            placeholder="07 00 00 00 00"
            className={`${champ} mt-1`}
          />
        </label>
      </div>
      <p id={`${id}-info`} className="text-[11px] leading-relaxed text-faint">
        Paiement sécurisé par Chariow (Mobile Money ou carte). Vos nom et téléphone sont transmis à Chariow pour ce
        paiement uniquement. L’accès s’ouvre dès la confirmation du paiement.
      </p>
      {erreur && (
        <p role="alert" className="text-sm text-down">
          {erreur}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={envoi}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-60"
        >
          {envoi ? 'Redirection…' : 'Payer avec Chariow'}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-sm text-muted transition hover:text-ivory"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

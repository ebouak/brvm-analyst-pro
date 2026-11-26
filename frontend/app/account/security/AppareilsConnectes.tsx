'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Laptop, Smartphone } from 'lucide-react';
import type { AppareilConnecte } from '@/lib/securite/appareils';
import { deconnecterAppareil, deconnecterAutresAppareils } from './actions';

function quand(iso: string): string {
  const d = new Date(iso);
  const ecart = Date.now() - d.getTime();
  if (ecart < 10 * 60_000) return 'actif à l’instant';
  return `dernière activité le ${d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function estMobile(libelles: string[]): boolean {
  return libelles.some((l) => /Android|iPhone/.test(l));
}

export function AppareilsConnectes({
  appareils,
  plafond,
}: {
  appareils: AppareilConnecte[];
  /** Renseigné pour un compte Premium soumis au plafond ; sinon null. */
  plafond: number | null;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: 'ok' | 'erreur'; texte: string } | null>(null);
  const autres = appareils.filter((a) => !a.courant);

  const agir = (fn: () => Promise<{ ok: true; fermees: number } | { ok: false; message: string }>) =>
    demarrer(async () => {
      setMessage(null);
      const r = await fn();
      if (r.ok) {
        setMessage({ ton: 'ok', texte: r.fermees > 0 ? 'Appareil déconnecté.' : 'Rien à déconnecter.' });
        router.refresh();
      } else setMessage({ ton: 'erreur', texte: r.message });
    });

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-ivory">Appareils connectés</h2>
      <p className="mt-1 text-xs text-muted">
        {plafond
          ? `Votre abonnement Premium reste connecté sur ${plafond} appareils à la fois. Au-delà, le moins récemment utilisé est déconnecté et vous recevez un e-mail.`
          : 'Les appareils sur lesquels votre compte est ouvert en ce moment.'}{' '}
        Un appareil que vous ne reconnaissez pas ? Déconnectez-le.
      </p>

      {appareils.length === 0 ? (
        <p className="mt-3 text-xs text-faint">Aucun appareil connecté trouvé.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/40">
          {appareils.map((a) => {
            const Icone = estMobile(a.libelles) ? Smartphone : Laptop;
            return (
              <li key={a.cle} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Icone className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-sm text-ivory">
                      {a.libelles.join(', ')}
                      {a.courant && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">Cet appareil</span>}
                    </div>
                    <div className="text-xs text-faint">{a.courant ? 'appareil en cours' : quand(a.activite)}</div>
                  </div>
                </div>
                {!a.courant && (
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => agir(() => deconnecterAppareil(a.cle))}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-down/50 hover:text-down disabled:opacity-50"
                  >
                    Déconnecter
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {autres.length > 1 && (
        <button
          type="button"
          disabled={enCours}
          onClick={() => agir(deconnecterAutresAppareils)}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs text-ivory transition-colors hover:border-down/50 hover:text-down disabled:opacity-50"
        >
          Déconnecter tous les autres appareils
        </button>
      )}

      {message && (
        <p role="status" className={`mt-3 text-xs ${message.ton === 'ok' ? 'text-up' : 'text-down'}`}>
          {message.texte}
        </p>
      )}
    </section>
  );
}

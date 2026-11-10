import { LIBELLE_ETAT, preuveDe, statutDe, type Signal } from '@/lib/conseiller/signal';

/**
 * Signal « tendance longue » d'une valeur, pour un abonné Premium. Un état lu en
 * base, sa preuve chiffrée et son statut. Couleur neutre : le texte porte le sens.
 */
export function SignalPremium({ signal }: { signal: Signal | undefined }) {
  if (!signal) {
    return <p className="mt-3 border-t border-border pt-3 text-sm text-muted">Signal tendance longue : valeur non classée à la dernière révision.</p>;
  }
  const statut = statutDe(signal.etat);
  return (
    <div className="mt-3 border-t border-border pt-3 text-sm">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-muted">Signal tendance longue</span>
        <span className="rounded border border-border px-2 py-0.5 font-medium text-ivory">{LIBELLE_ETAT[signal.etat]}</span>
      </p>
      <p className="mt-2 leading-relaxed text-ivory tabular">{preuveDe(signal.etat)}</p>
      {statut && <p className="mt-1 text-xs text-muted">{statut}</p>}
    </div>
  );
}

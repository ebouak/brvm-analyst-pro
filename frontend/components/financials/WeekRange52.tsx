import { formatCours } from '@/lib/financials/formatters';
import { fmtDateCourte } from '@/lib/format';

/**
 * Plage 52 semaines : un repère sur un rail neutre, comme les jauges de la fiche.
 *
 * LE REPÈRE PORTE UNE POSITION, PAS UN VERDICT. Pas de dégradé rouge→vert ni de
 * teinte par zone : un titre au plus-haut peut être une dynamique comme une
 * survalorisation, la page n'a pas à trancher à la place du lecteur (le rouge et
 * le vert restent réservés à la baisse et à la hausse).
 *
 * Les bornes viennent des clôtures des 365 derniers jours ; sans assez de
 * séances, le composant le dit au lieu d'afficher un rail vide.
 */

interface Props {
  bas: number | null;
  haut: number | null;
  actuel: number | null;
  /** Dates (AAAA-MM-JJ) des séances du plus-bas et du plus-haut, si connues. */
  dateBas?: string | null;
  dateHaut?: string | null;
}

export default function WeekRange52({ bas, haut, actuel, dateBas = null, dateHaut = null }: Props) {
  const complet = bas != null && haut != null && actuel != null;
  const plage = complet ? haut - bas : 0;

  if (!complet || plage <= 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted">Plage 52 semaines</p>
        <p className="text-xs text-faint">
          {complet
            ? 'Cours inchangé sur la période : la plage est plate.'
            : 'Pas encore assez de séances cotées sur douze mois.'}
        </p>
      </div>
    );
  }

  const position = Math.max(0, Math.min(100, ((actuel - bas) / plage) * 100));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted">Plage 52 semaines</p>
        <p className="text-xs text-muted"><span className="tabular">{Math.round(position)}</span>&nbsp;% de la plage</p>
      </div>

      <div
        className="relative py-1"
        role="meter"
        aria-label="Position du cours dans sa plage de 52 semaines"
        aria-valuemin={bas}
        aria-valuemax={haut}
        aria-valuenow={actuel}
        aria-valuetext={`${formatCours(actuel)} FCFA, soit ${Math.round(position)} % de la plage entre ${formatCours(bas)} et ${formatCours(haut)}`}
      >
        <div className="relative h-2 rounded bg-border">
          {/* Remplissage neutre jusqu'au repère. */}
          <div className="absolute inset-y-0 left-0 rounded bg-muted" style={{ width: `${position}%` }} />
        </div>
        <span
          aria-hidden
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-ivory"
          style={{ left: `${position}%` }}
        />
      </div>

      <div className="flex items-start justify-between gap-2 text-xs">
        <span className="text-muted">
          Bas{dateBas ? ` · ${fmtDateCourte(dateBas)}` : ''}
          <span className="tabular block text-sm text-ivory">{formatCours(bas)}</span>
        </span>
        <span className="text-center text-muted">
          Actuel
          <span className="tabular block text-sm text-ivory">{formatCours(actuel)}</span>
        </span>
        <span className="text-right text-muted">
          Haut{dateHaut ? ` · ${fmtDateCourte(dateHaut)}` : ''}
          <span className="tabular block text-sm text-ivory">{formatCours(haut)}</span>
        </span>
      </div>
    </div>
  );
}

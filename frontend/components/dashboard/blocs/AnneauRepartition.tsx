import { fmtFcfa, fmtNumber } from '@/lib/format';
import { partsAnneau } from '@/lib/dashboard/anneau';

const R = 52;
const LARGEUR = 16;
const C = 2 * Math.PI * R;

// Classes statiques (Tailwind ne résout pas les noms construits dynamiquement).
const TRAIT = ['stroke-accent', 'stroke-up', 'stroke-warn', 'stroke-purple', 'stroke-muted'] as const;
const PUCE = ['bg-accent', 'bg-up', 'bg-warn', 'bg-purple', 'bg-muted'] as const;

/** Anneau de répartition (SVG pur, rendu serveur). Le total au centre est celui des lignes fournies. */
export default function AnneauRepartition({ lignes, total }: { lignes: { code: string; valeur: number }[]; total: number }) {
  const parts = partsAnneau(lignes, 5);
  if (parts.length === 0) return null;
  const libelle = parts.map((p) => `${p.code} ${fmtNumber(p.part * 100, 1)} %`).join(', ');

  return (
    <div className="flex min-w-0 items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0" role="img" aria-label={`Répartition du portefeuille : ${libelle}`}>
        <circle cx="70" cy="70" r={R} fill="none" strokeWidth={LARGEUR} className="stroke-border" />
        <g transform="rotate(-90 70 70)">
          {parts.map((p, i) => (
            <circle
              key={`${p.code}-${i}`}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              strokeWidth={LARGEUR}
              strokeDasharray={`${p.part * C} ${C}`}
              strokeDashoffset={-p.debut * C}
              className={TRAIT[i % TRAIT.length]}
            />
          ))}
        </g>
        <text x="70" y="68" textAnchor="middle" className="tabular fill-ivory text-[13px] font-semibold">{fmtFcfa(total)}</text>
        <text x="70" y="84" textAnchor="middle" className="fill-muted text-[9px]">FCFA</text>
      </svg>
      <ul className="min-w-0 space-y-1 text-xs">
        {parts.map((p, i) => (
          <li key={`${p.code}-${i}`} className="flex items-center gap-2">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${PUCE[i % PUCE.length]}`} />
            <span className="min-w-0 truncate font-semibold text-ivory">{p.code}</span>
            <span className="tabular ml-auto pl-2 text-muted">{fmtNumber(p.part * 100, 1)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

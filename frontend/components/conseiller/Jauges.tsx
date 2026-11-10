import { FAMILLES, libelleTier, type CleFamille, type Tier } from '@/lib/conseiller/facteurs';

type Tiers = Partial<Record<CleFamille, Tier | null>>;
type Scores = Partial<Record<CleFamille, number | null>>;

/**
 * Cinq jauges, une par famille. Le repère est une POSITION dans la cote du jour
 * (à droite = tiers le plus favorable), jamais un verdict : couleur neutre.
 */
export function Jauges({ scores, tiers, compact = false }: { scores?: Scores; tiers?: Tiers; compact?: boolean }) {
  return (
    <ul className={compact ? 'flex min-w-[7.5rem] flex-col gap-1' : 'space-y-2'}>
      {FAMILLES.map((f) => {
        const s = scores?.[f.cle];
        const valide = typeof s === 'number' && Number.isFinite(s);
        const pct = valide ? Math.min(100, Math.max(0, ((s as number) + 1) / 2 * 100)) : null;
        const t = tiers?.[f.cle] ?? null;
        const label = `${f.titre} : ${t ? libelleTier(t).toLowerCase() : "non disponible"}`;
        return (
          <li key={f.cle} role="img" aria-label={label} className={compact ? '' : 'flex items-center gap-3'}>
            {!compact && <span className="w-24 shrink-0 text-xs text-muted">{f.titre}</span>}
            <span className={`relative block flex-1 rounded-full bg-elevated ${compact ? 'h-1' : 'h-1.5'}`}>
              <span aria-hidden className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-border" />
              {pct != null && (
                <span
                  aria-hidden
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ${compact ? 'h-2 w-2' : 'h-3 w-3'}`}
                  style={{ left: `${pct}%` }}
                />
              )}
            </span>
            {!compact && <span className="w-6 shrink-0 text-right text-xs text-faint">{pct == null ? '—' : ''}</span>}
          </li>
        );
      })}
    </ul>
  );
}

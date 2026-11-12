import { fmtPctSigne, fmtDateCourte } from '@/lib/format';
import type { EventStudyResult } from '@/lib/eventStudy';

type Impact = Pick<
  EventStudyResult,
  'retPre' | 'retPost' | 'abnormalReturnPost' | 'volChangePct' | 'reaction' | 'horizons' | 'seancesObservees' | 'fenetreComplete'
>;

const LIBELLE_REACTION: Record<Impact['reaction'], string> = {
  positive: 'au-dessus de l’indice',
  negative: 'sous l’indice',
  neutral: 'proche de l’indice',
};

function pct(n: number | null): string {
  return n == null ? '—' : fmtPctSigne(n, 2);
}
function cls(n: number | null): string {
  if (n == null) return 'text-muted';
  return n >= 0 ? 'text-up' : 'text-down';
}

export default function EventImpactCard({
  code, impact, window = 5, detachements = [],
}: { code: string; impact: Impact; window?: number; detachements?: string[] }) {
  const n = impact.seancesObservees;
  const borne = impact.fenetreComplete ? `J+${window}` : `J+${n}`;
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{code}</h3>
        {impact.abnormalReturnPost != null && (
          <span className={`text-xs border rounded px-2 py-0.5 ${
            impact.reaction === 'positive' ? 'text-up border-up/40' :
            impact.reaction === 'negative' ? 'text-down border-down/40' : 'text-muted border-border'
          }`}>
            {LIBELLE_REACTION[impact.reaction]}
          </span>
        )}
      </div>
      {!impact.fenetreComplete && (
        <p className="mb-2 text-xs text-warn">
          Fenêtre incomplète : {n} séance{n > 1 ? 's' : ''} sur {window}. La mesure sera complète après {window} séances cotées.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Cell label={`Avant (J−${window} à J0)`} value={pct(impact.retPre)} cls={cls(impact.retPre)} />
        <Cell label={`Après (J0 à ${borne})`} value={pct(impact.retPost)} cls={cls(impact.retPost)} />
        <Cell label="Écart au BRVM Composite" value={impact.abnormalReturnPost == null ? 'non disponible' : pct(impact.abnormalReturnPost)} cls={cls(impact.abnormalReturnPost)} />
        <Cell label="Variation du volume" value={pct(impact.volChangePct)} cls={cls(impact.volChangePct)} />
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        {Object.entries(impact.horizons).map(([h, v]) => (
          <span key={h} className="tabular">
            <span className="text-muted">{h} </span>
            <span className={cls(v)}>{v == null ? 'non atteint' : pct(v)}</span>
          </span>
        ))}
      </div>
      {detachements.length > 0 && (
        <p className="mt-3 text-xs text-warn">
          Dividende détaché le {detachements.map(fmtDateCourte).join(' et le ')}, dans la fenêtre : les cours ne sont pas
          ajustés du dividende, la baisse mécanique du détachement pèse sur la mesure.
        </p>
      )}
    </div>
  );
}

function Cell({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`tabular ${cls}`}>{value}</div>
    </div>
  );
}

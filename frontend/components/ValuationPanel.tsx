import type { CompanyValuation } from '@/lib/valuation/server';
import { fmtFcfa } from '@/lib/format';

function pct(v: number | null, d = 0): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;
}
function num(v: number | null, d = 2): string {
  return v == null ? '—' : v.toFixed(d);
}

const STANCE_STYLE: Record<CompanyValuation['verdict']['stance'], string> = {
  decote: 'text-up border-up/30 bg-up/[0.04]',
  surcote: 'text-down border-down/30 bg-down/[0.04]',
  proche: 'text-warn border-warn/30 bg-warn/[0.04]',
  indisponible: 'text-muted border-border bg-surface',
};

/** Bloc valorisation fondamentale d'une société (fiche premium). */
export default function ValuationPanel({ v }: { v: CompanyValuation }) {
  const { metrics: m, fairValue: fv, quality: q, verdict } = v;

  const ratios: { label: string; value: string }[] = [
    { label: 'P/E', value: num(m.per, 1) },
    { label: 'P/B', value: num(m.pbr, 2) },
    { label: 'ROE', value: pct(m.roe, 1) },
    { label: 'Marge nette', value: pct(m.netMargin, 1) },
    { label: 'Dette/FP', value: num(m.debtToEquity, 2) },
    { label: 'Rdt dividende', value: pct(m.dividendYield, 1) },
  ];

  return (
    <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
      <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em]">Valorisation fondamentale</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STANCE_STYLE[verdict.stance]}`}>
            {verdict.headline}
          </span>
          <span className="ml-auto text-[11px] text-faint">Qualité {q.label !== 'Indisponible' ? `${q.score}/${q.max}` : '—'}</span>
        </div>

        {/* Juste-valeur vs cours */}
        {fv.fairValue != null && v.price != null && (
          <div className="grid grid-cols-3 gap-3">
            <Cell label="Cours" value={fmtFcfa(v.price)} unit="FCFA" />
            <Cell label="Juste-valeur est." value={fmtFcfa(fv.fairValue)} unit="FCFA" accent />
            <Cell label="Potentiel" value={pct(fv.upside, 0)} cls={(fv.upside ?? 0) >= 0 ? 'text-up' : 'text-down'} />
          </div>
        )}

        {/* Ratios */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ratios.map((r) => (
            <div key={r.label} className="rounded-lg bg-bg/40 border border-border/60 p-2.5 text-center">
              <div className="text-[10px] text-muted">{r.label}</div>
              <div className="tabular text-sm font-mono font-semibold text-ivory mt-0.5">{r.value}</div>
            </div>
          ))}
        </div>

        {/* Verdict détaillé */}
        <div className="border-t border-border/30 pt-4 space-y-2">
          <ul className="space-y-1">
            {verdict.rationale.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted leading-relaxed">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-faint" /><span>{p}</span>
              </li>
            ))}
          </ul>
          {verdict.cautions.map((c, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-warn/90"><span>⚠</span><span>{c}</span></p>
          ))}
        </div>

        {fv.methods.length > 0 && (
          <p className="text-[11px] text-faint">Juste-valeur : {fv.methods.join(' · ')}. Médianes sectorielles, méthodes d’analyste.</p>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, unit, accent, cls }: { label: string; value: string; unit?: string; accent?: boolean; cls?: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${accent ? 'border-gold/30 bg-gold/[0.04]' : 'border-border/60 bg-bg/40'}`}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className={`tabular text-base font-mono font-semibold mt-0.5 ${cls ?? 'text-ivory'}`}>
        {value}{unit ? <span className="text-[10px] text-faint ml-1">{unit}</span> : null}
      </div>
    </div>
  );
}

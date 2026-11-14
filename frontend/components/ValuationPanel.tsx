import { rendementDividendeParts, nombreFr, pctFr } from '@/lib/fiche/affichage';
import type { CompanyValuation } from '@/lib/valuation/server';
import type { CompanyScoring } from '@/lib/scoring/server';
import type { AltmanZone } from '@/lib/scoring/altman';
import { fmtFcfa } from '@/lib/format';
import { ecartAffiche } from '@/lib/valuation/verdict';

function pct(v: number | null, d = 0): string {
  if (v == null) return '—';
  return pctFr(v * 100, d, true);
}
function num(v: number | null, d = 2): string {
  return nombreFr(v, d);
}

const STANCE_STYLE: Record<CompanyValuation['verdict']['stance'], string> = {
  decote: 'text-up border-up/30 bg-up/[0.04]',
  surcote: 'text-down border-down/30 bg-down/[0.04]',
  proche: 'text-warn border-warn/30 bg-warn/[0.04]',
  desaccord: 'text-muted border-border bg-surface',
  non_estimable: 'text-muted border-border bg-surface',
  indisponible: 'text-muted border-border bg-surface',
};

const ZONE_STYLE: Record<AltmanZone, { txt: string; cls: string }> = {
  safe: { txt: 'Sain', cls: 'text-up bg-up/5 border-up/30' },
  grey: { txt: 'Zone grise', cls: 'text-warn bg-warn/10 border-warn/30' },
  distress: { txt: 'Risque de détresse', cls: 'text-down bg-down/5 border-down/30' },
};

/** Bloc valorisation fondamentale d'une société (fiche premium). */
/** `rendementDividende` : rendement déjà calculé par la fiche (même source que le bloc dividendes), en %, avec son exercice. */
export default function ValuationPanel({ v, scoring, rendementDividende, masquerRationale }: { v: CompanyValuation; scoring?: CompanyScoring | null; masquerRationale?: boolean; rendementDividende?: { pct: number | null; exercice: number | null } | null }) {
  const { metrics: m, fairValue: fv, quality: q, verdict } = v;

  const ratios: { label: string; value: string; note?: string }[] = [
    { label: 'P/E', value: num(m.per, 1) },
    { label: 'P/B', value: num(m.pbr, 2) },
    { label: 'ROE', value: pct(m.roe, 1) },
    { label: 'Marge nette', value: pct(m.netMargin, 1) },
    { label: 'Dette/FP', value: num(m.debtToEquity, 2) },
    rendementDividende !== undefined
      ? (() => {
          const p = rendementDividendeParts(rendementDividende?.pct ?? null, rendementDividende?.exercice ?? null);
          return { label: 'Rdt dividende', value: p?.valeur ?? '—', note: p?.exercice ?? undefined };
        })()
      : { label: 'Rdt dividende', value: pct(m.dividendYield, 1) },
  ];

  return (
    <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
      <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[11px] text-accent-ink">Valorisation fondamentale</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STANCE_STYLE[verdict.stance]}`}>
            {verdict.headline}
          </span>
          <span className="ml-auto text-[11px] text-faint">Qualité {q.label !== 'Indisponible' ? `${q.score}/${q.max}` : '—'}</span>
        </div>

        {/* Juste-valeur vs cours */}
        {fv.fairValue != null && v.price != null && ['decote', 'surcote', 'proche', 'desaccord'].includes(verdict.stance) && (
          <div className="grid grid-cols-3 gap-3">
            <Cell label="Cours" value={fmtFcfa(v.price)} unit="FCFA" />
            {/* Une fourchette quand les méthodes divergent : la moyenne cacherait le désaccord. */}
            {verdict.stance === 'desaccord' && fv.basse != null && fv.haute != null ? (
              <Cell label="Valeur estimée" value={`${fmtFcfa(fv.basse)} – ${fmtFcfa(fv.haute)}`} unit="FCFA, selon la méthode" accent />
            ) : (
              <Cell label="Valeur estimée" value={fmtFcfa(fv.fairValue)} unit="FCFA" accent />
            )}
            {verdict.stance === 'desaccord' ? (
              <Cell label="Écart au cours" value="—" />
            ) : (
              <Cell label="Écart au cours" value={ecartAffiche(fv.upside ?? 0)} cls={(fv.upside ?? 0) >= 0 ? 'text-up' : 'text-down'} />
            )}
          </div>
        )}

        {/* Désaccord : dire quelle méthode donne quoi, et pourquoi aucun écart n'est affiché. */}
        {verdict.stance === 'desaccord' && v.price != null && fv.byPER != null && fv.byPBR != null && (
          <div className="rounded-lg border border-border/60 bg-bg/40 p-3 text-xs leading-relaxed text-muted">
            <p className="text-ivory font-medium">Pourquoi « méthodes en désaccord » ?</p>
            <ul className="mt-1.5 space-y-1">
              <li>
                Par les bénéfices (bénéfice par action × PER médian du secteur) :{' '}
                <span className="tabular text-ivory">{fmtFcfa(fv.byPER)} FCFA</span>,{' '}
                {fv.byPER < v.price ? 'sous le cours : l’action paraît chère.' : 'au-dessus du cours : l’action paraît bon marché.'}
              </li>
              <li>
                Par les fonds propres (fonds propres par action × P/B médian du secteur) :{' '}
                <span className="tabular text-ivory">{fmtFcfa(fv.byPBR)} FCFA</span>,{' '}
                {fv.byPBR < v.price ? 'sous le cours : l’action paraît chère.' : 'au-dessus du cours : l’action paraît bon marché.'}
              </li>
            </ul>
            <p className="mt-1.5">
              Les deux lectures se contredisent : en faire la moyenne cacherait ce désaccord. Aucun écart au cours n’est donc affiché ;
              la fourchette indique où se situe la valeur selon la méthode retenue.
            </p>
          </div>
        )}

        {/* Ratios */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ratios.map((r) => (
            <div key={r.label} className="rounded-lg bg-bg/40 border border-border/60 p-2.5 text-center">
              <div className="text-[11px] text-muted">{r.label}</div>
              <div className="tabular text-sm font-mono font-semibold text-ivory mt-0.5 whitespace-nowrap">{r.value}</div>
              {r.note && <div className="text-[11px] text-faint">{r.note}</div>}
            </div>
          ))}
        </div>

        {/* Santé financière : Piotroski F-Score + Altman Z */}
        {scoring && (scoring.fscore?.reliable || scoring.altman?.applicable || scoring.fscoreNonApplicable) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scoring.fscoreNonApplicable && (
              <div className="rounded-lg border border-border/60 bg-bg/40 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-faint">Piotroski F-Score</span>
                  <span className="text-[11px] text-faint">non applicable</span>
                </div>
                <p className="mt-1.5 text-[11px] text-faint">Le F-Score repose sur la marge brute, la liquidité et la rotation de l’actif : il ne s’applique pas à un bilan bancaire.</p>
              </div>
            )}
            {scoring.fscore?.reliable && (
              <div className="rounded-lg border border-border/60 bg-bg/40 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-faint">Piotroski F-Score</span>
                  <span className="text-sm font-semibold text-ivory"><span className="tabular">{scoring.fscore.score}/9</span> · {scoring.fscore.label}</span>
                </div>
                <div className="flex gap-0.5">
                  {scoring.fscore.criteria.map((c, i) => (
                    <span key={i} title={c.label} className={`h-1.5 flex-1 rounded-full ${c.pass ? 'bg-up' : 'bg-border'}`} />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-faint">Solidité fondamentale : rentabilité, levier, efficience (9 critères).</p>
              </div>
            )}
            <div className="rounded-lg border border-border/60 bg-bg/40 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-faint">Altman Z-Score</span>
                {scoring.altman?.applicable && scoring.altman.zone ? (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ZONE_STYLE[scoring.altman.zone].cls}`}>
                    {scoring.altman.z} · {ZONE_STYLE[scoring.altman.zone].txt}
                  </span>
                ) : (
                  <span className="text-[11px] text-faint">non applicable</span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-faint">{scoring.altman?.note ?? 'Risque de détresse financière (modèle Z″ marchés émergents) : au-dessus de 2,6 zone saine, de 1,1 à 2,6 zone grise, sous 1,1 risque de détresse. Inadapté aux sociétés financières.'}</p>
            </div>
          </div>
        )}

        {/* Verdict détaillé */}
        <div className="border-t border-border/30 pt-4 space-y-2">
          {!masquerRationale && <ul className="space-y-1">
            {verdict.rationale.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted leading-relaxed">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-faint" /><span>{p}</span>
              </li>
            ))}
          </ul>}
          {verdict.cautions.map((c, i) => (
            <p key={i} className="flex items-start gap-2 text-xs text-warn"><span>!</span><span>{c}</span></p>
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
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`tabular text-base font-mono font-semibold mt-0.5 ${cls ?? 'text-ivory'}`}>
        {value}{unit ? <span className="text-[11px] text-faint ml-1">{unit}</span> : null}
      </div>
    </div>
  );
}

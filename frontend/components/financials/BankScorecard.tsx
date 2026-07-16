import type { BankKpis, BankScore } from '@/lib/bank/kpis';

/**
 * Carte « Analyse bancaire UEMOA » : les éléments pertinents des états
 * financiers d'une banque (prêts, dépôts, marge d'intérêts…) + le score /100
 * par axes (Commission Bancaire UMOA / FSI FMI), avec neutralisation visible
 * des indicateurs non publiés.
 */

const nf = new Intl.NumberFormat('fr-FR');
const md = (v: number | null) => (v == null ? '—' : `${nf.format(Math.round(v / 1e9 * 10) / 10)} Md FCFA`);
const pct = (v: number | null, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)} %`);

function KpiRow({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' | null }) {
  const cls = value === '—' ? 'text-faint italic' : tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-white';
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`tabular text-sm font-medium ${cls}`}>{value === '—' ? 'non publié' : value}</span>
    </div>
  );
}

export default function BankScorecard({ kpis, score, periode }: {
  kpis: BankKpis;
  score: BankScore;
  periode: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* ── Le bilan bancaire en clair : prêts, dépôts, transformation ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-3">
            Intermédiation{periode ? ` (exercice ${periode})` : ''}
          </h3>
          <KpiRow label="Crédits à la clientèle (prêts)" value={md(kpis.creditsClientele)} />
          <KpiRow label="Dépôts de la clientèle" value={md(kpis.depotsClientele)} />
          <KpiRow label="Transformation (crédits / dépôts)" value={pct(kpis.transformation)} />
          <KpiRow label="Total actifs" value={md(kpis.totalActifs)} />
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-3">Performance bancaire</h3>
          <KpiRow label="Marge nette d'intérêts (NIM)" value={pct(kpis.nim, 2)} />
          <KpiRow
            label="Coefficient d'exploitation"
            value={pct(kpis.costIncome)}
            tone={kpis.costIncome == null ? null : kpis.costIncome <= 0.6 ? 'up' : kpis.costIncome >= 0.8 ? 'down' : null}
          />
          <KpiRow label="ROA" value={pct(kpis.roa, 2)} tone={kpis.roa == null ? null : kpis.roa >= 0 ? 'up' : 'down'} />
          <KpiRow label="Capitaux propres / actifs" value={pct(kpis.leverage)} />
          <KpiRow label="Créances douteuses / crédits" value={pct(kpis.nplRatio)} tone={kpis.nplRatio != null && kpis.nplRatio > 0.1 ? 'down' : null} />
          <KpiRow label="Ratio de solvabilité (min 11,5 %)" value={pct(kpis.ratioSolvabilite)} />
        </div>
      </div>

      {/* ── Score UEMOA /100 ── */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs text-muted uppercase tracking-wider">Score bancaire UEMOA</h3>
          <div className="flex items-center gap-3">
            {score.total != null ? (
              <span className="tabular text-2xl font-semibold text-white">{score.total}<span className="text-sm text-muted">/100</span></span>
            ) : (
              <span className="text-sm text-faint italic">indicateurs publiés insuffisants</span>
            )}
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
              confiance {Math.round(score.confiance * 100)} %
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {score.axes.map((axe) => {
            const neutralise = axe.disponibles === 0;
            const ratio = neutralise ? 0 : axe.obtenus / axe.disponibles;
            return (
              <div key={axe.id} className={`rounded-lg border p-3 ${neutralise ? 'border-border/40 opacity-60' : 'border-border/60'} bg-bg`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium text-ivory">{axe.label}</p>
                  <p className="tabular text-xs text-muted">
                    {neutralise ? 'non publié' : `${axe.obtenus} / ${axe.disponibles} pts`}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/40">
                  <div
                    className={`h-full rounded-full ${ratio >= 0.6 ? 'bg-up' : ratio >= 0.35 ? 'bg-warn' : 'bg-down'}`}
                    style={{ width: `${neutralise ? 0 : Math.round(ratio * 100)}%` }}
                  />
                </div>
                <ul className="mt-2 space-y-0.5">
                  {axe.sousScores.map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between text-[11px]">
                      <span className={s.points == null ? 'text-faint italic' : 'text-muted'}>{s.label}</span>
                      <span className={`tabular ${s.points == null ? 'text-faint italic' : 'text-ivory'}`}>
                        {s.points == null
                          ? 'non publié'
                          : `${s.valeur != null && s.format === 'pct' ? `${(s.valeur * 100).toFixed(1)} % · ` : ''}${s.points}/${s.max}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-faint leading-relaxed">
          Barème inspiré des indicateurs de la Commission Bancaire UMOA et des FSI du FMI
          (ROE 15 %, ROA 1,5 %, coefficient d&apos;exploitation 50-80 %, NPL 5-15 %, solvabilité
          réglementaire ≥ 11,5 %, transformation 50-100 %, NIM 4 %). Un indicateur non publié
          dans les états déposés est neutralisé — il sort du calcul au lieu d&apos;être compté
          comme un zéro — et la confiance indique la part du barème réellement mesurable.
        </p>
      </div>
    </div>
  );
}

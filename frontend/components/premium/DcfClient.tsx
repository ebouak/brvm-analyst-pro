'use client';

import { useMemo, useState } from 'react';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { assembleDcf } from '@/lib/dcf/assemble';
import type { AssembleRawInputs, AssembleAssumptions } from '@/lib/dcf/assemble';
import type { RiskPremiumRow } from '@/lib/dcf/server';

const pct = (v: number | null | undefined, d = 1, signed = false) =>
  v == null ? '—' : `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(d)} %`;

/** Badge distinguant une valeur sourcée (« réel ») d'une hypothèse ajustable. */
function Tag({ kind }: { kind: 'reel' | 'hypothese' }) {
  return kind === 'reel' ? (
    <span className="rounded bg-up/10 px-1.5 py-0.5 text-[10px] font-semibold text-up">réel</span>
  ) : (
    <span className="rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold text-info">hypothèse</span>
  );
}

function Row({ label, value, tag }: { label: string; value: string; tag?: 'reel' | 'hypothese' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-muted">
        {label} {tag && <Tag kind={tag} />}
      </span>
      <span className="tabular text-white">{value}</span>
    </div>
  );
}

export default function DcfClient({
  raw,
  defaults,
  countries,
  meta,
  cours,
}: {
  raw: AssembleRawInputs;
  defaults: AssembleAssumptions;
  countries: RiskPremiumRow[];
  meta: { riskFreeSource: 'souverain' | 'repli'; riskPremiumCountry: string; moodyRating: string | null; betaObs: number };
  cours: number | null;
}) {
  const [pays, setPays] = useState(meta.riskPremiumCountry);
  const [riskFree, setRiskFree] = useState(defaults.riskFree);
  const [growth, setGrowth] = useState(defaults.growthRate);
  const [years, setYears] = useState(defaults.years);
  const [terminal, setTerminal] = useState(defaults.terminalGrowth);
  const [betaOverrideStr, setBetaOverrideStr] = useState('');

  const country = countries.find((c) => c.pays === pays) ?? null;

  const effectiveRaw: AssembleRawInputs = useMemo(
    () => ({
      ...raw,
      equityRiskPremium: country?.equity_risk_prem ?? raw.equityRiskPremium,
      countryRiskPremium: country?.country_risk_prem ?? raw.countryRiskPremium,
      taxRate: country?.taux_is ?? raw.taxRate,
    }),
    [raw, country],
  );

  const betaOverride = betaOverrideStr.trim() === '' ? undefined : Number(betaOverrideStr);
  const assumptions: AssembleAssumptions = {
    riskFree,
    growthRate: growth,
    years,
    terminalGrowth: terminal,
    fallbackBeta: defaults.fallbackBeta,
    betaOverride: Number.isFinite(betaOverride) ? betaOverride : undefined,
  };

  const r = useMemo(() => assembleDcf(effectiveRaw, assumptions), [effectiveRaw, assumptions]);

  const fair = r.dcf?.fairValuePerShare ?? null;
  const upTone = r.upside == null ? 'text-muted' : r.upside > 0 ? 'text-up' : 'text-down';

  return (
    <div className="space-y-6">
      {/* Juste-valeur — hero */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Juste-valeur estimée (DCF)</p>
            <p className="mt-1 text-3xl font-semibold tabular text-white">
              {fair != null ? `${fmtFcfa(fair)} FCFA` : 'Non calculable'}
            </p>
            {cours != null && (
              <p className="mt-1 text-sm text-muted">
                Cours actuel <span className="tabular text-white">{fmtFcfa(cours)}</span> FCFA
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted">Potentiel</p>
            <p className={`text-3xl font-semibold tabular ${upTone}`}>{pct(r.upside, 1, true)}</p>
            {r.dcf?.error && <p className="mt-1 text-xs text-down">{labelError(r.dcf.error)}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Coût du capital (WACC) décomposé */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Coût du capital (WACC)</h3>
          <Row label="Taux sans risque (rf)" value={pct(riskFree, 2)} tag={meta.riskFreeSource === 'souverain' ? 'reel' : 'hypothese'} />
          <Row
            label={`Bêta (β)${r.betaEstimated ? ' — estimé' : ''}`}
            value={fmtNumber(r.betaUsed, 2)}
            tag={betaOverride != null || r.betaEstimated ? 'hypothese' : 'reel'}
          />
          <Row label="Prime de risque actions (ERP)" value={pct(effectiveRaw.equityRiskPremium, 2)} tag="reel" />
          <Row label="Prime de risque pays (CRP)" value={pct(effectiveRaw.countryRiskPremium, 2)} tag="reel" />
          <div className="my-2 h-px bg-border" />
          <Row label="Coût des fonds propres (Ke)" value={pct(r.wacc.costOfEquity, 2)} />
          <Row
            label="Coût de la dette après impôt"
            value={r.wacc.costOfDebtAfterTax == null ? 'n.d.' : pct(r.wacc.costOfDebtAfterTax, 2)}
            tag={r.costOfDebtPreTax != null ? 'reel' : undefined}
          />
          <Row label="Pondération FP / dette" value={`${pct(r.wacc.weightEquity, 0)} / ${pct(r.wacc.weightDebt, 0)}`} />
          <div className="my-2 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">WACC</span>
            <span className="tabular text-lg font-semibold text-info">{pct(r.wacc.wacc, 2)}</span>
          </div>
        </div>

        {/* Hypothèses ajustables */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">
            Hypothèses <Tag kind="hypothese" />
          </h3>

          <label className="block text-xs text-muted">
            Pays de l'émetteur (prime de risque)
            <select
              value={pays}
              onChange={(e) => setPays(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50"
            >
              {countries.map((c) => (
                <option key={c.pays} value={c.pays}>
                  {c.pays} — ERP {pct(c.equity_risk_prem, 1)}{c.moody_rating ? ` (${c.moody_rating})` : ''}
                </option>
              ))}
            </select>
          </label>

          <Slider label="Taux sans risque" value={riskFree} min={0} max={0.15} step={0.0025} onChange={setRiskFree} format={(v) => pct(v, 2)} />
          <Slider label="Croissance FCF (5 ans)" value={growth} min={-0.05} max={0.2} step={0.005} onChange={setGrowth} format={(v) => pct(v, 1, true)} />
          <Slider label="Croissance terminale (g∞)" value={terminal} min={0} max={0.05} step={0.0025} onChange={setTerminal} format={(v) => pct(v, 2)} />

          <label className="block text-xs text-muted">
            Horizon explicite : <span className="tabular text-white">{years} ans</span>
            <input type="range" min={3} max={10} step={1} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-1 w-full accent-[#56d7fd]" />
          </label>

          <label className="block text-xs text-muted">
            Bêta manuel (laisser vide = calculé : {fmtNumber(r.betaUsed, 2)})
            <input
              type="number" step="0.05" min="0" placeholder={`${meta.betaObs} obs`}
              value={betaOverrideStr}
              onChange={(e) => setBetaOverrideStr(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50"
            />
          </label>
        </div>
      </div>

      {/* Projection FCF */}
      {r.dcf && r.dcf.projectedFcf.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
                <th className="px-3 py-2.5 text-left font-semibold">Année</th>
                {r.dcf.projectedFcf.map((_, i) => (
                  <th key={i} className="px-3 py-2.5 text-right font-semibold">N+{i + 1}</th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold">Valeur terminale</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="px-3 py-2.5 text-muted">FCF projeté</td>
                {r.dcf.projectedFcf.map((f, i) => (
                  <td key={i} className="px-3 py-2.5 text-right tabular text-white">{fmtFcfa(f)}</td>
                ))}
                <td className="px-3 py-2.5 text-right tabular text-white">{fmtFcfa(r.dcf.terminalValue)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 text-muted">FCF actualisé</td>
                {r.dcf.discountedFcf.map((f, i) => (
                  <td key={i} className="px-3 py-2.5 text-right tabular text-muted">{fmtFcfa(f)}</td>
                ))}
                <td className="px-3 py-2.5 text-right tabular text-muted">{fmtFcfa(r.dcf.pvTerminal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Sensibilité */}
      {r.dcf && !r.dcf.error && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white">Sensibilité de la juste-valeur (WACC × g∞)</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
                  <th className="px-3 py-2 text-left">WACC ＼ g∞</th>
                  {[-0.005, 0, 0.005].map((dg) => (
                    <th key={dg} className="px-3 py-2 text-right">{pct(terminal + dg, 2)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[-0.01, 0, 0.01].map((dw, i) => (
                  <tr key={dw} className="border-b border-border/30">
                    <td className="px-3 py-2 text-muted tabular">{pct(r.wacc.wacc + dw, 2)}</td>
                    {r.sensitivity[i]?.map((cell, j) => (
                      <td key={j} className={`px-3 py-2 text-right tabular ${dw === 0 && j === 1 ? 'font-semibold text-info' : 'text-white'}`}>
                        {cell == null ? '—' : fmtFcfa(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes honnêteté */}
      {r.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-border bg-surface p-4 text-xs text-muted">
          {r.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelError(e: NonNullable<ReturnType<typeof assembleDcf>['dcf']>['error']): string {
  switch (e) {
    case 'fcf_non_positif':
      return 'FCF de base ≤ 0 : DCF de croissance non pertinent.';
    case 'wacc_le_terminal':
      return 'WACC ≤ croissance terminale : valeur divergente.';
    case 'shares_invalide':
      return "Nombre d'actions indisponible.";
    default:
      return '';
  }
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="block text-xs text-muted">
      <span className="flex items-center justify-between">
        {label} <span className="tabular text-white">{format(value)}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[#56d7fd]"
      />
    </label>
  );
}

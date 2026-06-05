'use client';

import { useState } from 'react';
import { computeRatios, assessQuality, type FundamentalInputs } from '@/lib/fundamentals';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import RatioCard from './RatioCard';
import RangeBar from './RangeBar';
import EditFundamentalsModal from './EditFundamentalsModal';

export interface FundamentalsPanelProps {
  code: string;
  inputs: FundamentalInputs;
  sharesSource: string | null;
  isManual: boolean;
  year: number | null;
  history: Array<{ year: number; revenue: number | null; net_income: number | null }>;
  sourceUrl: string | null;
  range52: { low: number | null; high: number | null; current: number | null };
}

function pct(v: number | null): string { return v == null ? '—' : `${(v * 100).toFixed(1)} %`; }
function num(v: number | null, d = 2): string { return v == null ? '—' : fmtNumber(v, d); }

export default function FundamentalsPanel(p: FundamentalsPanelProps) {
  const [editing, setEditing] = useState(false);
  const r = computeRatios(p.inputs);

  const sortedHist = [...p.history].sort((a, b) => a.year - b.year);
  const last = sortedHist[sortedHist.length - 1];
  const prev = sortedHist[sortedHist.length - 2];
  const croissanceCA = last?.revenue && prev?.revenue ? last.revenue / prev.revenue - 1 : null;
  const croissanceRN = last?.net_income && prev?.net_income ? last.net_income / prev.net_income - 1 : null;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">🏦 Fondamentaux{p.year ? ` (exercice ${p.year})` : ''}</h2>
        <button type="button" onClick={() => setEditing(true)}
          className="text-xs border border-border rounded px-2 py-1 hover:border-up/40 hover:text-up transition">
          ✏️ Corriger
        </button>
      </div>

      {p.range52.low != null && (
        <RangeBar title="52 semaines" low={p.range52.low} high={p.range52.high} current={p.range52.current} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Générales">
          <RatioCard label="Capitalisation" value={r.capitalisation != null ? fmtFcfa(r.capitalisation) + ' FCFA' : '—'} quality={assessQuality('capitalisation', r.capitalisation)} />
          <RatioCard label="BPA" value={r.bpa != null ? fmtNumber(r.bpa) + ' FCFA' : '—'} quality={r.bpa == null ? 'missing' : 'ok'} positive={r.bpa != null ? r.bpa >= 0 : null} />
          <RatioCard label="Rendement dividende" value={pct(r.rendementDiv)} quality={assessQuality('rendementDiv', r.rendementDiv)} />
        </Section>

        <Section title="Évaluation">
          <RatioCard label="PER (P/E)" value={num(r.per)} quality={assessQuality('per', r.per)} />
          <RatioCard label="P/B" value={num(r.pb)} quality={assessQuality('pb', r.pb)} />
          <RatioCard label="P/S" value={num(r.ps)} quality={assessQuality('ps', r.ps)} />
        </Section>

        <Section title="Rentabilité">
          <RatioCard label="ROE" value={pct(r.roe)} quality={assessQuality('roe', r.roe)} positive={r.roe != null ? r.roe >= 0 : null} />
          <RatioCard label="Marge nette" value={pct(r.margeNette)} quality={assessQuality('margeNette', r.margeNette)} positive={r.margeNette != null ? r.margeNette >= 0 : null} />
        </Section>

        <Section title="Effet de levier">
          <RatioCard label="Dette / Capitaux propres" value={num(r.gearing)} quality={assessQuality('gearing', r.gearing)} />
          <RatioCard label="Payout (distribution)" value={pct(r.payout)} quality={assessQuality('payout', r.payout)} />
        </Section>

        <Section title="Croissance">
          <RatioCard label="Croissance CA" value={pct(croissanceCA)} positive={croissanceCA != null ? croissanceCA >= 0 : null} quality={croissanceCA == null ? 'missing' : 'ok'} />
          <RatioCard label="Croissance RN" value={pct(croissanceRN)} positive={croissanceRN != null ? croissanceRN >= 0 : null} quality={croissanceRN == null ? 'missing' : 'ok'} />
        </Section>
      </div>

      {p.sourceUrl && (
        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-up hover:underline block">
          📄 États financiers officiels (PDF)
        </a>
      )}
      <p className="text-[10px] text-muted">
        Nombre d&apos;actions : {p.inputs.shares != null ? fmtNumber(p.inputs.shares) : 'non renseigné'}
        {p.sharesSource ? ` (${p.sharesSource})` : ''}. {p.isManual && '· Fondamentaux corrigés manuellement.'}
      </p>

      {editing && (
        <EditFundamentalsModal
          code={p.code}
          inputs={p.inputs}
          year={p.year}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

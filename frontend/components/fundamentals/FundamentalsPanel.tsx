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
  /** Famille comptable : la grille de lecture change selon le métier. */
  famille?: 'banque' | 'assurance' | 'general' | null;
  /** Exercice du dividende utilisé pour rendement/payout (si non daté en séance). */
  dividendeExercice?: number | null;
  /** Le dividende a une date de détachement vérifiée. */
  dividendeVerifie?: boolean;
}

function pct(v: number | null): string { return v == null ? '—' : `${(v * 100).toFixed(1)} %`; }
function num(v: number | null, d = 2): string { return v == null ? '—' : fmtNumber(v, d); }

/**
 * Vocabulaire et grille par famille comptable :
 * - banque : le « CA » est un Produit Net Bancaire ; P/S et Dette/CP n'ont pas
 *   de sens (la dette EST la matière première d'une banque) → on montre à la
 *   place les capitaux propres (solidité) et la distribution.
 * - assurance : le revenu = primes acquises ; même logique, pas de gearing.
 * - général (industrie, commerce, services) : grille classique complète.
 */
const FAMILLES = {
  banque: { revenu: 'PNB', revenuLong: 'Produit net bancaire', ps: false, gearing: false },
  assurance: { revenu: 'Primes', revenuLong: 'Primes acquises', ps: true, gearing: false },
  general: { revenu: 'CA', revenuLong: "Chiffre d'affaires", ps: true, gearing: true },
} as const;

export default function FundamentalsPanel(p: FundamentalsPanelProps) {
  const [editing, setEditing] = useState(false);
  const r = computeRatios(p.inputs);
  const fam = FAMILLES[p.famille ?? 'general'] ?? FAMILLES.general;

  const sortedHist = [...p.history].sort((a, b) => a.year - b.year);
  const last = sortedHist[sortedHist.length - 1];
  const prev = sortedHist[sortedHist.length - 2];
  const croissanceCA = last?.revenue && prev?.revenue ? last.revenue / prev.revenue - 1 : null;
  const croissanceRN = last?.net_income && prev?.net_income ? last.net_income / prev.net_income - 1 : null;

  const divSuffix = p.dividendeExercice != null && !p.dividendeVerifie
    ? ` (ex. ${p.dividendeExercice})` : '';

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          🏦 Fondamentaux{p.year ? ` (exercice ${p.year})` : ''}
          {p.famille === 'banque' && <span className="ml-2 rounded-full border border-info/40 px-2 py-0.5 text-[10px] font-medium text-info">Banque</span>}
          {p.famille === 'assurance' && <span className="ml-2 rounded-full border border-info/40 px-2 py-0.5 text-[10px] font-medium text-info">Assurance</span>}
        </h2>
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
          <RatioCard label={`Rendement dividende${divSuffix}`} value={pct(r.rendementDiv)} quality={assessQuality('rendementDiv', r.rendementDiv)} />
        </Section>

        <Section title="Évaluation">
          <RatioCard label="PER (P/E)" value={num(r.per)} quality={assessQuality('per', r.per)} />
          <RatioCard label="P/B" value={num(r.pb)} quality={assessQuality('pb', r.pb)} />
          {fam.ps && (
            <RatioCard label={p.famille === 'assurance' ? 'P/Primes' : 'P/S'} value={num(r.ps)} quality={assessQuality('ps', r.ps)} />
          )}
        </Section>

        <Section title="Rentabilité">
          <RatioCard label="ROE" value={pct(r.roe)} quality={assessQuality('roe', r.roe)} positive={r.roe != null ? r.roe >= 0 : null} />
          <RatioCard label={`Marge nette (RN / ${fam.revenu})`} value={pct(r.margeNette)} quality={assessQuality('margeNette', r.margeNette)} positive={r.margeNette != null ? r.margeNette >= 0 : null} />
        </Section>

        {fam.gearing ? (
          <Section title="Effet de levier">
            <RatioCard label="Dette / Capitaux propres" value={num(r.gearing)} quality={assessQuality('gearing', r.gearing)} />
            <RatioCard label={`Payout (distribution)${divSuffix}`} value={pct(r.payout)} quality={assessQuality('payout', r.payout)} />
          </Section>
        ) : (
          <Section title="Solidité & distribution">
            <RatioCard label="Capitaux propres" value={p.inputs.equity != null ? fmtFcfa(p.inputs.equity) + ' FCFA' : '—'} quality={p.inputs.equity == null ? 'missing' : 'ok'} />
            <RatioCard label={`Payout (distribution)${divSuffix}`} value={pct(r.payout)} quality={assessQuality('payout', r.payout)} />
          </Section>
        )}

        <Section title="Croissance (1 an)">
          <RatioCard label={`Croissance ${fam.revenu}`} value={pct(croissanceCA)} positive={croissanceCA != null ? croissanceCA >= 0 : null} quality={croissanceCA == null ? 'missing' : 'ok'} />
          <RatioCard label="Croissance RN" value={pct(croissanceRN)} positive={croissanceRN != null ? croissanceRN >= 0 : null} quality={croissanceRN == null ? 'missing' : 'ok'} />
        </Section>
      </div>

      {p.sourceUrl && (
        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-up hover:underline block">
          📄 États financiers officiels (PDF)
        </a>
      )}
      <p className="text-[10px] text-muted">
        {fam.revenuLong} retenu comme revenu. Nombre d&apos;actions : {p.inputs.shares != null ? fmtNumber(p.inputs.shares) : 'non renseigné'}
        {p.sharesSource ? ` (${p.sharesSource})` : ''}.
        {p.dividendeExercice != null && !p.dividendeVerifie && ` Dividende : exercice ${p.dividendeExercice} (date de détachement non publiée).`}
        {p.isManual && ' · Fondamentaux corrigés manuellement.'}
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

'use client';

import { useState } from 'react';
import { computeRatios, assessQuality, type FundamentalInputs } from '@/lib/fundamentals';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import RatioCard from './RatioCard';
import RangeBar from './RangeBar';
import EditFundamentalsModal from './EditFundamentalsModal';
import FundamentalsCharts, { type FundaChartPoint } from '@/components/financials/FundamentalsCharts';
import ValueTrapBadge from './ValueTrapBadge';
import { perAffichable, distributionAffichable, evolutionResultat, bpaAffichable, insecable } from '@/lib/fiche/affichage';
import { formatRendementDividende } from '@/lib/fiche/affichage';
import { assessValueTrap } from '@/lib/fundamentals/valueTrap';
import type { RatiosBilan } from '@/lib/fiche/ratiosBilan';

export interface FundamentalsPanelProps {
  code: string;
  inputs: FundamentalInputs;
  sharesSource: string | null;
  isManual: boolean;
  year: number | null;
  history: Array<{ year: number; revenue: number | null; net_income: number | null }>;
  sourceUrl: string | null;
  range52: { low: number | null; high: number | null; current: number | null };
  /** Résultat net de l'exercice : sert à écarter un taux de distribution sans objet en cas de perte. */
  resultatNet?: number | null;
  /** Famille comptable : la grille de lecture change selon le métier. */
  famille?: 'banque' | 'assurance' | 'general' | null;
  /** Exercice du dividende utilisé pour rendement/payout (si non daté en séance). */
  dividendeExercice?: number | null;
  /** Le dividende a une date de détachement vérifiée. */
  dividendeVerifie?: boolean;
  /** Droit de correction manuelle (admin) — la route /api/fundamentals le revérifie. */
  canEdit?: boolean;
  /** Ratios publics calculés sur les comptes retenus (SYSCOHADA) : l'emportent sur ceux de `inputs`, qui restent la base de correction manuelle. */
  ratiosPublics?: RatiosBilan;
  comptesRetenus?: { chiffreAffaires: number | null; resultatNet: number | null; capitauxPropres: number | null; detteFinanciere: number | null };
  /** Mention d'un second jeu de comptes publié par la société. */
  mentionSecondJeu?: string | null;
  /** La plage 52 semaines est déjà montrée ailleurs (jauges de la fiche). */
  sansPlage52?: boolean;
  /** Le bandeau de perte du chapitre dit déjà « PER non calculable ». */
  sansAlertePerte?: boolean;
}

function pct(v: number | null): string {
  if (v == null) return '—';
  // Format français : virgule décimale, signe moins typographique, espace insécable avant %.
  return `${(v * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('-', '−')} %`;
}
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
  // Comptes affichés : ceux retenus (SYSCOHADA) quand ils existent ; `p.inputs` ne sert plus qu'à la correction manuelle.
  const inp: FundamentalInputs = p.comptesRetenus
    ? { ...p.inputs, revenue: p.comptesRetenus.chiffreAffaires, net_income: p.comptesRetenus.resultatNet, equity: p.comptesRetenus.capitauxPropres, debt: p.comptesRetenus.detteFinanciere }
    : p.inputs;
  const r0 = computeRatios(inp);
  const rp = p.ratiosPublics;
  const r = rp
    ? { ...r0, capitalisation: rp.capitalisation, bpa: rp.bpa.valeur, per: rp.per.valeur, pb: rp.pb, ps: rp.ps, roe: rp.roe, margeNette: rp.margeNette, gearing: rp.gearing }
    : r0;
  const fam = FAMILLES[p.famille ?? 'general'] ?? FAMILLES.general;
  // BPA : source unique (résultat net ÷ titres, 2 décimales), comme les états financiers.
  const bpa = bpaAffichable(inp.net_income, inp.shares);
  const per = perAffichable(r.per, bpa.valeur ?? r.bpa);
  const dist = distributionAffichable(r.payout, p.resultatNet ?? null);

  const sortedHist = [...p.history].sort((a, b) => a.year - b.year);
  const last = sortedHist[sortedHist.length - 1];
  const prev = sortedHist[sortedHist.length - 2];
  const croissanceCA = last?.revenue && prev?.revenue ? last.revenue / prev.revenue - 1 : null;
  const evolutionRN = evolutionResultat(last?.net_income ?? null, prev?.net_income ?? null);
  const evolutionRNPositive = last?.net_income != null && prev?.net_income != null
    ? (last.net_income < 0 && prev.net_income < 0 ? Math.abs(last.net_income) < Math.abs(prev.net_income) : last.net_income >= prev.net_income)
    : null;

  const divSuffix = p.dividendeExercice != null && !p.dividendeVerifie
    ? ` (ex. ${p.dividendeExercice})` : '';
  const rendementDiv = formatRendementDividende(r.rendementDiv != null ? r.rendementDiv * 100 : null, p.dividendeExercice ?? null);

  // Alerte value trap : croise le PER avec la trajectoire du résultat net.
  const trap = assessValueTrap({
    per: r.per,
    netIncomeSeries: sortedHist.map((h) => h.net_income),
  });

  const revenuLabel = p.famille === 'banque' ? 'PNB' : p.famille === 'assurance' ? 'Primes' : 'CA';
  const chartPoints: FundaChartPoint[] = sortedHist.map((h) => ({
    periode: String(h.year),
    revenu: h.revenue,
    net: h.net_income,
    bpa: null,
    dividende: null,
  }));

  const Section = ({ title, children, large }: { title: string; children: React.ReactNode; large?: boolean }) => (
    <div className={`bg-surface border border-border rounded-xl p-4 ${large ? 'md:col-span-2' : ''}`}>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <div className={large ? 'divide-y divide-border/40 md:grid md:grid-cols-2 md:gap-x-10 md:divide-y-0' : 'divide-y divide-border/40'}>{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Fondamentaux{p.year ? ` (exercice ${p.year})` : ''}
          {p.famille === 'banque' && <span className="ml-2 rounded-full border border-info/40 px-2 py-0.5 text-[11px] font-medium text-info">Banque</span>}
          {p.famille === 'assurance' && <span className="ml-2 rounded-full border border-info/40 px-2 py-0.5 text-[11px] font-medium text-info">Assurance</span>}
        </h2>
        {p.canEdit && (
          <button type="button" onClick={() => setEditing(true)}
            className="text-xs border border-border rounded px-2 py-1 hover:border-up/40 hover:text-up transition">
            Corriger
          </button>
        )}
      </div>

      {!p.sansPlage52 && p.range52.low != null && (
        <RangeBar title="52 semaines" low={p.range52.low} high={p.range52.high} current={p.range52.current} />
      )}

      {!(p.sansAlertePerte && trap.verdict === 'perte') && <ValueTrapBadge result={trap} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Générales">
          <RatioCard label="Capitalisation" value={r.capitalisation != null ? fmtFcfa(r.capitalisation) + ' FCFA' : '—'} quality={assessQuality('capitalisation', r.capitalisation)} />
          <RatioCard label="BPA" value={bpa.valeur != null ? fmtNumber(bpa.valeur, 2) + ' FCFA' : '—'} quality={bpa.valeur == null ? 'missing' : 'ok'} positive={bpa.valeur != null ? bpa.valeur >= 0 : null} />
          <RatioCard label="Rendement dividende" value={rendementDiv ?? '—'} quality={assessQuality('rendementDiv', r.rendementDiv)} />
        </Section>

        <Section title="Évaluation">
          <RatioCard label="PER (P/E)" value={per.valeur != null ? num(per.valeur) : per.motif ?? '—'} quality={per.valeur == null ? 'missing' : assessQuality('per', per.valeur)} motif={per.motif} />
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
            <RatioCard label={`Payout (distribution)${divSuffix}`} value={dist.valeur != null ? pct(dist.valeur) : dist.motif ?? '—'} quality={dist.valeur == null ? 'missing' : assessQuality('payout', dist.valeur)} motif={dist.motif} />
          </Section>
        ) : (
          <Section title="Solidité & distribution">
            <RatioCard label="Capitaux propres" value={inp.equity != null ? fmtFcfa(inp.equity) + ' FCFA' : '—'} quality={inp.equity == null ? 'missing' : 'ok'} />
            <RatioCard label={`Payout (distribution)${divSuffix}`} value={dist.valeur != null ? pct(dist.valeur) : dist.motif ?? '—'} quality={dist.valeur == null ? 'missing' : assessQuality('payout', dist.valeur)} motif={dist.motif} />
          </Section>
        )}

        <Section title="Croissance (1 an)" large>
          <RatioCard label={`Croissance ${fam.revenu}`} value={pct(croissanceCA)} positive={croissanceCA != null ? croissanceCA >= 0 : null} quality={croissanceCA == null ? 'missing' : 'ok'} />
          <RatioCard label="Évolution du résultat net" value={evolutionRN ? insecable(evolutionRN) : '—'} texte positive={evolutionRNPositive} quality={evolutionRN == null ? 'missing' : 'ok'} />
        </Section>
      </div>

      {chartPoints.length >= 2 && (
        <FundamentalsCharts points={chartPoints} revenuLabel={revenuLabel} isBank={p.famille === 'banque'} />
      )}

      {p.sourceUrl && (
        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-up hover:underline block">
          États financiers officiels (PDF)
        </a>
      )}
      <p className="text-[11px] text-muted">
        {fam.revenuLong} retenu comme revenu. Nombre d&apos;actions : {p.inputs.shares != null ? fmtNumber(p.inputs.shares) : 'non renseigné'}
        {p.sharesSource ? ` (${p.sharesSource})` : ''}.
        {p.dividendeExercice != null && !p.dividendeVerifie && ` Dividende : exercice ${p.dividendeExercice} (date de détachement non publiée).`}
        {p.isManual && ' · Fondamentaux corrigés manuellement.'}
      </p>
      {p.mentionSecondJeu && <p className="text-xs text-faint">{p.mentionSecondJeu}</p>}

      {p.canEdit && editing && (
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

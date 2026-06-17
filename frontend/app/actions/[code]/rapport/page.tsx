import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getValuation } from '@/lib/valuation/server';
import { getScoring } from '@/lib/scoring/server';
import PrintTrigger from '@/components/financials/PrintTrigger';
import type { SignalDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props { params: { code: string } }

const fFCFA = (n: number | null | undefined) => (n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—');
const fPct = (n: number | null | undefined, d = 1) => (n != null ? `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%` : '—');
const fNum = (n: number | null | undefined, d = 2) => (n != null ? n.toFixed(d) : '—');

const STANCE_LABEL: Record<string, string> = {
  decote: 'Décote estimée', surcote: 'Surcote estimée', proche: 'Proche de la juste-valeur', indisponible: 'Valorisation indisponible',
};
const SIGNAL_LABEL: Record<string, string> = { BUY: 'ACHAT', SELL: 'VENTE', HOLD: 'CONSERVER' };

export default async function RapportPage({ params }: Props) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const supabase = createClient();

  const [{ data: instr }, { data: sigRows }, valuation, scoring] = await Promise.all([
    supabase.from('brvm_instruments').select('designation, secteur, pays').eq('code', code).maybeSingle(),
    supabase.from('signals_daily').select('*').eq('code', code).order('date_marche', { ascending: false }).limit(1),
    getValuation(code).catch(() => null),
    getScoring(code).catch(() => null),
  ]);

  if (!instr && !valuation) notFound();

  const designation = (instr as { designation?: string } | null)?.designation ?? code;
  const secteur = (instr as { secteur?: string } | null)?.secteur ?? '';
  const signal = (sigRows?.[0] ?? null) as SignalDaily | null;
  const m = valuation?.metrics ?? null;
  const fv = valuation?.fairValue ?? null;
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="bg-white text-black font-sans p-8 max-w-3xl mx-auto print:p-4 print:max-w-none">
      <PrintTrigger />

      {/* En-tête */}
      <div className="flex items-start justify-between mb-5 border-b-2 border-gray-900 pb-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">WESTBOURSE · Note d&apos;analyse</p>
          <h1 className="text-2xl font-bold mt-1">{code} — {designation}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{secteur}</p>
        </div>
        <div className="text-right text-[10px] text-gray-400">
          <p>Générée le {today}</p>
          <p className="mt-1 max-w-[180px]">Document informatif — ne constitue pas un conseil en investissement</p>
        </div>
      </div>

      {/* Synthèse : verdict valorisation + signal */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="border border-gray-300 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Valorisation</p>
          <p className="text-base font-bold">{valuation ? STANCE_LABEL[valuation.verdict.stance] : '—'}</p>
          {fv?.fairValue != null && valuation?.price != null && (
            <p className="text-xs text-gray-600 mt-1">
              Cours {fFCFA(valuation.price)} · Juste-valeur {fFCFA(fv.fairValue)} · Potentiel <span className="font-semibold">{fPct(fv.upside, 0)}</span>
            </p>
          )}
        </div>
        <div className="border border-gray-300 rounded p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Signal quantitatif</p>
          <p className="text-base font-bold">{signal ? SIGNAL_LABEL[signal.signal] ?? signal.signal : '—'}</p>
          {signal && (
            <p className="text-xs text-gray-600 mt-1">
              Score {signal.score_total >= 0 ? '+' : ''}{signal.score_total?.toFixed(2)} / 1.00
              {signal.confiance != null ? ` · confiance ${(signal.confiance * 100).toFixed(0)}%` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Ratios de valorisation */}
      <h2 className="text-sm font-bold uppercase tracking-wide mb-2 border-b border-gray-300 pb-1">Valorisation & rentabilité</h2>
      <div className="grid grid-cols-3 gap-3 mb-5 text-sm">
        {([
          ['P/E', fNum(m?.per, 1)],
          ['P/B', fNum(m?.pbr, 2)],
          ['Rendement div.', fPct(m?.dividendYield, 1)],
          ['ROE', fPct(m?.roe, 1)],
          ['Marge nette', fPct(m?.netMargin, 1)],
          ['Dette/FP', fNum(m?.debtToEquity, 2)],
        ] as [string, string][]).map(([label, val]) => (
          <div key={label} className="flex justify-between border-b border-gray-100 py-1">
            <span className="text-gray-500">{label}</span><span className="font-semibold">{val}</span>
          </div>
        ))}
      </div>

      {/* Santé financière */}
      <h2 className="text-sm font-bold uppercase tracking-wide mb-2 border-b border-gray-300 pb-1">Santé financière</h2>
      <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
        <div className="border border-gray-200 rounded p-3">
          <p className="text-[10px] uppercase text-gray-500">Piotroski F-Score</p>
          <p className="text-lg font-bold">{scoring?.fscore?.reliable ? `${scoring.fscore.score}/9 · ${scoring.fscore.label}` : '—'}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Rentabilité · levier · efficience</p>
        </div>
        <div className="border border-gray-200 rounded p-3">
          <p className="text-[10px] uppercase text-gray-500">Altman Z-Score</p>
          <p className="text-lg font-bold">
            {scoring?.altman?.applicable && scoring.altman.zone
              ? `${scoring.altman.z} · ${scoring.altman.zone === 'safe' ? 'Sain' : scoring.altman.zone === 'grey' ? 'Zone grise' : 'Risque'}`
              : 'n/a'}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{scoring?.altman?.applicable ? 'Risque de détresse' : (scoring?.altman?.note ?? 'Risque de détresse')}</p>
        </div>
      </div>

      {/* Lecture du signal */}
      {signal?.explication && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wide mb-2 border-b border-gray-300 pb-1">Lecture du signal</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-5">{signal.explication}</p>
        </>
      )}

      <p className="text-[10px] text-gray-400 mt-6 border-t pt-2 italic">
        Source : WESTBOURSE · {today}. Valorisation par multiples sectoriels et DDM. Les performances passées ne préjugent pas des résultats futurs.
      </p>
    </div>
  );
}

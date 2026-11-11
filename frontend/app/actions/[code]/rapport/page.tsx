import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getValuation } from '@/lib/valuation/server';
import { getScoring } from '@/lib/scoring/server';
import { libelleSignal } from '@/lib/signalLabel';
import { canAccess } from '@/lib/server/featureAccess';
import { versSignalPublic, type LigneSignalPublic } from '@/lib/signals/publics';
import PrintTrigger from '@/components/financials/PrintTrigger';
import type { SignalDaily } from '@/lib/types';
import { fmtNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ code: string }> }

const fFCFA = (n: number | null | undefined) => (n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—');
const fPct = (n: number | null | undefined, d = 1) => (n != null ? `${n >= 0 ? '+' : '−'}${fmtNumber(Math.abs(n) * 100, d)} %` : '—');
const fNum = (n: number | null | undefined, d = 2) => (n != null ? fmtNumber(n, d) : '—');

const STANCE_LABEL: Record<string, string> = {
  decote: 'Décote estimée', surcote: 'Surcote estimée', proche: 'Proche de la juste-valeur', indisponible: 'Valorisation indisponible',
};

export default async function RapportPage(props: Props) {
  const params = await props.params;
  const code = decodeURIComponent(params.code).toUpperCase();
  const supabase = createClient();

  // Page publique (préfixe /actions). Le signal complet (avec sa lecture) est
  // réservé à `signaux` ; sinon la note publique seule, comme /societes (F-04).
  const gateSignaux = await canAccess('signaux');
  const [{ data: instr }, { data: sigRows }, valuation, scoring] = await Promise.all([
    supabase.from('brvm_instruments').select('designation, secteur, pays').eq('code', code).maybeSingle(),
    gateSignaux.allowed
      ? supabase.from('signals_daily').select('*').eq('code', code).order('date_marche', { ascending: false }).limit(1)
      : supabase.rpc('signaux_publics', { p_code: code }),
    getValuation(code).catch(() => null),
    getScoring(code).catch(() => null),
  ]);

  if (!instr && !valuation) notFound();

  const designation = (instr as { designation?: string } | null)?.designation ?? code;
  const secteur = (instr as { secteur?: string } | null)?.secteur ?? '';
  const ligneSig = (sigRows?.[0] ?? null) as (SignalDaily | LigneSignalPublic) | null;
  const signal: SignalDaily | null = !ligneSig
    ? null
    : gateSignaux.allowed
      ? (ligneSig as SignalDaily)
      : versSignalPublic(ligneSig as LigneSignalPublic);
  const m = valuation?.metrics ?? null;
  const fv = valuation?.fairValue ?? null;
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="bg-[#ffffff] text-black font-sans p-8 max-w-3xl mx-auto print:p-4 print:max-w-none">
      <PrintTrigger />

      {/* En-tête */}
      <div className="flex items-start justify-between mb-5 border-b-2 border-gray-900 pb-3">
        <div>
          <h1 className="text-2xl font-bold">Note d&apos;analyse · {designation}</h1>
          <p className="text-xs text-gray-600 mt-0.5">{[code, secteur].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p>Générée le {today}</p>
          <p className="mt-1 max-w-[180px]">Document informatif : ne constitue pas un conseil en investissement</p>
        </div>
      </div>

      {/* Synthèse : verdict valorisation + signal */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Valorisation</p>
          <p className="text-base font-bold">{valuation ? STANCE_LABEL[valuation.verdict.stance] : '—'}</p>
          {fv?.fairValue != null && valuation?.price != null && (
            <p className="text-xs text-gray-600 mt-1">
              Cours {fFCFA(valuation.price)} · Juste-valeur {fFCFA(fv.fairValue)} · Potentiel <span className="font-semibold">{fPct(fv.upside, 0)}</span>
            </p>
          )}
        </div>
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Signal quantitatif</p>
          <p className="text-base font-bold">{signal ? libelleSignal(signal.signal) : '—'}</p>
          {signal && (
            <p className="text-xs text-gray-600 mt-1">
              Score {signal.score_total >= 0 ? '+' : '−'}{fmtNumber(Math.abs(signal.score_total), 2)} / 1,00
              {signal.confiance != null ? ` · confiance ${fmtNumber(signal.confiance * 100, 0)} %` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Ratios de valorisation */}
      <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1">Valorisation & rentabilité</h2>
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
            <span className="text-gray-600">{label}</span><span className="font-semibold">{val}</span>
          </div>
        ))}
      </div>

      {/* Santé financière */}
      <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1">Santé financière</h2>
      <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
        <div className="border border-gray-200 rounded p-3">
          <p className="text-xs text-gray-600">Piotroski F-Score</p>
          <p className="text-lg font-bold">{scoring?.fscore?.reliable ? `${scoring.fscore.score}/9 · ${scoring.fscore.label}` : '—'}</p>
          <p className="text-xs text-gray-600 mt-0.5">Rentabilité · levier · efficience</p>
        </div>
        <div className="border border-gray-200 rounded p-3">
          <p className="text-xs text-gray-600">Altman Z-Score</p>
          <p className="text-lg font-bold">
            {scoring?.altman?.applicable && scoring.altman.zone
              ? `${scoring.altman.z} · ${scoring.altman.zone === 'safe' ? 'Sain' : scoring.altman.zone === 'grey' ? 'Zone grise' : 'Risque'}`
              : 'n/a'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{scoring?.altman?.applicable ? 'Risque de détresse' : (scoring?.altman?.note ?? 'Risque de détresse')}</p>
        </div>
      </div>

      {/* Lecture du signal */}
      {signal?.explication && (
        <>
          <h2 className="text-sm font-bold mb-2 border-b border-gray-300 pb-1">Lecture du signal</h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-5">{signal.explication}</p>
        </>
      )}

      <p className="text-xs text-gray-600 mt-6 border-t pt-2 italic">
        Source : WESTBOURSE · {today}. Valorisation par multiples sectoriels et DDM. Les performances passées ne préjugent pas des résultats futurs.
      </p>
    </div>
  );
}

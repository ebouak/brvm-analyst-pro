// frontend/app/actions/[code]/print/page.tsx
import { notFound } from 'next/navigation';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { extractBankYear, computeBankKpis, scoreBanqueUemoa, bankExportSections } from '@/lib/bank/kpis';
import PrintTrigger from '@/components/financials/PrintTrigger';

interface Props { params: { code: string } }

export default async function PrintPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const data = await loadCompanyFinancials(code);
  if (!data) notFound();

  const inc_n  = data.incomeStatements[0] ?? null;
  const inc_n1 = data.incomeStatements[1] ?? null;
  const bal_n  = data.balanceSheets[0] ?? null;
  const cf_n   = data.cashFlowStatements[0] ?? null;

  const ratios = calculateFundamentals({
    coursActuel: data.latestDaily?.cours_jour ?? null,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: inc_n,
    incomePrev: inc_n1,
    balance: bal_n,
    cashflow: cf_n,
  });

  // Analyse bancaire (banques uniquement).
  const bankSections = (() => {
    if (data.instrument.famille_comptable !== 'banque') return null;
    const cur = extractBankYear(inc_n, bal_n);
    if (!cur) return null;
    const prev = extractBankYear(inc_n1, data.balanceSheets[1] ?? null);
    const kpis = computeBankKpis(cur, prev, {
      cours: data.latestDaily?.cours_jour ?? null,
      shares: data.instrument.shares,
      dividendeParAction: inc_n?.dividende_par_action ?? null,
    });
    return { periode: inc_n?.periode ?? null, sections: bankExportSections(kpis, scoreBanqueUemoa(kpis)) };
  })();

  const fmtFCFA = (n: number | null) => n != null ? `${n.toLocaleString('fr-FR')} FCFA` : '—';
  const fmtPct  = (n: number | null) => n != null ? `${n.toFixed(1)}%` : '—';
  const fmtX    = (n: number | null) => n != null ? `${n.toFixed(2)}x` : '—';
  const today   = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="bg-white text-black font-sans p-8 max-w-4xl mx-auto print:p-4 print:max-w-none">
      <PrintTrigger />
      <div className="flex items-start justify-between mb-6 border-b pb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">WESTBOURSE</p>
          <h1 className="text-2xl font-bold mt-1">{code} — {data.instrument.designation ?? code}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.instrument.secteur ?? ''}</p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>Fiche générée le {today}</p>
          <p className="mt-1">Ce document n&apos;est pas un conseil en investissement</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {([
          ['Cours actuel', fmtFCFA(ratios.cours_actuel)],
          ['52s bas', fmtFCFA(ratios.cours_bas_52s)],
          ['52s haut', fmtFCFA(ratios.cours_haut_52s)],
        ] as [string, string][]).map(([label, val]) => (
          <div key={label} className="border rounded p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-lg font-bold">{val}</p>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-semibold mb-3 border-b pb-1">Ratios fondamentaux</h2>
      <table className="w-full text-sm mb-6 border-collapse">
        <tbody>
          {([
            ['Capitalisation', fmtFCFA(ratios.capitalisation)],
            ['PER', fmtX(ratios.per)],
            ['P/Book', fmtX(ratios.pb)],
            ['P/CA', fmtX(ratios.ps)],
            ['BPA', fmtFCFA(ratios.bpa)],
            ['Rendement dividende', fmtPct(ratios.rendement_dividende)],
            ['Payout ratio', fmtPct(ratios.payout)],
            ['ROE', fmtPct(ratios.roe)],
            ['Marge nette', fmtPct(ratios.marge_nette)],
            ['Croissance CA', fmtPct(ratios.croissance_ca)],
            ['Croissance RN', fmtPct(ratios.croissance_rn)],
          ] as [string, string][]).map(([label, val], i) => (
            <tr key={label} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="py-1.5 px-3 text-gray-600">{label}</td>
              <td className="py-1.5 px-3 font-medium text-right">{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {bankSections && (
        <>
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">
            Analyse bancaire UEMOA{bankSections.periode ? ` (exercice ${bankSections.periode})` : ''}
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {bankSections.sections.map((sec) => (
              <div key={sec.titre} className="border rounded p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">{sec.titre}</p>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {sec.lignes.map(([label, val]) => (
                      <tr key={label}>
                        <td className="py-1 text-gray-500">{label.trim()}</td>
                        <td className="py-1 text-right font-medium">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mb-6 italic">
            Barème Commission Bancaire UMOA / FSI FMI. Un indicateur non publié dans les états
            déposés est neutralisé (hors calcul) ; la confiance indique la part du barème mesurable.
          </p>
        </>
      )}
      {data.incomeStatements.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3 border-b pb-1">Compte de résultat (FCFA)</h2>
          <table className="w-full text-sm mb-6 border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="py-1.5 px-3 text-left">Indicateur</th>
                {data.incomeStatements.map((s) => (
                  <th key={s.periode} className="py-1.5 px-3 text-right">{s.periode}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['revenu_total','marge_brute','resultat_exploitation','resultat_net','benefice_par_action','dividende_par_action'] as Array<keyof typeof inc_n>).map((key, i) => {
                const labels: Record<string, string> = {
                  revenu_total: 'Revenus totaux', marge_brute: 'Marge brute',
                  resultat_exploitation: 'EBIT', resultat_net: 'Résultat net',
                  benefice_par_action: 'BPA (FCFA)', dividende_par_action: 'Dividende/action',
                };
                return (
                  <tr key={key} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-1.5 px-3 text-gray-600">{labels[key as string]}</td>
                    {data.incomeStatements.map((s) => (
                      <td key={s.periode} className="py-1.5 px-3 text-right font-medium">
                        {s[key] != null ? (s[key] as number).toLocaleString('fr-FR') : '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <p className="text-xs text-gray-400 mt-8 border-t pt-3 italic">
        Source : WESTBOURSE · {today}
      </p>
    </div>
  );
}

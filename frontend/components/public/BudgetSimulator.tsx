'use client';

import { useMemo, useState } from 'react';
import {
  STRATEGIES,
  computeStrategy,
  type SimAction,
  type StrategyResult,
} from '@/lib/budgetSimulator';
import { fmtNumber } from '@/lib/format';

/* ──────────────────────────────────────────────────────────────────────────
   Simulateur de budget BRVM — UI publique (thème dark-finance cyan).
   Calcule en direct, côté client, trois portefeuilles à partir d'un univers
   d'actions réelles (cours + rendement + perf 12 mois) fourni par le serveur.
   ────────────────────────────────────────────────────────────────────────── */

const AMOUNTS = [100_000, 250_000, 500_000, 1_000_000, 5_000_000];
const LINE_OPTIONS = [3, 5, 8, 10];

const fFcfa = (n: number) => `${fmtNumber(Math.round(n))} FCFA`;
const fPct = (n: number) => `${n >= 0 ? '' : ''}${fmtNumber(n, 2)} %`;

function parseBudget(s: string): number {
  const v = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}
function parseFee(s: string): number {
  const v = parseFloat(String(s).replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/** KPIs affichés selon la stratégie. */
function kpisFor(r: StrategyResult, netTax: boolean): { label: string; value: string; tone?: 'up' | 'accent' }[] {
  const base = [
    { label: 'Investi', value: fFcfa(r.investiTotal) },
    { label: 'Reste', value: fFcfa(r.reste) },
  ];
  const divLabel = `Dividendes/an${netTax ? ' (net)' : ''}`;
  if (r.key === 'div') {
    return [
      ...base,
      { label: divLabel, value: fFcfa(r.divNet), tone: 'up' as const },
      { label: 'Rendement net', value: fPct(r.rendNet), tone: 'accent' as const },
    ];
  }
  if (r.key === 'cro') {
    return [
      ...base,
      { label: 'Perf. 12 m (pond.)', value: fPct(r.perfMoy), tone: r.perfMoy >= 0 ? ('up' as const) : undefined },
      { label: divLabel, value: fFcfa(r.divNet) },
    ];
  }
  return [
    ...base,
    { label: divLabel, value: fFcfa(r.divNet), tone: 'up' as const },
    { label: 'Retour total est.', value: fFcfa(r.retourTotal), tone: 'accent' as const },
  ];
}

const toneClass = (tone?: 'up' | 'accent') =>
  tone === 'up' ? 'text-up' : tone === 'accent' ? 'text-accent' : 'text-ivory';

export default function BudgetSimulator({
  univers,
  asOf,
  className = '',
}: {
  univers: SimAction[];
  asOf: string | null;
  className?: string;
}) {
  const [budgetStr, setBudgetStr] = useState('1 000 000');
  const [feeStr, setFeeStr] = useState('1,2');
  const [nLines, setNLines] = useState(5);
  const [diversify, setDiversify] = useState(false);
  const [netTax, setNetTax] = useState(false);

  const budget = parseBudget(budgetStr);
  const fee = parseFee(feeStr) / 100;

  const results = useMemo(
    () => STRATEGIES.map((s) => computeStrategy(s, univers, nLines, budget, fee, diversify, netTax)),
    [univers, nLines, budget, fee, diversify, netTax],
  );

  // Stratégie au meilleur retour total estimé.
  const bestIdx = results.reduce((best, r, i) => (r.retourTotal > results[best].retourTotal ? i : best), 0);

  const yieldKnown = univers.filter((a) => a.rendement != null).length;
  const perfKnown = univers.filter((a) => a.perf12 != null).length;

  return (
    <section className={className}>
      {/* En-tête */}
      <p className="overline mb-2 text-gold-2">Simulateur · BRVM / UEMOA</p>
      <h1 className="mb-3 max-w-[18ch] font-display text-3xl leading-tight text-ivory md:text-4xl">
        Que faire de <span className="text-accent">votre budget</span> ?
      </h1>
      <p className="mb-8 max-w-[62ch] text-[15px] leading-relaxed text-muted">
        Indiquez votre montant et vos frais de courtage. Le moteur compose trois portefeuilles — revenu,
        croissance, équilibre — avec le détail action par action, frais déduits et dividendes projetés à partir
        des cours réels de la BRVM.
      </p>

      {/* ── Console de paramètres ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-7">
        <h2 className="mb-5 font-display text-lg text-ivory">Vos paramètres</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Budget */}
          <div>
            <label htmlFor="bs-budget" className="block text-[13px] font-semibold text-ivory">
              Budget d&apos;investissement
            </label>
            <p className="mb-2.5 text-[11.5px] text-faint">Le montant total que vous souhaitez placer</p>
            <div className="flex items-center rounded-xl border border-white/10 bg-bg px-3.5 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
              <input
                id="bs-budget"
                inputMode="numeric"
                value={budgetStr}
                onChange={(e) => setBudgetStr(e.target.value)}
                onBlur={() => setBudgetStr(fmtNumber(parseBudget(budgetStr)))}
                className="w-full bg-transparent py-3 font-mono text-lg font-semibold text-ivory outline-none"
                aria-label="Budget en FCFA"
              />
              <span className="flex-none pl-2 font-mono text-xs text-faint">FCFA</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setBudgetStr(fmtNumber(a))}
                  aria-pressed={budget === a}
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-[12px] transition-colors active:scale-95 ${
                    budget === a
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-white/10 text-muted hover:border-white/25 hover:text-ivory'
                  }`}
                >
                  {fmtNumber(a)}
                </button>
              ))}
            </div>
          </div>

          {/* Frais */}
          <div>
            <label htmlFor="bs-fee" className="block text-[13px] font-semibold text-ivory">
              Frais de courtage SGI
            </label>
            <p className="mb-2.5 text-[11.5px] text-faint">Courtage moyen par ordre — varie selon la SGI</p>
            <div className="flex items-center rounded-xl border border-white/10 bg-bg px-3.5 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
              <input
                id="bs-fee"
                inputMode="decimal"
                value={feeStr}
                onChange={(e) => setFeeStr(e.target.value)}
                className="w-full bg-transparent py-3 font-mono text-lg font-semibold text-ivory outline-none"
                aria-label="Frais de courtage en pourcentage"
              />
              <span className="flex-none pl-2 font-mono text-xs text-faint">%</span>
            </div>
            <label className="mt-3.5 flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[13px] text-ivory">
              <input
                type="checkbox"
                checked={netTax}
                onChange={(e) => setNetTax(e.target.checked)}
                className="h-4 w-4 accent-[#56D7FD]"
              />
              Dividendes nets d&apos;IRVM (10&nbsp;%)
            </label>
          </div>

          {/* Composition */}
          <div>
            <span className="block text-[13px] font-semibold text-ivory">Composition</span>
            <p className="mb-2.5 text-[11.5px] text-faint">Nombre de lignes par portefeuille</p>
            <div
              className="inline-flex overflow-hidden rounded-xl border border-white/10"
              role="group"
              aria-label="Nombre de lignes par portefeuille"
            >
              {LINE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNLines(n)}
                  aria-pressed={nLines === n}
                  className={`border-r border-white/10 px-4 py-2.5 font-mono text-[13px] last:border-r-0 transition-colors ${
                    nLines === n ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-ivory'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="mt-3.5 flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[13px] text-ivory">
              <input
                type="checkbox"
                checked={diversify}
                onChange={(e) => setDiversify(e.target.checked)}
                className="h-4 w-4 accent-[#56D7FD]"
              />
              Diversifier par secteur
            </label>
          </div>
        </div>

        {/* Résumé */}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/[0.07] pt-5">
          {[
            ['Budget', fFcfa(budget), ''],
            ['Investi (moy.)', fFcfa(results.reduce((t, r) => t + r.investiTotal, 0) / results.length), ''],
            ['Frais SGI (moy.)', fFcfa(results.reduce((t, r) => t + r.frais, 0) / results.length), ''],
            ['Disponible (moy.)', fFcfa(results.reduce((t, r) => t + r.reste, 0) / results.length), ''],
            ['Actions dispo.', String(univers.length), 'accent'],
          ].map(([l, v, tone]) => (
            <div key={l} className="min-w-[120px]">
              <dt className="font-mono text-[10.5px] uppercase tracking-wide text-faint">{l}</dt>
              <dd className={`mt-1 font-mono text-lg ${tone === 'accent' ? 'text-accent' : 'text-ivory'}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Cartes stratégies ───────────────────────────────────────────── */}
      {univers.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-muted">
            Données de marché momentanément indisponibles. Réessayez plus tard.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {results.map((r, i) => {
            const meta = STRATEGIES[i]!;
            const isBest = i === bestIdx;
            const kpis = kpisFor(r, netTax);
            const totMontant = r.investiTitres || 1;
            return (
              <article
                key={r.key}
                className={`flex flex-col rounded-2xl border bg-white/[0.02] p-6 ${
                  isBest ? 'border-accent/40 ring-1 ring-accent/20' : 'border-white/10'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h3 className="font-display text-xl text-ivory">{meta.nom}</h3>
                  <span
                    className={`flex-none rounded-md border px-2 py-1 font-mono text-[9.5px] uppercase tracking-wide ${
                      isBest
                        ? 'border-accent/30 bg-accent/10 text-accent'
                        : meta.reco
                        ? 'border-gold-2/30 bg-gold-2/10 text-gold-2'
                        : 'border-white/10 bg-white/[0.04] text-muted'
                    }`}
                  >
                    {isBest ? 'Meilleur retour est.' : meta.tag}
                  </span>
                </div>
                <p className="mb-4 min-h-[54px] text-[13px] leading-relaxed text-muted">{meta.desc}</p>

                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.05]">
                  {kpis.map((k) => (
                    <div key={k.label} className="bg-bg p-3">
                      <div className={`font-mono text-[15px] ${toneClass(k.tone)}`}>{k.value}</div>
                      <div className="mt-1 text-[10.5px] uppercase tracking-wide text-faint">{k.label}</div>
                    </div>
                  ))}
                </div>

                {r.lines.length === 0 ? (
                  <p className="mt-auto rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 text-center text-[12.5px] text-faint">
                    {r.eligibleCount === 0
                      ? 'Aucune action ne dispose de la métrique requise pour cette stratégie.'
                      : 'Budget insuffisant pour acheter au moins une action.'}
                  </p>
                ) : (
                  <table className="mt-auto w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="text-faint">
                        <th className="border-b border-white/[0.07] pb-2 text-left font-mono text-[9.5px] font-medium uppercase tracking-wide">
                          Action
                        </th>
                        <th className="border-b border-white/[0.07] pb-2 text-right font-mono text-[9.5px] font-medium uppercase tracking-wide">
                          Cours
                        </th>
                        <th className="border-b border-white/[0.07] pb-2 text-right font-mono text-[9.5px] font-medium uppercase tracking-wide">
                          Qté
                        </th>
                        <th className="border-b border-white/[0.07] pb-2 text-right font-mono text-[9.5px] font-medium uppercase tracking-wide">
                          Montant
                        </th>
                        <th className="border-b border-white/[0.07] pb-2 text-right font-mono text-[9.5px] font-medium uppercase tracking-wide">
                          Part
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.lines.map((l) => {
                        const part = (l.montant / totMontant) * 100;
                        return (
                          <tr key={l.action.code}>
                            <td className="border-b border-white/[0.07] py-2.5">
                              <span className="block font-semibold text-ivory">{l.action.code}</span>
                              <span className="block text-[10px] text-faint">{l.action.designation}</span>
                              <span
                                className="mt-1 block h-[3px] rounded-sm bg-accent/55"
                                style={{ width: `${Math.max(4, Math.round(part))}%` }}
                                aria-hidden
                              />
                            </td>
                            <td className="border-b border-white/[0.07] py-2.5 text-right font-mono text-muted">
                              {fmtNumber(l.action.prix)}
                            </td>
                            <td className="border-b border-white/[0.07] py-2.5 text-right font-mono text-ivory">
                              {l.qty}
                            </td>
                            <td className="border-b border-white/[0.07] py-2.5 text-right font-mono text-muted">
                              {fmtNumber(l.montant)}
                            </td>
                            <td className="border-b border-white/[0.07] py-2.5 text-right font-mono text-faint">
                              {Math.round(part)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Couverture des données + avertissement */}
      <p className="mt-5 text-[11.5px] leading-relaxed text-faint">
        Univers : {univers.length} action{univers.length > 1 ? 's' : ''} cotée
        {univers.length > 1 ? 's' : ''}
        {asOf ? ` · cours au ${asOf}` : ''}. Rendement dividende connu pour {yieldKnown}, performance 12 mois pour{' '}
        {perfKnown}. Les actions sans la métrique requise sont écartées de la stratégie concernée — aucun chiffre
        n&apos;est inventé.
      </p>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-gold-2/30 bg-gold-2/[0.06] px-4 py-3.5 text-[13px] leading-relaxed text-gold-2/90">
        <span aria-hidden>⚠</span>
        <p>
          <b className="text-gold-2">Outil éducatif.</b> Ce simulateur ne constitue pas un conseil en
          investissement. Les dividendes projetés sont des estimations (le net suppose une IRVM de 10&nbsp;% sur
          actions cotées, à vérifier) et la « perf 12 mois » est historique — les performances passées ne préjugent
          pas des performances futures. Avant tout ordre, contactez une SGI agréée ; les frais réels varient selon la
          SGI et le montant.
        </p>
      </div>

      {/* Liens croisés */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          href="/comparateur-sgi"
          className="block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-accent/35"
        >
          <h4 className="mb-1.5 font-display text-[1.1rem] text-ivory">Choisir votre SGI</h4>
          <p className="text-[13.5px] text-muted">
            Comparez les courtiers agréés par pays avant d&apos;ouvrir votre compte-titres.
          </p>
          <span className="mt-2.5 inline-block font-mono text-[13px] text-accent">Ouvrir le comparateur →</span>
        </a>
        <a
          href="/societes"
          className="block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-accent/35"
        >
          <h4 className="mb-1.5 font-display text-[1.1rem] text-ivory">Explorer les sociétés</h4>
          <p className="text-[13.5px] text-muted">
            Cours, note BRVM A–F et fiche d&apos;analyse gratuite pour chaque action cotée.
          </p>
          <span className="mt-2.5 inline-block font-mono text-[13px] text-accent">Voir les sociétés →</span>
        </a>
      </div>
    </section>
  );
}

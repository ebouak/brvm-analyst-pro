import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDcfRanking } from '@/lib/dcf/ranking';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import ViewTabs from '@/components/ViewTabs';
import { VALO_TABS } from '@/lib/viewTabsPresets';

export const metadata = { title: 'Valorisation DCF — WESTBOURSE' };
export const revalidate = 3600;

const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)} %`);

export default async function DcfIndexPage() {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login');

  const rows = await getDcfRanking();
  const computable = rows.filter((r) => r.upside != null);
  const decotes = computable.filter((r) => (r.upside ?? 0) > 0.15).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        accent="gold"
        kicker="Intelligence fondamentale"
        title="Valorisation DCF — classement du marché"
        subtitle="Juste-valeur par flux actualisés (WACC dérivé du MEDAF) pour toute la cote. Outil de screening — cliquez une société pour la fiche détaillée (bêta réel, hypothèses ajustables)."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />
      <ViewTabs tabs={VALO_TABS} current="/premium/dcf" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-panel border border-border bg-surface px-4 py-3">
          <p className="overline text-faint">Sociétés valorisables</p>
          <p className="mt-1 tabular text-xl font-semibold text-white">{computable.length}<span className="text-sm text-faint"> / {rows.length}</span></p>
        </div>
        <div className="rounded-panel border border-border bg-surface px-4 py-3">
          <p className="overline text-faint">En décote estimée</p>
          <p className="mt-1 tabular text-xl font-semibold text-up">{decotes}<span className="text-sm text-faint"> (&gt; +15 %)</span></p>
        </div>
        <div className="rounded-panel border border-border bg-surface px-4 py-3">
          <p className="overline text-faint">Plus forte décote</p>
          <p className="mt-1 tabular text-xl font-semibold text-white">
            {computable[0] ? `${computable[0].code} ${pct(computable[0].upside)}` : '—'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
              <th className="px-3 py-2.5 text-left font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Société</th>
              <th className="px-3 py-2.5 text-right font-semibold">Cours</th>
              <th className="px-3 py-2.5 text-right font-semibold">Juste-valeur DCF</th>
              <th className="px-3 py-2.5 text-right font-semibold">Potentiel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const up = (r.upside ?? 0) >= 0;
              return (
                <tr key={r.code} className="border-b border-border/30 transition hover:bg-elevated/30">
                  <td className="px-3 py-3 tabular text-faint">{r.upside != null ? i + 1 : '—'}</td>
                  <td className="px-3 py-3">
                    <Link href={`/premium/dcf/${r.code}`} className="font-semibold text-white hover:text-info">
                      {r.code}
                    </Link>
                    {r.designation && <span className="ml-2 text-xs text-muted">{r.designation}</span>}
                    {r.mode === 'proxy' && <span className="ml-2 rounded bg-info/10 px-1.5 py-0.5 text-[10px] text-info">proxy</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular text-white">{r.cours != null ? fmtNumber(r.cours) : '—'}</td>
                  <td className="px-3 py-3 text-right tabular text-white">
                    {r.fairValue != null ? fmtFcfa(r.fairValue) : <span className="text-faint">non calculable</span>}
                  </td>
                  <td className={`px-3 py-3 text-right tabular font-semibold ${r.upside == null ? 'text-faint' : up ? 'text-up' : 'text-down'}`}>
                    {pct(r.upside)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-faint">
        Hypothèses du classement (indicatif) : rf 6 %, bêta 1,0, primes de risque Côte d&apos;Ivoire,
        croissance = CAGR des FCF (bornée 0–12 %), horizon 5 ans, croissance terminale 2 %. « proxy » =
        FCF approché par le résultat net (flux détaillés indisponibles). La fiche par action affine tout
        (bêta réel, rf souverain, hypothèses ajustables).
      </p>
    </div>
  );
}

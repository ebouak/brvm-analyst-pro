import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { fromDailyRow, LIQUIDITY_LABELS, type LiquidityDailyRow } from '@/lib/liquidity';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Liquidité du marché BRVM — scores par titre',
  description:
    'Score de liquidité 0-100 par action : présence, activité, impact prix (Amihud), spread estimé (Roll) et flux acheteur/vendeur intraday.',
};

const CLASS_STYLE: Record<string, string> = {
  A: 'border-up/30 bg-up/10 text-up',
  B: 'border-accent/30 bg-accent/10 text-accent',
  C: 'border-gold/30 bg-gold/10 text-gold',
  D: 'border-down/30 bg-down/10 text-down',
};

const fmtFcfa = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M FCFA`
    : `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default async function LiquiditePage() {
  const db = createPublicClient();

  const { data: dateRow } = await db
    .from('liquidity_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const asOf = (dateRow as { date_marche: string } | null)?.date_marche ?? null;

  const { data } = asOf
    ? await db
        .from('liquidity_daily')
        .select('*')
        .eq('date_marche', asOf)
        .order('score', { ascending: false, nullsFirst: false })
    : { data: [] };
  const rows = (data ?? []) as (LiquidityDailyRow & { code: string })[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <SectionHeader
        kicker="Analyse"
        title="Liquidité du marché"
        subtitle={
          asOf
            ? `Scores au ${asOf} : présence, activité, impact prix (Amihud), spread estimé (Roll) et flux intraday.`
            : 'Score de liquidité par titre, reconstitué à partir des échanges.'
        }
      />

      {rows.length === 0 ? (
        <EmptyStatePremium
          title="Pas encore de scores"
          hint="Le calcul quotidien n’a pas encore tourné. Revenez après la prochaine clôture de séance."
        />
      ) : (
        <PremiumPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-3 py-2">Titre</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Classe</th>
                  <th className="px-3 py-2">Présence</th>
                  <th className="px-3 py-2">Valeur moy. / séance</th>
                  <th className="px-3 py-2">Spread estimé</th>
                  <th className="px-3 py-2">Flux net séance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = fromDailyRow(r);
                  return (
                    <tr key={r.code} className="border-b border-border/40 transition-colors last:border-0 hover:bg-bg/40">
                      <td className="px-3 py-2">
                        <Link href={`/actions/${r.code}`} className="font-semibold text-ivory transition-colors hover:text-accent">
                          {r.code}
                        </Link>
                      </td>
                      <td className="tabular px-3 py-2 text-ivory">{s ? s.score : '—'}</td>
                      <td className="px-3 py-2">
                        {s ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${CLASS_STYLE[s.classe]}`}>
                            {s.classe} · {LIQUIDITY_LABELS[s.classe]}
                          </span>
                        ) : (
                          <span className="text-[11px] text-faint">données insuffisantes</span>
                        )}
                      </td>
                      <td className="tabular px-3 py-2 text-muted">{Math.round(r.presence_pct)} %</td>
                      <td className="tabular px-3 py-2 text-muted">{fmtFcfa(r.valeur_moyenne_30j)}</td>
                      <td className="tabular px-3 py-2 text-muted">
                        {r.spread_roll_pct != null ? `≈ ${Number(r.spread_roll_pct).toFixed(2)} %` : '—'}
                      </td>
                      <td
                        className={`tabular px-3 py-2 ${
                          r.flux_net_pct == null ? 'text-faint' : Number(r.flux_net_pct) >= 0 ? 'text-up' : 'text-down'
                        }`}
                      >
                        {r.flux_net_pct != null
                          ? `${Number(r.flux_net_pct) > 0 ? '+' : ''}${Number(r.flux_net_pct).toFixed(0)} %`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PremiumPanel>
      )}

      <PremiumPanel>
        <h2 className="text-sm font-semibold text-ivory">Méthodologie</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Score 0-100 calculé sur 30 séances, en quatre parts égales : la présence (part des séances
          où le titre a réellement traité), l’activité en valeur échangée (échelle logarithmique de
          100 000 à 100 millions de FCFA par séance), l’impact prix (ratio d’Amihud : variation
          moyenne rapportée à chaque million de FCFA échangé) et le spread implicite (estimateur de
          Roll sur les alternances de clôture).
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          La BRVM ne publie pas son carnet d’ordres. La profondeur et le coût d’exécution sont donc
          estimés à partir des échanges observés, jamais inventés. Le flux acheteur/vendeur est
          reconstitué par tick rule sur les captures intraday : le volume passé alors que le cours
          monte compte comme pression acheteuse. Cet indicateur est directionnel et n’entre pas dans
          le score. En dessous de 10 séances d’historique, aucun score n’est affiché.
        </p>
      </PremiumPanel>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { SectionHeader, PremiumPanel, MetricCard, EmptyStatePremium } from '@/components/ui/premium';
import { fmtDateFR } from '@/lib/format';
import {
  computeFlips,
  attachPerformance,
  computeStats,
  type AdvisorHistoryRow,
} from '@/lib/advisor/trackRecord';
import type { Action } from '@/lib/advisor/recommend';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Track record du Conseiller BRVM',
  description:
    'Toutes les bascules de recommandation du Conseiller BRVM, datées, avec la performance du cours depuis chacune. Transparence totale : les bonnes comme les mauvaises.',
};

const ACT_LABEL: Record<Action, string> = { acheter: 'Acheter', conserver: 'Conserver', vendre: 'Vendre' };
const ACT_BADGE: Record<Action, string> = {
  acheter: 'bg-up/15 text-up border-up/30',
  conserver: 'bg-gold/10 text-gold border-gold/25',
  vendre: 'bg-down/15 text-down border-down/30',
};

async function getData() {
  const sb = createPublicClient();

  // Historique complet des snapshots du Conseiller (~45 codes × 1/jour).
  const { data: histData } = await sb
    .from('advisor_history')
    .select('date_marche, code, action, conviction')
    .order('date_marche', { ascending: true })
    .limit(50_000);
  const history = (histData ?? []) as AdvisorHistoryRow[];
  if (history.length === 0) return { flips: [], stats: null, depuis: null };

  const flips = computeFlips(history);
  const depuis = history[0]?.date_marche ?? null;
  if (flips.length === 0) return { flips: [], stats: null, depuis };

  // Clôtures des codes concernés depuis la première bascule (pour la perf).
  const codes = [...new Set(flips.map((f) => f.code))];
  const minDate = flips.reduce((m, f) => (f.date < m ? f.date : m), flips[0]!.date);
  const { data: priceData } = await sb
    .from('brvm_actions_daily')
    .select('code, date_marche, cours_jour')
    .in('code', codes)
    .gte('date_marche', minDate)
    .order('date_marche', { ascending: true })
    .limit(50_000);

  const series = new Map<string, { date: string; close: number }[]>();
  for (const r of (priceData ?? []) as { code: string; date_marche: string; cours_jour: number | null }[]) {
    if (r.cours_jour == null || r.cours_jour <= 0) continue;
    const list = series.get(r.code) ?? [];
    list.push({ date: r.date_marche, close: r.cours_jour });
    series.set(r.code, list);
  }

  const withPerf = attachPerformance(flips, series);
  return { flips: withPerf, stats: computeStats(withPerf), depuis };
}

export default async function TrackRecordPage() {
  const { flips, stats, depuis } = await getData();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <SectionHeader
        kicker="Conseiller · transparence"
        title="Track record du Conseiller"
        subtitle="Chaque changement de recommandation est daté au moment où il a été émis, et la performance du cours depuis est affichée — les bonnes bascules comme les mauvaises. Rien n'est antidaté, rien n'est effacé."
      />

      <div className="flex items-center justify-between gap-3">
        <Link href="/conseiller" className="text-xs text-accent hover:underline">← Retour au Conseiller</Link>
        {depuis && (
          <span className="text-[11px] text-faint">
            Historique suivi depuis le <span className="tabular text-muted">{fmtDateFR(depuis)}</span>
          </span>
        )}
      </div>

      {flips.length === 0 ? (
        <EmptyStatePremium
          title="Pas encore de bascule enregistrée"
          hint="Le track record se construit séance après séance : dès que le Conseiller change une recommandation, elle apparaît ici avec sa performance."
          icon="◈"
        />
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Bascules enregistrées" value={String(stats.nb)} accent="neutral" />
              <MetricCard
                label="Taux de réussite"
                value={stats.hitRate != null ? `${stats.hitRate.toFixed(0)} %` : '—'}
                unit={stats.notees > 0 ? `sur ${stats.notees} notées` : undefined}
                accent={stats.hitRate != null && stats.hitRate >= 50 ? 'emerald' : 'neutral'}
              />
              <MetricCard
                label="Cours après « Acheter »"
                value={stats.perfMoyenneAchat != null ? `${stats.perfMoyenneAchat >= 0 ? '+' : ''}${stats.perfMoyenneAchat.toFixed(1)} %` : '—'}
                unit="en moyenne"
                accent="emerald"
              />
              <MetricCard
                label="Cours après « Vendre »"
                value={stats.perfMoyenneVente != null ? `${stats.perfMoyenneVente >= 0 ? '+' : ''}${stats.perfMoyenneVente.toFixed(1)} %` : '—'}
                unit="en moyenne (négatif = bon appel)"
                accent="sapphire"
              />
            </div>
          )}

          <PremiumPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg/40 text-left">
                    <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-faint">Date</th>
                    <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-faint">Titre</th>
                    <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-faint">Bascule</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Cours bascule</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Cours actuel</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Depuis</th>
                    <th className="px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-wider text-faint">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {flips.map((f, i) => (
                    <tr key={`${f.code}-${f.date}-${i}`} className="border-b border-border/50 transition hover:bg-white/[0.02] last:border-0">
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-xs text-muted">{fmtDateFR(f.date)}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/actions/${f.code}`} className="font-semibold text-ivory transition hover:text-accent">
                          {f.code}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`rounded-md border px-1.5 py-0.5 font-medium ${ACT_BADGE[f.from]}`}>{ACT_LABEL[f.from]}</span>
                          <span className="text-faint">→</span>
                          <span className={`rounded-md border px-1.5 py-0.5 font-bold ${ACT_BADGE[f.to]}`}>{ACT_LABEL[f.to]}</span>
                        </span>
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-xs text-muted">
                        {f.coursBascule != null ? f.coursBascule.toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right text-xs text-ivory">
                        {f.coursActuel != null ? f.coursActuel.toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className={`tabular px-4 py-2.5 text-right text-xs font-bold ${
                        f.perfPct == null ? 'text-faint' : f.perfPct >= 0 ? 'text-up' : 'text-down'
                      }`}>
                        {f.perfPct != null ? `${f.perfPct >= 0 ? '+' : ''}${f.perfPct.toFixed(1)} %` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm">
                        {f.correct == null ? (
                          <span className="text-faint" title="Bascule vers Conserver ou cours indisponible : non notée">·</span>
                        ) : f.correct ? (
                          <span className="text-up" title="Le cours a évolué dans le sens de la recommandation">✓</span>
                        ) : (
                          <span className="text-down" title="Le cours a évolué contre la recommandation">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumPanel>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-faint">
        Méthode : la bascule est datée du snapshot quotidien qui l&apos;a produite ; la performance va de
        la clôture de ce jour au dernier cours connu, brute (hors frais de courtage et hors dividendes).
        Les bascules vers « Conserver » ne sont pas notées. Un historique court n&apos;a pas de valeur
        statistique — jugez sur la durée. Ne constitue pas un conseil en investissement.
      </p>
    </div>
  );
}

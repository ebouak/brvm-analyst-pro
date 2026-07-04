import Link from 'next/link';
import { getAdvisorRecommendations } from '@/lib/advisor/server';
import { getRecentChanges } from '@/lib/advisor/changes';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { AdvisorCard } from '@/components/advisor/AdvisorCard';
import { MyPortfolioAdvice } from '@/components/advisor/MyPortfolioAdvice';
import type { Action } from '@/lib/advisor/recommend';

export const metadata = { title: 'Conseiller BRVM — WESTBOURSE' };
export const revalidate = 3600;

const ACT_LABEL: Record<Action, string> = { acheter: 'Acheter', conserver: 'Conserver', vendre: 'Vendre' };
const ACT_COLOR: Record<Action, string> = { acheter: 'text-up', conserver: 'text-gold', vendre: 'text-down' };

export default async function ConseillerPage() {
  const [rows, changes] = await Promise.all([getAdvisorRecommendations(), getRecentChanges()]);
  const counts = {
    acheter: rows.filter((r) => r.result.action === 'acheter').length,
    conserver: rows.filter((r) => r.result.action === 'conserver').length,
    vendre: rows.filter((r) => r.result.action === 'vendre').length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <SectionHeader
        kicker="Bot conseiller"
        title="Conseiller BRVM"
        subtitle="Une recommandation unifiée par action — Acheter / Conserver / Vendre — qui combine le signal quantitatif, la valorisation DCF, le RSI et le dividende. Aide à la décision : exécutez via votre SGI (la BRVM n'a pas d'ordres en ligne)."
        actions={<StatPill tone="neutral"><span className="tabular">{rows.length}</span>&nbsp;valeurs analysées</StatPill>}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-panel border-2 border-up/40 bg-up/10 px-4 py-3">
          <p className="overline text-up flex items-center gap-1">▲ À acheter</p>
          <p className="mt-1 tabular text-3xl font-bold text-up">{counts.acheter}</p>
        </div>
        <div className="rounded-panel border border-border bg-surface px-4 py-3">
          <p className="overline text-muted flex items-center gap-1">■ À conserver</p>
          <p className="mt-1 tabular text-3xl font-bold text-white">{counts.conserver}</p>
        </div>
        <div className="rounded-panel border-2 border-down/40 bg-down/10 px-4 py-3">
          <p className="overline text-down flex items-center gap-1">▼ À vendre</p>
          <p className="mt-1 tabular text-3xl font-bold text-down">{counts.vendre}</p>
        </div>
      </div>

      {/* ── Alertes : bascules de recommandation (vs séance précédente) ── */}
      {changes.length > 0 && (
        <section className="rounded-xl border border-info/30 bg-info/5 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base text-white">
            🔔 Changements de recommandation
            <span className="text-[11px] font-normal text-faint">(depuis la dernière séance)</span>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <li key={c.code}>
                <Link href={`/actions/${c.code}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs hover:border-info/40">
                  <span className="font-semibold text-white">{c.code}</span>
                  <span className={ACT_COLOR[c.from]}>{ACT_LABEL[c.from]}</span>
                  <span className="text-faint">→</span>
                  <span className={`font-semibold ${ACT_COLOR[c.to]}`}>{ACT_LABEL[c.to]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Conseils personnalisés sur le portefeuille (client, user-scoped) */}
      <MyPortfolioAdvice />

      {/* ── Toute la cote, regroupée par recommandation (l'actionnable d'abord) ── */}
      <p className="pt-2 text-xs text-muted">Cliquez une carte pour retourner et voir la justification détaillée.</p>
      {(['acheter', 'conserver', 'vendre'] as Action[]).map((action) => {
        const group = rows
          .filter((r) => r.result.action === action)
          .sort((a, b) => b.result.conviction - a.result.conviction);
        if (group.length === 0) return null;
        const convictionMoy = Math.round(group.reduce((s, r) => s + r.result.conviction, 0) / group.length);
        return (
          <section key={action} aria-label={`Recommandations ${ACT_LABEL[action]}`}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className={`font-display text-lg ${ACT_COLOR[action]}`}>
                {action === 'acheter' ? '▲' : action === 'vendre' ? '▼' : '■'} {ACT_LABEL[action]}
                <span className="tabular ml-2 text-sm text-faint">({group.length})</span>
              </h2>
              <span className="text-[11px] text-faint">
                conviction moyenne <span className="tabular text-muted">{convictionMoy} %</span> · triées par conviction
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((r) => (
                <AdvisorCard key={r.code} row={r} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-[11px] text-faint">
        Synthèse algorithmique dérivée des données réelles (signaux, DCF, RSI, dividendes) — aucune
        valeur inventée. Ne constitue pas un conseil en investissement personnalisé. Performances passées
        ne préjugent pas des performances futures.
      </p>
    </div>
  );
}

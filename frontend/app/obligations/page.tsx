import { createPublicClient } from '@/lib/supabase/public';
import ObligationsTable, { type ObligationRow } from '@/components/ObligationsTable';
import type { ObligationDaily } from '@/lib/types';
// Source UNIQUE du calcul (ligne, YTM, moyenne) : le bloc « Le marché
// aujourd'hui » du tableau de bord lit la même, les deux chiffres concordent.
import { syntheseObligations, versLigneObligation } from '@/lib/marche/obligations';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  EmptyStatePremium,
  StatPill,
} from '@/components/ui/premium';

export const revalidate = 300;
export const metadata = { title: 'Obligations' };

/** "2026-11-03" → "3 nov. 2026" (affichage seul ; la donnée reste ISO). */
function fmtSeance(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

async function getData() {
  const supabase = createPublicClient();

  const { data: lastRow } = await supabase
    .from('brvm_obligations_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, active: [] as ObligationRow[], expired: [] as ObligationRow[], avgBondYtm: null };

  const { data } = await supabase
    .from('brvm_obligations_daily')
    .select('*')
    .eq('date_marche', lastDate);

  const obls = (data ?? []) as ObligationDaily[];
  // YTM moyen = actives, non amorties, YTM plausible (règles dans lib/marche/obligations).
  const { actives: active, echues: expired, ytmMoyen: avgBondYtm } = syntheseObligations(obls.map((o) => versLigneObligation(o)));

  return { lastDate, active, expired, avgBondYtm };
}

export default async function ObligationsPage() {
  const { lastDate, active, expired, avgBondYtm } = await getData();

  if (!lastDate) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <SectionHeader
          title="Marché obligataire"
          subtitle="Rendement à l’échéance (YTM), duration modifiée et courbe des taux des obligations cotées à la BRVM."
        />
        <EmptyStatePremium
          icon="◎"
          title="Aucune donnée obligataire"
          hint="Lancez le scraper pour alimenter la base avec les séances récentes."
        />
      </div>
    );
  }

  const withYtm = active.filter((r) => r.ytm != null).length;
  const ytms = active.map((r) => r.ytm).filter((y): y is number => y != null);
  const minYtm = ytms.length ? Math.min(...ytms) : null;
  const maxYtm = ytms.length ? Math.max(...ytms) : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Marché obligataire"
        subtitle="Rendement à l’échéance (YTM) et duration modifiée des obligations cotées à la BRVM."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill tone="sapphire">
              Séance du <span className="tabular ml-1">{fmtSeance(lastDate)}</span>
            </StatPill>
            <StatPill tone="neutral">
              <span className="tabular">{active.length}</span>&nbsp;actives
            </StatPill>
            <StatPill tone="neutral">
              <span className="tabular">{expired.length}</span>&nbsp;échues
            </StatPill>
          </div>
        }
      />

      <div className="h-px bg-gold-line" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="YTM moyen"
          value={avgBondYtm != null ? `${avgBondYtm.toFixed(2)}%` : '—'}
          accent="gold"
        />
        <MetricCard
          label="YTM min"
          value={minYtm != null ? `${minYtm.toFixed(2)}%` : '—'}
          accent="emerald"
        />
        <MetricCard
          label="YTM max"
          value={maxYtm != null ? `${maxYtm.toFixed(2)}%` : '—'}
          accent="sapphire"
        />
        <MetricCard
          label="Avec YTM calculé"
          value={`${withYtm} / ${active.length}`}
          accent="neutral"
        />
      </div>

      {/* Note sur les obligations amorties (repliée : elle occupait l'en-tête) */}
      <details className="group text-[11px] text-faint leading-relaxed border-l-2 border-border pl-3">
        <summary className="cursor-pointer text-muted hover:text-ivory py-0.5">
          Pourquoi certains rendements sont « N/A » ?
        </summary>
        <p className="mt-1.5">
          <strong className="text-warn">YTM N/A</strong> = obligation à amortissement partiel (prix {`<`} 8 000 FCFA) : le capital remboursé périodiquement rend le calcul YTM non fiable avec nominal 10 000 FCFA.
          Les obligations cotées &quot;Au pair&quot; (cours ≈ 10 000 FCFA) ont un YTM ≈ coupon nominal.
        </p>
      </details>

      {/* Tableau obligations actives */}
      {active.length > 0 ? (
        <PremiumPanel>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <p className="overline text-faint">Obligations actives</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                {active.length} titres · échéance future
              </span>
            </div>
            <ObligationsTable rows={active} title="obligations actives" />
          </div>
        </PremiumPanel>
      ) : (
        <EmptyStatePremium
          icon="◎"
          title="Aucune obligation active"
          hint="Toutes les obligations listées ont une échéance dépassée."
        />
      )}

      {/* Tableau obligations échues (collapsé) */}
      {expired.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-faint hover:text-muted flex items-center gap-2 py-2 list-none">
            <span className="border border-border rounded px-2 py-0.5 group-open:border-accent/30">
              {expired.length} obligations échues : cliquer pour afficher
            </span>
          </summary>
          <div className="mt-3">
            <PremiumPanel>
              <div className="p-5">
                <p className="overline text-faint mb-4">Obligations échues (référence historique)</p>
                <ObligationsTable rows={expired} title="obligations échues" compact />
              </div>
            </PremiumPanel>
          </div>
        </details>
      )}

      <p className="text-[11px] text-faint leading-relaxed border-l-2 border-border pl-3">
        YTM calculé par bisection (hypothèses : nominal 10 000 FCFA, coupon annuel, maturité = 31 déc. de l&apos;année de fin
        extraite de la désignation). Données source : scraper BRVM intraday.
        Fiscalité : coupons des émetteurs souverains (États, BOAD, BIDC) <strong className="text-up">exonérés</strong> de retenue —
        le YTM affiché est donc net. Obligations privées : retenue de 2&nbsp;% (Côte d&apos;Ivoire) à ~6&nbsp;% selon le pays de
        l&apos;émetteur. <a href="/fiscalite" className="text-accent underline underline-offset-2">Barème et sources</a>.
      </p>
    </div>
  );
}

import { createPublicClient } from '@/lib/supabase/public';
import ObligationsTable, { type ObligationRow } from '@/components/ObligationsTable';
import { yieldToMaturity, durations, yearsTo, parseObligationDesignation } from '@/lib/bonds';
import type { ObligationDaily } from '@/lib/types';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  EmptyStatePremium,
  StatPill,
} from '@/components/ui/premium';

export const revalidate = 300;
export const metadata = { title: 'Obligations' };

/**
 * Émetteur souverain / institution régionale → coupons exonérés de retenue
 * (barème lib/tax : États UEMOA, BOAD, BIDC). Détection par code + désignation.
 */
function isEmetteurEtat(code: string, designation: string | null, emetteur: string | null): boolean {
  return /(TPCI|TPBJ|TPBF|TPSN|TPTG|TPNE|TPML|EOM|EOB|EOS|ETAT|TRESOR|TRÉSOR|BOAD|BIDC)/i.test(
    `${code} ${designation ?? ''} ${emetteur ?? ''}`,
  );
}

function toRow(o: ObligationDaily): ObligationRow {
  const parsed = parseObligationDesignation(o.designation);
  const emetteur = o.emetteur ?? parsed.emetteur;
  const tauxPct = o.taux_pct ?? parsed.couponPct;
  const maturite = o.maturite ?? parsed.maturite;
  const years = yearsTo(maturite);

  // Les obligations dont le cours est très inférieur au nominal (< 8 000 FCFA)
  // sont des obligations à amortissement partiel : le YTM calculé avec face=10 000
  // serait trompeur — on le masque.
  const isAmortissable = o.cours_jour != null && o.cours_jour < 8000;

  let ytm: number | null = null;
  let modDur: number | null = null;
  if (!isAmortissable && o.cours_jour != null && tauxPct != null && years != null && years > 0) {
    const inputs = { prix: o.cours_jour, couponRatePct: tauxPct, yearsToMaturity: years, face: 10000 };
    ytm = yieldToMaturity(inputs);
    if (ytm != null && ytm > 0 && ytm < 25) {
      modDur = durations(inputs, ytm)?.modified ?? null;
    } else {
      ytm = null;
    }
  }

  return {
    code: o.code,
    designation: o.designation,
    emetteur,
    taux_pct: tauxPct,
    maturite,
    cours_jour: o.cours_jour,
    volume: o.volume,
    yearsToMaturity: years,
    ytm,
    modifiedDuration: modDur,
    isAmortissable,
    couponExonere: isEmetteurEtat(o.code, o.designation, emetteur),
  };
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
  const rows = obls.map(toRow);

  const active = rows.filter((r) => r.yearsToMaturity != null && r.yearsToMaturity > 0);
  const expired = rows.filter((r) => r.yearsToMaturity == null || r.yearsToMaturity <= 0);

  // YTM moyen sur les obligations actives non-amorties avec YTM plausible
  const ytms = active.map((r) => r.ytm).filter((y): y is number => y != null);
  const avgBondYtm = ytms.length ? ytms.reduce((a, b) => a + b, 0) / ytms.length : null;

  return { lastDate, active, expired, avgBondYtm };
}

export default async function ObligationsPage() {
  const { lastDate, active, expired, avgBondYtm } = await getData();

  if (!lastDate) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <SectionHeader
          kicker="Instruments de taux"
          title="Marché obligataire"
          subtitle="YTM, duration modifiée et courbe des taux — BRVM"
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
        kicker="Instruments de taux"
        title="Marché obligataire"
        subtitle="YTM, duration modifiée — BRVM"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill tone="sapphire">
              Séance <span className="tabular ml-1">{lastDate}</span>
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

      {/* Note sur les obligations amorties */}
      <p className="text-[11px] text-faint leading-relaxed border-l-2 border-[#1a2a30] pl-3">
        <strong className="text-orange-400">YTM N/A</strong> = obligation à amortissement partiel (prix {`<`} 8 000 FCFA) — le capital remboursé périodiquement rend le calcul YTM non fiable avec nominal 10 000 FCFA.
        Les obligations cotées &quot;Au pair&quot; (cours ≈ 10 000 FCFA) ont un YTM ≈ coupon nominal.
      </p>

      {/* Tableau obligations actives */}
      {active.length > 0 ? (
        <PremiumPanel>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <p className="overline text-faint">Obligations actives</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#56D7FD]/10 text-[#56D7FD] border border-[#56D7FD]/20">
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
            <span className="border border-[#1a2a30] rounded px-2 py-0.5 group-open:border-[#56D7FD]/30">
              {expired.length} obligations échues — cliquer pour afficher
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

      <p className="text-[11px] text-faint leading-relaxed border-l-2 border-[#1a2a30] pl-3">
        YTM calculé par bisection (hypothèses : nominal 10 000 FCFA, coupon annuel, maturité = 31 déc. de l&apos;année de fin
        extraite de la désignation). Données source : scraper BRVM intraday.
        Fiscalité : coupons des émetteurs souverains (États, BOAD, BIDC) <strong className="text-up">exonérés</strong> de retenue —
        le YTM affiché est donc net. Obligations privées : retenue de 2&nbsp;% (Côte d&apos;Ivoire) à ~6&nbsp;% selon le pays de
        l&apos;émetteur. <a href="/fiscalite" className="text-accent underline underline-offset-2">Barème et sources</a>.
      </p>
    </div>
  );
}

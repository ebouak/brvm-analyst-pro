import { createPublicClient } from '@/lib/supabase/public';
import ObligationsTable, { type ObligationRow } from '@/components/ObligationsTable';
import { yieldToMaturity, durations, yearsTo, parseObligationDesignation } from '@/lib/bonds';
import type { ObligationDaily } from '@/lib/types';
import { ApercuFrame, ApercuNav } from '@/components/apercu-app/ApercuFrame';
import { SeanceStrip } from '@/components/apercu-app/SeanceStrip';

export const revalidate = 300;
export const metadata = { robots: { index: false, follow: false }, title: 'Aperçu — Obligations (hybride)' };

function isEmetteurEtat(code: string, designation: string | null, emetteur: string | null): boolean {
  return /(TPCI|TPBJ|TPBF|TPSN|TPTG|TPNE|TPML|EOM|EOB|EOS|ETAT|TRESOR|TRÉSOR|BOAD|BIDC)/i.test(`${code} ${designation ?? ''} ${emetteur ?? ''}`);
}
function toRow(o: ObligationDaily): ObligationRow {
  const parsed = parseObligationDesignation(o.designation);
  const emetteur = o.emetteur ?? parsed.emetteur;
  const tauxPct = o.taux_pct ?? parsed.couponPct;
  const maturite = o.maturite ?? parsed.maturite;
  const years = yearsTo(maturite);
  const isAmortissable = o.cours_jour != null && o.cours_jour < 8000;
  let ytm: number | null = null; let modDur: number | null = null;
  if (!isAmortissable && o.cours_jour != null && tauxPct != null && years != null && years > 0) {
    const inputs = { prix: o.cours_jour, couponRatePct: tauxPct, yearsToMaturity: years, face: 10000 };
    ytm = yieldToMaturity(inputs);
    if (ytm != null && ytm > 0 && ytm < 25) modDur = durations(inputs, ytm)?.modified ?? null; else ytm = null;
  }
  return { code: o.code, designation: o.designation, emetteur, taux_pct: tauxPct, maturite, cours_jour: o.cours_jour, volume: o.volume, yearsToMaturity: years, ytm, modifiedDuration: modDur, isAmortissable, couponExonere: isEmetteurEtat(o.code, o.designation, emetteur) };
}

async function getData() {
  const supabase = createPublicClient();
  const { data: lastRow } = await supabase.from('brvm_obligations_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, active: [] as ObligationRow[], expired: [] as ObligationRow[] };
  const { data } = await supabase.from('brvm_obligations_daily').select('*').eq('date_marche', lastDate);
  const rows = ((data ?? []) as ObligationDaily[]).map(toRow);
  return { lastDate, active: rows.filter((r) => r.yearsToMaturity != null && r.yearsToMaturity > 0), expired: rows.filter((r) => r.yearsToMaturity == null || r.yearsToMaturity <= 0) };
}

export default async function ApercuObligationsPage() {
  const { lastDate, active, expired } = await getData();
  return (
    <ApercuFrame title="Aperçu — Obligations" subtitle="YTM par bisection — même table que prod, noindex.">
      <ApercuNav />
      <SeanceStrip asOf={lastDate} nbActions={active.length} href="/apercu/obligations" />
      <p style={{ fontSize: 11, color: 'rgb(var(--color-faint))' }}>Preview lecture seule. <a href="/obligations" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Ouvrir prod</a></p>
      <div style={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: 14, padding: 12 }}>
        {active.length ? <ObligationsTable rows={active} title="obligations actives (aperçu)" /> : <p style={{ color: 'rgb(var(--color-muted))', fontSize: 13 }}>Aucune obligation active.</p>}
      </div>
      {expired.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgb(var(--color-muted))' }}>{expired.length} échues — afficher</summary>
          <div style={{ marginTop: 10, background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: 14, padding: 12 }}>
            <ObligationsTable rows={expired} title="obligations échues (aperçu)" compact />
          </div>
        </details>
      )}
    </ApercuFrame>
  );
}

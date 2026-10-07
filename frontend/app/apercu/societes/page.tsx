import { createPublicClient } from '@/lib/supabase/public';
import CompaniesExplorer, { type CompanyCard } from '@/components/public/CompaniesExplorer';
import { ApercuFrame, ApercuNav } from '@/components/apercu-app/ApercuFrame';
import { SeanceStrip } from '@/components/apercu-app/SeanceStrip';

export const revalidate = 900;
export const metadata = { robots: { index: false, follow: false }, title: 'Aperçu — Sociétés (hybride)' };

async function getCompanies(): Promise<{ companies: CompanyCard[]; asOf: string | null }> {
  const supabase = createPublicClient();
  const [{ data: instruments }, { data: lastQuotes }, { data: signals }] = await Promise.all([
    supabase.from('brvm_instruments').select('code, designation, secteur, pays').eq('type', 'action').eq('actif', true).order('code'),
    supabase.from('brvm_actions_daily').select('code, cours_jour, variation_pct, date_marche').order('date_marche', { ascending: false }).limit(200),
    supabase.from('signals_daily').select('code, score_total, confiance, date_marche').order('date_marche', { ascending: false }).limit(200),
  ]);
  const quoteByCode = new Map<string, { cours_jour: number | null; variation_pct: number | null; date_marche: string }>();
  for (const q of lastQuotes ?? []) if (!quoteByCode.has(q.code)) quoteByCode.set(q.code, q as never);
  const signalByCode = new Map<string, { score_total: number; confiance: number | null }>();
  for (const s of signals ?? []) if (!signalByCode.has(s.code)) signalByCode.set(s.code, s as never);
  const companies: CompanyCard[] = (instruments ?? []).map((i) => ({
    code: i.code as string, designation: i.designation as string, secteur: (i.secteur as string | null) ?? null, pays: (i.pays as string | null) ?? null,
    cours: quoteByCode.get(i.code)?.cours_jour ?? null, variation_pct: quoteByCode.get(i.code)?.variation_pct ?? null,
    score_total: signalByCode.get(i.code)?.score_total ?? null, confiance: signalByCode.get(i.code)?.confiance ?? null,
  }));
  const asOf = (lastQuotes?.[0] as { date_marche?: string } | undefined)?.date_marche ?? null;
  return { companies, asOf };
}

export default async function ApercuSocietesPage() {
  const { companies, asOf } = await getCompanies();
  return (
    <ApercuFrame title="Aperçu — Sociétés" subtitle="Annuaire BRVM — même explorer que prod, isolé sous .apv (noindex).">
      <ApercuNav />
      <SeanceStrip asOf={asOf} nbActions={companies.length} href="/apercu/societes" />
      <p style={{ fontSize: 11, color: 'rgb(var(--color-faint))' }}>Grille sombre hybride. <a href="/societes" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Ouvrir prod</a></p>
      <div style={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: 14, padding: 12 }}>
        {companies.length === 0 ? <p style={{ color: 'rgb(var(--color-muted))', fontSize: 13 }}>Annuaire vide.</p> : <CompaniesExplorer companies={companies} />}
      </div>
    </ApercuFrame>
  );
}

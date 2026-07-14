import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import CompaniesExplorer, { type CompanyCard } from '@/components/public/CompaniesExplorer';

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Les 48 sociétés cotées à la BRVM — Cours, notes et analyses',
  description:
    'Annuaire complet des sociétés cotées à la Bourse Régionale des Valeurs Mobilières (BRVM) : cours en quasi temps réel, note BRVM A–F, secteur et pays. Analyse gratuite.',
  alternates: { canonical: `${SITE_URL}/societes` },
};

async function getCompanies(): Promise<CompanyCard[]> {
  const supabase = createPublicClient();

  const [{ data: instruments }, { data: lastQuotes }, { data: signals }] = await Promise.all([
    supabase
      .from('brvm_instruments')
      .select('code, designation, secteur, pays')
      .eq('type', 'action')
      .eq('actif', true)
      .order('code'),
    supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, variation_pct, date_marche')
      .order('date_marche', { ascending: false })
      .limit(200),
    supabase
      .from('signals_daily')
      .select('code, score_total, confiance, date_marche')
      .order('date_marche', { ascending: false })
      .limit(200),
  ]);

  // Dernière cotation / dernier signal par code (requêtes triées par date desc)
  const quoteByCode = new Map<string, { cours_jour: number | null; variation_pct: number | null }>();
  for (const q of lastQuotes ?? []) {
    if (!quoteByCode.has(q.code)) quoteByCode.set(q.code, q);
  }
  const signalByCode = new Map<string, { score_total: number; confiance: number | null }>();
  for (const s of signals ?? []) {
    if (!signalByCode.has(s.code)) signalByCode.set(s.code, s);
  }

  return (instruments ?? []).map((i) => ({
    code: i.code as string,
    designation: i.designation as string,
    secteur: (i.secteur as string | null) ?? null,
    pays: (i.pays as string | null) ?? null,
    cours: quoteByCode.get(i.code)?.cours_jour ?? null,
    variation_pct: quoteByCode.get(i.code)?.variation_pct ?? null,
    score_total: signalByCode.get(i.code)?.score_total ?? null,
    confiance: signalByCode.get(i.code)?.confiance ?? null,
  }));
}

export default async function CompaniesIndexPage() {
  const companies = await getCompanies();

  return (
    <PublicShell>
      <div className="mb-8">
        <p className="text-[11px] text-accent/70 uppercase tracking-[0.18em] mb-1">Marché actions BRVM</p>
        <h1 className="font-display text-2xl md:text-3xl text-white mb-2">
          Les sociétés cotées à la BRVM
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          Cours en quasi temps réel, note BRVM et fiche d&apos;analyse gratuite pour chaque société cotée à la
          Bourse Régionale des Valeurs Mobilières (UEMOA).
        </p>
      </div>

      {companies.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">Annuaire en cours de constitution.</p>
        </div>
      ) : (
        <CompaniesExplorer companies={companies} />
      )}
    </PublicShell>
  );
}

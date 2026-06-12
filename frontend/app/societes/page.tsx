import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import RatingBadge from '@/components/RatingBadge';
import { fmtNumber } from '@/lib/format';

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';

export const metadata: Metadata = {
  title: 'Les 48 sociétés cotées à la BRVM — Cours, notes et analyses | BRVM Analyst Pro',
  description:
    'Annuaire complet des sociétés cotées à la Bourse Régionale des Valeurs Mobilières (BRVM) : cours en quasi temps réel, note BRVM A–F, secteur et pays. Analyse gratuite.',
  alternates: { canonical: `${SITE_URL}/societes` },
};

async function getCompanies() {
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

  // Dernière cotation / dernier signal par code (les requêtes sont triées par date desc)
  const quoteByCode = new Map<string, { cours_jour: number | null; variation_pct: number | null }>();
  for (const q of lastQuotes ?? []) {
    if (!quoteByCode.has(q.code)) quoteByCode.set(q.code, q);
  }
  const signalByCode = new Map<string, { score_total: number; confiance: number | null }>();
  for (const s of signals ?? []) {
    if (!signalByCode.has(s.code)) signalByCode.set(s.code, s);
  }

  return { instruments: instruments ?? [], quoteByCode, signalByCode };
}

export default async function CompaniesIndexPage() {
  const { instruments, quoteByCode, signalByCode } = await getCompanies();

  // Regroupement par secteur pour le maillage interne et la lisibilité
  const bySector = new Map<string, typeof instruments>();
  for (const instr of instruments) {
    const key = instr.secteur ?? 'Autres';
    if (!bySector.has(key)) bySector.set(key, []);
    bySector.get(key)!.push(instr);
  }

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

      {instruments.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-muted text-sm">Annuaire en cours de constitution.</p>
        </div>
      ) : (
        [...bySector.entries()].map(([sector, list]) => (
          <section key={sector} className="mb-8">
            <h2 className="text-sm text-muted uppercase tracking-wide mb-3">{sector}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((instr) => {
                const quote = quoteByCode.get(instr.code);
                const sig = signalByCode.get(instr.code);
                const positive = (quote?.variation_pct ?? 0) >= 0;
                return (
                  <Link
                    key={instr.code}
                    href={`/societes/${instr.code}`}
                    className="bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-accent transition-colors">
                          {instr.designation}
                        </p>
                        <p className="text-[11px] text-faint">{instr.code} · {instr.pays ?? 'UEMOA'}</p>
                      </div>
                      <RatingBadge scoreTotal={sig?.score_total} confiance={sig?.confiance} />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="tabular text-lg text-white">{fmtNumber(quote?.cours_jour)} <span className="text-[11px] text-faint">FCFA</span></span>
                      {quote?.variation_pct != null && (
                        <span className={`tabular text-xs font-medium ${positive ? 'text-up' : 'text-down'}`}>
                          {positive ? '+' : ''}{fmtNumber(quote.variation_pct, 2)} %
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </PublicShell>
  );
}

import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { getRevue } from '@/lib/reports/server';
import { parseBlocks, summarizeMarket, type BlockKey } from '@/lib/reports/builder';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import PrintButton from '@/components/reports/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapport' };

const pct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`);

/* ── Données par bloc (séparées, testables individuellement) ─────────────── */

async function marketBlock() {
  const sb = createPublicClient();
  const { data: lastRow } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche;
  if (!lastDate) return null;
  const [{ data: rows }, { data: idx }] = await Promise.all([
    sb.from('brvm_actions_daily').select('code, variation_pct').eq('date_marche', lastDate),
    sb.from('brvm_indices_daily').select('libelle, valeur, variation_pct').eq('date_marche', lastDate).order('libelle', { ascending: true }),
  ]);
  const summary = summarizeMarket((rows ?? []) as { code: string; variation_pct: number | null }[]);
  const composite = (idx ?? []).find((i: { libelle: string | null }) => /composite/i.test(i.libelle ?? '')) ?? (idx ?? [])[0] ?? null;
  return { lastDate, summary, composite };
}

async function sectorBlock(secteur: string) {
  const sb = createPublicClient();
  const { data: lastRow } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche;
  if (!lastDate) return null;
  const [{ data: rows }, { data: instruments }] = await Promise.all([
    sb.from('brvm_actions_daily').select('code, variation_pct').eq('date_marche', lastDate),
    sb.from('brvm_instruments').select('code, secteur').eq('secteur', secteur),
  ]);
  const codes = new Set((instruments ?? []).map((i: { code: string }) => i.code));
  const inSector = ((rows ?? []) as { code: string; variation_pct: number | null }[]).filter((r) => codes.has(r.code) && r.variation_pct != null);
  if (inSector.length === 0) return { secteur, avg: null, n: 0, best: null, worst: null };
  const s = summarizeMarket(inSector);
  const avg = inSector.reduce((a, r) => a + (r.variation_pct ?? 0), 0) / inSector.length;
  return { secteur, avg, n: inSector.length, best: s.topHausse, worst: s.topBaisse };
}

async function portfolioBlock() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { needsAuth: true as const };
  const { data: positions } = await sb.from('portfolios_positions').select('code, quantite, prix_entree').eq('user_id', user.id);
  if (!positions || positions.length === 0) return { needsAuth: false as const, lines: [] };
  const pub = createPublicClient();
  const codes = Array.from(new Set(positions.map((p: { code: string }) => p.code)));
  const { data: prices } = await pub.from('brvm_actions_daily').select('code, cours_jour, date_marche').in('code', codes).order('date_marche', { ascending: false });
  const latest = new Map<string, number>();
  for (const r of (prices ?? []) as { code: string; cours_jour: number | null }[]) if (!latest.has(r.code) && r.cours_jour != null) latest.set(r.code, r.cours_jour);
  const lines = (positions as { code: string; quantite: number; prix_entree: number }[]).map((p) => {
    const cours = latest.get(p.code) ?? null;
    const valeur = cours != null ? cours * p.quantite : null;
    const pnl = cours != null ? (cours - p.prix_entree) * p.quantite : null;
    return { code: p.code, quantite: p.quantite, pru: p.prix_entree, cours, valeur, pnl };
  });
  return { needsAuth: false as const, lines };
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default async function ReportPrintPage({ searchParams }: { searchParams: { blocs?: string; code?: string; secteur?: string } }) {
  const blocks = parseBlocks(searchParams.blocs);
  const code = searchParams.code?.toUpperCase();
  const secteur = searchParams.secteur;

  const [market, action, sector, portfolio] = await Promise.all([
    blocks.includes('marche') ? marketBlock() : Promise.resolve(null),
    blocks.includes('action') && code ? getRevue(code) : Promise.resolve(null),
    blocks.includes('secteur') && secteur ? sectorBlock(secteur) : Promise.resolve(null),
    blocks.includes('portefeuille') ? portfolioBlock() : Promise.resolve(null),
  ]);

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  if (blocks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <p className="text-sm text-muted">Aucun bloc sélectionné.</p>
        <Link href="/rapports/builder" className="mt-2 inline-block text-sm text-accent hover:underline">← Retour au constructeur</Link>
      </div>
    );
  }

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mt-6 mb-2 border-b border-neutral-300 pb-1 text-[13px] font-bold uppercase tracking-wide text-neutral-800">{children}</h2>
  );
  const Row = ({ l, r }: { l: string; r: React.ReactNode }) => (
    <div className="flex justify-between border-b border-neutral-100 py-1 text-[12px]"><span className="text-neutral-500">{l}</span><span className="font-medium text-neutral-900">{r}</span></div>
  );

  return (
    <div className="min-h-screen bg-neutral-200 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[800px] items-center justify-between px-4 print:hidden">
        <Link href="/rapports/builder" className="text-sm text-neutral-600 hover:underline">← Modifier</Link>
        <PrintButton />
      </div>

      {/* Feuille A4 blanche */}
      <article className="mx-auto max-w-[800px] bg-white px-12 py-10 font-serif text-neutral-900 shadow-xl print:max-w-none print:shadow-none print:px-0">
        <header className="flex items-end justify-between border-b-2 border-neutral-900 pb-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-400">WESTBOURSE · Rapport sur mesure</div>
            <div className="text-2xl font-bold">Rapport — {today}</div>
          </div>
          <div className="text-right text-[10px] text-neutral-400">Généré le {today}<br />BRVM · UEMOA</div>
        </header>

        {/* Bloc marché */}
        {market && (
          <section>
            <H>Synthèse marché du jour</H>
            {market.composite && <Row l={market.composite.libelle ?? 'Indice composite'} r={<>{fmtNumber(market.composite.valeur, 2)} <span className={(market.composite.variation_pct ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>({pct(market.composite.variation_pct)})</span></>} />}
            <Row l="Hausses / Baisses / Inchangés" r={`${market.summary.hausses} / ${market.summary.baisses} / ${market.summary.inchanges}`} />
            <Row l="Breadth (part de hausses)" r={market.summary.breadthPct == null ? '—' : `${market.summary.breadthPct}%`} />
            {market.summary.topHausse && <Row l="Plus forte hausse" r={`${market.summary.topHausse.code} ${pct(market.summary.topHausse.pct)}`} />}
            {market.summary.topBaisse && <Row l="Plus forte baisse" r={`${market.summary.topBaisse.code} ${pct(market.summary.topBaisse.pct)}`} />}
            <p className="mt-1 text-[10px] text-neutral-400">Séance du {market.lastDate}.</p>
          </section>
        )}

        {/* Bloc action */}
        {blocks.includes('action') && (
          <section>
            <H>Action — {action ? `${action.designation} (${action.code})` : code}</H>
            {action ? (
              <>
                <Row l="Secteur · Pays" r={`${action.secteur || '—'} · ${action.pays || '—'}`} />
                <Row l="Cours" r={action.price?.cours != null ? fmtFcfa(action.price.cours) : '—'} />
                <Row l="PER · Rendement" r={`${action.ratios.per != null ? action.ratios.per.toFixed(1) + 'x' : '—'} · ${action.ratios.yieldPct != null ? action.ratios.yieldPct.toFixed(1) + '%' : '—'}`} />
                {action.latest && <Row l={`Revenu (${action.latest.periode})`} r={action.latest.revenu != null ? fmtFcfa(action.latest.revenu) : '—'} />}
                {action.latest && <Row l={`Résultat net (${action.latest.periode})`} r={action.latest.resultatNet != null ? fmtFcfa(action.latest.resultatNet) : '—'} />}
                {action.ratios.margeNette != null && <Row l="Marge nette" r={`${action.ratios.margeNette.toFixed(1)}%`} />}
              </>
            ) : <p className="text-[12px] text-neutral-500">Données indisponibles pour cette action.</p>}
          </section>
        )}

        {/* Bloc secteur */}
        {sector && (
          <section>
            <H>Secteur — {sector.secteur}</H>
            {sector.n === 0 ? (
              <p className="text-[12px] text-neutral-500">Aucune donnée de séance pour ce secteur.</p>
            ) : (
              <p className="text-[12px] text-neutral-700">
                Performance moyenne du jour <b className={(sector.avg ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>{pct(sector.avg)}</b> sur {sector.n} titre{sector.n > 1 ? 's' : ''}.
                {sector.best && <> Meilleur : <b>{sector.best.code}</b> {pct(sector.best.pct)}.</>}
                {sector.worst && <> Pire : <b>{sector.worst.code}</b> {pct(sector.worst.pct)}.</>}
              </p>
            )}
          </section>
        )}

        {/* Bloc portefeuille */}
        {portfolio && (
          <section>
            <H>Mon portefeuille</H>
            {portfolio.needsAuth ? (
              <p className="text-[12px] text-neutral-500">Connectez-vous pour inclure votre portefeuille.</p>
            ) : portfolio.lines.length === 0 ? (
              <p className="text-[12px] text-neutral-500">Aucune position enregistrée.</p>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead><tr className="border-b border-neutral-300 text-left text-neutral-500">
                  <th className="py-1">Titre</th><th className="text-right">Qté</th><th className="text-right">PRU</th><th className="text-right">Cours</th><th className="text-right">Valeur</th><th className="text-right">P&L latent</th>
                </tr></thead>
                <tbody>
                  {portfolio.lines.map((l) => (
                    <tr key={l.code} className="border-b border-neutral-100">
                      <td className="py-1 font-medium">{l.code}</td>
                      <td className="text-right">{fmtNumber(l.quantite)}</td>
                      <td className="text-right">{fmtFcfa(l.pru)}</td>
                      <td className="text-right">{l.cours != null ? fmtFcfa(l.cours) : '—'}</td>
                      <td className="text-right">{l.valeur != null ? fmtFcfa(l.valeur) : '—'}</td>
                      <td className={`text-right font-medium ${(l.pnl ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{l.pnl != null ? fmtFcfa(l.pnl) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <footer className="mt-8 border-t border-neutral-200 pt-2 text-[9px] italic text-neutral-400">
          Données réelles WESTBOURSE — à titre informatif, ne constitue pas un conseil en investissement.
        </footer>
      </article>
    </div>
  );
}

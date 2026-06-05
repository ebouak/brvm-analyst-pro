import { createClient } from '@/lib/supabase/server';
import { aggregateBySector } from '@/lib/sectors';
import SectorCard from '@/components/SectorCard';
import SectorRankingTable from '@/components/SectorRankingTable';
import SectorRotation from '@/components/SectorRotation';
import { fmtDateFR } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Secteurs — BRVM Analyst Pro' };

async function getData() {
  const supabase = createClient();

  // Dernière date disponible
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, perfs: [] };

  // 1 an d'historique
  const oneYearAgo = new Date(lastDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const fromDate = oneYearAgo.toISOString().slice(0, 10);

  const [{ data: rows }, { data: instruments }] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('code, secteur, date_marche, cours_jour, variation_pct, valeur_echangee')
      .gte('date_marche', fromDate)
      .order('date_marche', { ascending: true }),
    supabase.from('brvm_instruments').select('code, secteur'),
  ]);

  // Le secteur de brvm_actions_daily est rarement renseigné : on le complète
  // depuis le référentiel brvm_instruments (source de vérité des secteurs).
  const sectorByCode: Record<string, string | null> = {};
  for (const i of (instruments ?? []) as { code: string; secteur: string | null }[]) {
    sectorByCode[i.code] = i.secteur;
  }
  const enriched = (rows ?? []).map((r) => ({
    ...r,
    secteur: r.secteur ?? sectorByCode[r.code] ?? null,
  }));

  const perfs = aggregateBySector(enriched, lastDate);

  return { lastDate, perfs };
}

export default async function SecteursPage() {
  const { lastDate, perfs } = await getData();

  const top4 = perfs.slice(0, 4);

  return (
    <div className="min-h-screen p-6 space-y-8" style={{ background: '#0f1117', color: '#e6e9f0' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#e6e9f0]">
          Performance sectorielle
        </h1>
        <p className="text-sm text-[#8b93a7] mt-1">
          Analyse de la performance par secteur sur la BRVM
          {lastDate && (
            <> · Dernière séance&nbsp;: <span className="text-[#e6e9f0]">{fmtDateFR(lastDate)}</span></>
          )}
        </p>
      </div>

      {perfs.length === 0 ? (
        <div
          className="rounded-lg p-12 text-center text-[#8b93a7]"
          style={{ background: '#161922', border: '1px solid #232733' }}
        >
          Aucune donnée sectorielle disponible pour le moment.
        </div>
      ) : (
        <>
          {/* Section 1 : Top 4 cards */}
          <section>
            <h2 className="text-base font-semibold text-[#e6e9f0] mb-3">
              Meilleurs secteurs du jour
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {top4.map((p) => (
                <SectorCard key={p.secteur} perf={p} />
              ))}
            </div>
          </section>

          {/* Section 2 : Tableau ranking */}
          <section>
            <h2 className="text-base font-semibold text-[#e6e9f0] mb-3">
              Classement complet
            </h2>
            <SectorRankingTable perfs={perfs} />
          </section>

          {/* Section 3 : Rotation sectorielle */}
          <section>
            <h2 className="text-base font-semibold text-[#e6e9f0] mb-3">
              Graphique de rotation sectorielle
            </h2>
            <SectorRotation perfs={perfs} />
          </section>
        </>
      )}
    </div>
  );
}

import { createClient } from '@/lib/supabase/server';
import { aggregateBySector } from '@/lib/sectors';
import SectorCard from '@/components/SectorCard';
import SectorRankingTable from '@/components/SectorRankingTable';
import SectorRotation from '@/components/SectorRotation';
import { fmtDateFR } from '@/lib/format';
import {
  SectionHeader,
  PremiumPanel,
  EmptyStatePremium,
  Eyebrow,
} from '@/components/ui/premium';

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

/* Stagger delays for card grid — static Tailwind-safe classes */
const CARD_DELAYS = [
  '[animation-delay:0.12s]',
  '[animation-delay:0.18s]',
  '[animation-delay:0.24s]',
  '[animation-delay:0.30s]',
];

export default async function SecteursPage() {
  const { lastDate, perfs } = await getData();

  const top4 = perfs.slice(0, 4);

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Glow atmosphérique ─────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 bg-obsidian-glow" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* ── En-tête ─────────────────────────────────────────────────────── */}
        <div className="animate-rise-in">
          <SectionHeader
            kicker="BRVM · Analyse sectorielle"
            title="Performance sectorielle"
            subtitle={
              lastDate
                ? `Classement et rotation des secteurs cotés — Dernière séance : ${fmtDateFR(lastDate)}`
                : 'Classement et rotation des secteurs cotés sur la BRVM'
            }
          />
          {/* Règle dorée ────────────────────────── */}
          <div className="mt-5 h-px bg-gold-line" />
        </div>

        {perfs.length === 0 ? (
          <div className="animate-rise-in [animation-delay:0.10s]">
            <EmptyStatePremium
              icon="◈"
              title="Aucune donnée sectorielle disponible"
              hint="Les données sectorielles apparaîtront ici dès la première ingestion."
              action={{ href: '/', label: 'Retour au tableau de bord' }}
            />
          </div>
        ) : (
          <>
            {/* ── Section 1 : Top secteurs du jour ─────────────────────────── */}
            <section className="animate-rise-in [animation-delay:0.08s] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Eyebrow>Meilleurs secteurs</Eyebrow>
                  <h2 className="font-display text-heading-sm text-ivory mt-1">
                    Secteurs en tête du jour
                  </h2>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-faint">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-up/60" />
                    Hausse
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-down/60" />
                    Baisse
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {top4.map((p, i) => (
                  <div
                    key={p.secteur}
                    className={`animate-rise-in ${CARD_DELAYS[i] ?? CARD_DELAYS[3]}`}
                  >
                    <SectorCard perf={p} />
                  </div>
                ))}
              </div>
            </section>

            {/* ── Section 2 : Classement complet ───────────────────────────── */}
            <section className="animate-rise-in [animation-delay:0.28s] space-y-4">
              <div>
                <Eyebrow>Classement complet</Eyebrow>
                <h2 className="font-display text-heading-sm text-ivory mt-1">
                  Tableau de performance multi-horizon
                </h2>
              </div>

              <PremiumPanel>
                <div className="p-1">
                  <SectorRankingTable perfs={perfs} />
                </div>
              </PremiumPanel>
            </section>

            {/* ── Section 3 : Rotation sectorielle ─────────────────────────── */}
            <section className="animate-rise-in [animation-delay:0.36s] space-y-4">
              <div>
                <Eyebrow>Analyse dynamique</Eyebrow>
                <h2 className="font-display text-heading-sm text-ivory mt-1">
                  Rotation sectorielle — 30 jours
                </h2>
              </div>

              <PremiumPanel glow>
                <div className="p-4">
                  <SectorRotation perfs={perfs} />
                </div>
              </PremiumPanel>
            </section>
          </>
        )}

        {/* ── Pied de page discret ─────────────────────────────────────────── */}
        <footer className="pt-4 pb-6 flex items-center justify-between border-t border-border text-xs text-faint">
          <span>BRVM Analyst Pro</span>
          {lastDate && (
            <span>
              Données au{' '}
              <span className="text-muted">{fmtDateFR(lastDate)}</span>
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}

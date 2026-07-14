import { createPublicClient } from '@/lib/supabase/public';
import { aggregateBySector } from '@/lib/sectors';
import SectorsExport from '@/components/SectorsExport';
import SectorCard from '@/components/SectorCard';
import SectorRankingTable from '@/components/SectorRankingTable';
import SectorRotation from '@/components/SectorRotation';
import NewsletterForm from '@/components/NewsletterForm';
import { fmtDateFR } from '@/lib/format';
import Link from 'next/link';
import {
  SectionHeader,
  PremiumPanel,
  EmptyStatePremium,
  Eyebrow,
} from '@/components/ui/premium';

// Donnees marche publiques (RLS lecture publique), rafraichies toutes les 15 min
// par l'intraday : ISR 5 min (audit 2026-06-12).
export const revalidate = 300;
export const metadata = { title: 'Secteurs' };

interface ActionRow {
  code: string; secteur: string | null; date_marche: string;
  cours_jour: number | null; variation_pct: number | null; valeur_echangee: number | null;
}

/** Récupère toutes les lignes depuis `fromDate` en paginant (plafond 1000/req). */
async function fetchAllActionsSince(
  supabase: ReturnType<typeof createPublicClient>,
  fromDate: string,
): Promise<ActionRow[]> {
  const PAGE = 1000;
  const all: ActionRow[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data } = await supabase
      .from('brvm_actions_daily')
      .select('code, secteur, date_marche, cours_jour, variation_pct, valeur_echangee')
      .gte('date_marche', fromDate)
      .order('date_marche', { ascending: true })
      .range(from, from + PAGE - 1);
    const batch = (data ?? []) as ActionRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

async function getData() {
  const supabase = createPublicClient();

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

  // ⚠️ PostgREST plafonne à 1000 lignes/réponse. Sur 1 an × ~47 actions (~12k
  // lignes), un fetch unique trié ASC ne renvoyait que le 1er mois → la dernière
  // séance était tronquée → 0 hausse / 0 baisse / Vol 0. On pagine via .range().
  const [rows, { data: instruments }] = await Promise.all([
    fetchAllActionsSince(supabase, fromDate),
    supabase.from('brvm_instruments').select('code, secteur'),
  ]);

  // Le secteur de brvm_actions_daily est rarement renseigné : on le complète
  // depuis le référentiel brvm_instruments (source de vérité des secteurs).
  const sectorByCode: Record<string, string | null> = {};
  for (const i of (instruments ?? []) as { code: string; secteur: string | null }[]) {
    sectorByCode[i.code] = i.secteur;
  }
  const enriched = rows.map((r) => ({
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
  const best = perfs[0] ?? null;
  const worst = perfs[perfs.length - 1] ?? null;

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

        {perfs.length > 0 && (
          <div className="flex justify-end -mt-4">
            <SectorsExport rows={perfs} />
          </div>
        )}

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
                <div className="hidden sm:flex items-center gap-4 text-xs">
                  {best && best.varDay != null && (
                    <span className="flex items-center gap-1.5 text-up">
                      <span className="inline-block w-2 h-2 rounded-full bg-up/60" />
                      Meilleur : <strong>{best.secteur}</strong>
                      <span className="tabular">+{best.varDay.toFixed(2)}%</span>
                    </span>
                  )}
                  {worst && worst.varDay != null && worst.secteur !== best?.secteur && (
                    <span className="flex items-center gap-1.5 text-down">
                      <span className="inline-block w-2 h-2 rounded-full bg-down/60" />
                      Pire : <strong>{worst.secteur}</strong>
                      <span className="tabular">{worst.varDay.toFixed(2)}%</span>
                    </span>
                  )}
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

        {/* ── Lien heatmap ────────────────────────────────────────────────── */}
        <div className="animate-rise-in [animation-delay:0.42s] flex items-center justify-between rounded-xl border border-border/50 bg-elevated/30 px-5 py-3.5">
          <div>
            <p className="text-sm font-medium text-ivory">Voir la cartographie visuelle</p>
            <p className="text-xs text-muted">Heatmap — taille proportionnelle à la capitalisation, couleur = variation</p>
          </div>
          <Link
            href="/heatmap"
            className="shrink-0 rounded-lg border border-gold/30 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/10 transition-colors"
          >
            Ouvrir la heatmap →
          </Link>
        </div>

        {/* ── Newsletter ───────────────────────────────────────────────────── */}
        <div className="animate-rise-in [animation-delay:0.46s]">
          <NewsletterForm source="secteurs" />
        </div>

        {/* ── Pied de page discret ─────────────────────────────────────────── */}
        <footer className="pt-4 pb-6 flex items-center justify-between border-t border-border text-xs text-faint">
          <span>WESTBOURSE</span>
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

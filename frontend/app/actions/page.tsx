import { createPublicClient } from '@/lib/supabase/public';
import ActionsTable from '@/components/ActionsTable';
import brvmSectors from '@/lib/brvmSectors.json';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { SectionHeader, EmptyStatePremium, PremiumPanel, StatPill, PremiumCTA } from '@/components/ui/premium';

// Donnees marche publiques (RLS lecture publique), rafraichies toutes les 15 min
// par l'intraday : ISR 5 min (audit 2026-06-12).
export const revalidate = 300;
export const metadata = { title: 'Marché Actions' };

async function getData() {
  const supabase = createPublicClient();
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, actions: [] as ActionDaily[], signals: {} as Record<string, SignalDaily>, sparklines: {} as Record<string, number[]> };

  const [{ data: actions }, { data: signals }, { data: instruments }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
    supabase.from('brvm_instruments').select('code, secteur, pays').eq('type', 'action'),
  ]);

  // Secteur : classification fiable brvmSectors.json (GICS par ticker, comme la
  // heatmap) en priorité, car brvm_instruments.secteur est quasi vide (1/48).
  const sectorByCode = brvmSectors as Record<string, string>;
  const instrMap: Record<string, { secteur: string | null; pays: string | null }> = {};
  for (const i of (instruments ?? []) as { code: string; secteur: string | null; pays: string | null }[]) {
    instrMap[i.code] = { secteur: i.secteur, pays: i.pays };
  }
  const enrichedActions = ((actions ?? []) as ActionDaily[]).map((a) => ({
    ...a,
    secteur: sectorByCode[a.code] ?? instrMap[a.code]?.secteur ?? a.secteur ?? null,
    pays: instrMap[a.code]?.pays ?? a.pays ?? null,
  }));

  const sigMap: Record<string, SignalDaily> = {};
  for (const s of (signals ?? []) as SignalDaily[]) sigMap[s.code] = s;

  // ── Sparklines : ~30 dernières séances de cours par titre (colonne Tendance 30j) ──
  const since = new Date(lastDate);
  since.setDate(since.getDate() - 50);
  const sinceIso = since.toISOString().slice(0, 10);
  const { data: hist } = await supabase
    .from('brvm_actions_daily')
    .select('code, date_marche, cours_jour')
    .gte('date_marche', sinceIso)
    .lte('date_marche', lastDate)
    .order('date_marche', { ascending: true });
  const sparklines: Record<string, number[]> = {};
  for (const r of (hist ?? []) as { code: string; cours_jour: number | null }[]) {
    if (r.cours_jour == null) continue;
    (sparklines[r.code] ??= []).push(r.cours_jour);
  }
  for (const k of Object.keys(sparklines)) sparklines[k] = sparklines[k]!.slice(-30);

  return {
    lastDate,
    actions: enrichedActions,
    signals: sigMap,
    sparklines,
  };
}

export default async function ActionsPage() {
  const { lastDate, actions, signals, sparklines } = await getData();

  if (!lastDate) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <SectionHeader
          kicker="BRVM · Cote officielle"
          title="Marché Actions"
          subtitle="Tableau de bord des valeurs cotées sur la Bourse Régionale des Valeurs Mobilières."
        />
        <div className="mt-10">
          <EmptyStatePremium
            title="Aucune séance disponible"
            hint="Lancez le scraper pour alimenter la base de données."
            icon="◈"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <SectionHeader
        kicker="BRVM · Cote officielle"
        title="Marché Actions"
        subtitle="Toutes les valeurs cotées — cours, volumes, performances et signaux assistés."
        actions={
          <>
            <div className="flex items-center gap-2">
              <StatPill tone="neutral">
                <span className="tabular">{actions.length}</span>&nbsp;titres
              </StatPill>
              <StatPill tone="gold">
                Séance&nbsp;<span className="tabular">{lastDate}</span>
              </StatPill>
            </div>
            <PremiumCTA href="/actions/compare" variant="ghost">
              Comparer des titres
            </PremiumCTA>
          </>
        }
      />

      {/* ── Filet doré de séparation ────────────────────────────────────── */}
      <div className="gold-rule" />

      {/* ── Tableau principal (avec colonne Tendance 30j) ───────────────── */}
      <PremiumPanel>
        <ActionsTable actions={actions} signals={signals} sparklines={sparklines} />
      </PremiumPanel>
    </div>
  );
}

import { createPublicClient } from '@/lib/supabase/public';
import { fetchAllRows } from '@/lib/supabase/paginate';
import ActionsTable from '@/components/ActionsTable';
import brvmSectors from '@/lib/brvmSectors.json';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { SectionHeader, EmptyStatePremium, PremiumPanel, StatPill, PremiumCTA } from '@/components/ui/premium';
import { canAccess } from '@/lib/server/featureAccess';

// Les COURS restent publics. Seules les colonnes CALCULÉES (Tendance 30 j, Signal)
// sont soumises au flag `actions_metrics`. Rendu dynamique : le contenu dépend
// désormais de l'utilisateur, un cache partagé servirait la version premium à tous.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marché Actions' };

/**
 * `withMetrics` : charge-t-on les colonnes CALCULÉES (signaux, tendance 30 j) ?
 *
 * Quand l'accès est refusé, on ne les interroge même PAS. Le verrou n'est donc pas
 * un masque visuel : la donnée n'existe nulle part dans la page envoyée au
 * navigateur. Effet de bord bienvenu : deux requêtes de moins pour un visiteur
 * gratuit — dont l'historique complet des cours, qui est la plus lourde.
 */
async function getData(withMetrics: boolean) {
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
    withMetrics
      ? supabase.from('signals_daily').select('*').eq('date_marche', lastDate)
      : Promise.resolve({ data: null }),
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
  // Non chargées sans droit : c'est la requête la plus lourde de la page.
  const sparklines: Record<string, number[]> = {};
  if (withMetrics) {
    const since = new Date(lastDate);
    since.setDate(since.getDate() - 50);
    const sinceIso = since.toISOString().slice(0, 10);
    // Paginé : 50 j × ~48 titres ≈ 2 400 lignes. Le tri ascendant tronquait aux
    // ~20 séances les plus vieilles, et la « tendance 30 j » montrait le début de
    // la fenêtre en ratant les séances récentes — l'inverse de son intitulé.
    const hist = await fetchAllRows<{ code: string; date_marche: string; cours_jour: number | null }>(
      (from, to) => supabase
        .from('brvm_actions_daily')
        .select('code, date_marche, cours_jour')
        .gte('date_marche', sinceIso)
        .lte('date_marche', lastDate)
        .order('date_marche', { ascending: true })
        .range(from, to),
    );
    for (const r of hist as { code: string; cours_jour: number | null }[]) {
      if (r.cours_jour == null) continue;
      (sparklines[r.code] ??= []).push(r.cours_jour);
    }
    for (const k of Object.keys(sparklines)) sparklines[k] = sparklines[k]!.slice(-30);
  }

  return {
    lastDate,
    actions: enrichedActions,
    signals: sigMap,
    sparklines,
  };
}

export default async function ActionsPage({ searchParams }: { searchParams?: { secteur?: string } }) {
  // Niveau requis LU EN BASE (feature_flags → `actions_metrics`, éditable dans
  // /admin/features). Les cours restent publics ; seules les colonnes calculées
  // sont soumises au flag.
  const gate = await canAccess('actions_metrics');
  const { lastDate, actions, signals, sparklines } = await getData(gate.allowed);
  const initialSecteur = searchParams?.secteur ?? '';

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
            <PremiumCTA href="/actions/compare" variant="gold">
              Comparer des titres
            </PremiumCTA>
          </>
        }
      />

      {/* ── Filet doré de séparation ────────────────────────────────────── */}
      <div className="gold-rule" />

      {/* ── Tableau principal (avec colonne Tendance 30j) ───────────────── */}
      <PremiumPanel>
        <ActionsTable
          actions={actions}
          signals={signals}
          sparklines={sparklines}
          initialSecteur={initialSecteur}
          showMetrics={gate.allowed}
        />
      </PremiumPanel>
    </div>
  );
}

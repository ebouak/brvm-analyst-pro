import type { SupabaseClient } from '@supabase/supabase-js';
import type { HeatmapNode } from '@/lib/heatmap';
import brvmSectors from '@/lib/brvmSectors.json';

/**
 * Charge l'univers heatmap de la dernière séance : actions enrichies du secteur
 * fiable et de la capitalisation boursière (shares × cours). Logique partagée
 * entre la page /heatmap et la section de la landing pour éviter toute
 * divergence. Aucune valeur inventée : capitalisation null si shares inconnu.
 */
export async function loadHeatmap(
  supabase: SupabaseClient,
): Promise<{ lastDate: string | null; rows: HeatmapNode[] }> {
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  const lastDate = (lastRow?.[0]?.date_marche as string | undefined) ?? null;
  if (!lastDate) return { lastDate: null, rows: [] };

  // Référentiel : le secteur fiable et le nombre d'actions (shares) vivent dans
  // brvm_instruments (le secteur de brvm_actions_daily est quasi vide).
  const [{ data: instruments }, { data: actions }] = await Promise.all([
    supabase.from('brvm_instruments').select('code, secteur, shares, actif').eq('actif', true),
    supabase
      .from('brvm_actions_daily')
      .select('code, designation, secteur, pays, cours_jour, variation_pct, volume, valeur_echangee')
      .eq('date_marche', lastDate),
  ]);

  const activeCodes = new Set<string>((instruments ?? []).map((i: { code: string }) => i.code));
  const sectorByCode = new Map<string, string>();
  const sharesByCode = new Map<string, number>();
  for (const i of (instruments ?? []) as { code: string; secteur: string | null; shares: number | null }[]) {
    if (i.secteur) sectorByCode.set(i.code, i.secteur);
    if (i.shares != null && i.shares > 0) sharesByCode.set(i.code, i.shares);
  }

  // Classification fiable : fichier brvmSectors (GICS, par ticker), sinon
  // référentiel Supabase, sinon valeur de la ligne, sinon « Autre ».
  const logoSectors = brvmSectors as Record<string, string>;
  const rows: HeatmapNode[] = ((actions ?? []) as HeatmapNode[])
    .filter((r) => !activeCodes.size || activeCodes.has(r.code))
    .map((r) => {
      const shares = sharesByCode.get(r.code);
      const capitalisation = shares != null && r.cours_jour != null ? shares * r.cours_jour : null;
      return {
        ...r,
        secteur: logoSectors[r.code] ?? sectorByCode.get(r.code) ?? r.secteur ?? 'Autre',
        capitalisation,
      };
    });

  return { lastDate, rows };
}

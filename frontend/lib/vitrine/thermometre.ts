import { createPublicClient } from '@/lib/supabase/public';
import { construireBulletin, phraseEtendue, type Bulletin } from '@/lib/stress/bulletin';
import type { StressDailyRow } from '@/lib/stress/stressIndexTypes';

export interface DonneesThermometre {
  bulletin: Bulletin;
  date: string;
  phrase: string | null;
  serie: number[];
}

/** Les 130 dernières séances de l'indice de tension (clé publique). Null sur erreur ou table vide : la section disparaît. */
export async function chargerThermometre(): Promise<DonneesThermometre | null> {
  try {
    const { data, error } = await createPublicClient()
      .from('stress_daily_index')
      .select('*')
      .order('date_marche', { ascending: false })
      .limit(130);
    if (error || !data || data.length === 0) return null;
    const lignes = (data as StressDailyRow[])
      .map((r) => ({ ...r, date_marche: String(r.date_marche).slice(0, 10), stress_index: Number(r.stress_index) }))
      .reverse();
    const actuel = lignes[lignes.length - 1];
    if (!Number.isFinite(actuel.stress_index)) return null;
    return {
      bulletin: construireBulletin({ actuel, historique: lignes }),
      date: actuel.date_marche,
      // Étendue de la baisse, sans chiffre de recul : la landing ne charge pas la clôture officielle
      // du Composite, et un recul tiré d'une autre source contredirait la page Stress Monitor.
      phrase: phraseEtendue(actuel),
      serie: lignes.map((l) => l.stress_index),
    };
  } catch {
    return null;
  }
}

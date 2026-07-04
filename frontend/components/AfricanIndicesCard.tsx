import { createPublicClient } from '@/lib/supabase/public';

interface AfricanIndexRow {
  code: string;
  libelle: string;
  place: string;
  date_marche: string;
  valeur: number;
  variation_pct: number | null;
  ytd_pct: number | null;
}

const FLAGS: Record<string, string> = { Ghana: '🇬🇭', Nigeria: '🇳🇬', Kenya: '🇰🇪' };

const nf = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Vue pan-africaine : GSE (Ghana), NGX (Nigeria), NSE (Kenya) à côté de la BRVM.
 * Source AFX collectée par le scraper → african_indices_daily (jamais d'appel
 * externe côté frontend). Masqué si aucune donnée (jamais de bloc vide).
 */
export async function AfricanIndicesCard({ brvmComposite }: {
  /** Valeur + variation du BRVM Composite pour la ligne de comparaison (optionnel). */
  brvmComposite?: { valeur: number | null; variation_pct: number | null } | null;
}) {
  const sb = createPublicClient();
  // Dernière ligne par indice (3 places, dates potentiellement différentes).
  const { data } = await sb
    .from('african_indices_daily')
    .select('code, libelle, place, date_marche, valeur, variation_pct, ytd_pct')
    .order('date_marche', { ascending: false })
    .limit(30);

  const latest = new Map<string, AfricanIndexRow>();
  for (const row of (data ?? []) as AfricanIndexRow[]) {
    if (!latest.has(row.code)) latest.set(row.code, row);
  }
  const rows = [...latest.values()];
  if (rows.length === 0) return null;

  const items: {
    key: string; flag: string; libelle: string; valeur: number | null;
    pct: number | null; ytd: number | null; date: string | null; home?: boolean;
  }[] = [];

  if (brvmComposite?.valeur != null) {
    items.push({
      key: 'BRVMC', flag: '🌍', libelle: 'BRVM Composite (UEMOA)',
      valeur: brvmComposite.valeur, pct: brvmComposite.variation_pct ?? null,
      ytd: null, date: null, home: true,
    });
  }
  for (const r of rows) {
    items.push({
      key: r.code, flag: FLAGS[r.place] ?? '🌍', libelle: r.libelle,
      valeur: r.valeur, pct: r.variation_pct, ytd: r.ytd_pct, date: r.date_marche,
    });
  }

  return (
    <div className="rounded-panel border border-border bg-surface/40 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="overline text-gold-2">Afrique · vue régionale</p>
        <span className="overline text-faint">source AFX · fin de séance</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.key}
            className={`flex flex-col gap-1 rounded-xl border p-3 ${
              it.home ? 'border-accent/30 bg-accent/[0.06]' : 'border-border bg-sunken/30'
            }`}
          >
            <span className="truncate text-[11px] text-muted">
              <span aria-hidden className="mr-1">{it.flag}</span>
              {it.libelle}
            </span>
            <span className="tabular text-lg font-bold leading-none text-ivory">
              {it.valeur != null ? nf(it.valeur) : '—'}
            </span>
            <span className="flex items-baseline justify-between gap-2">
              <span className={`tabular text-xs font-bold ${
                it.pct == null ? 'text-faint' : it.pct >= 0 ? 'text-up' : 'text-down'
              }`}>
                {it.pct == null ? '—' : `${it.pct >= 0 ? '+' : ''}${it.pct.toFixed(2)} %`}
              </span>
              {it.ytd != null && (
                <span className="tabular text-[10px] text-faint" title="Performance depuis le 1er janvier">
                  YTD {it.ytd >= 0 ? '+' : ''}{it.ytd.toFixed(1)} %
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-faint">
        Indices en devise locale — non comparables en niveau, seulement en variation.
      </p>
    </div>
  );
}

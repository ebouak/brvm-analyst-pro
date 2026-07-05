import { createPublicClient } from '@/lib/supabase/public';

/**
 * Bandeau macro UEMOA : taux directeur BCEAO (table macro_indicators, valeur
 * officielle datée), parité EUR/XOF fixe et USD/XOF dérivé du cours BCE
 * (frankfurter.dev, sans clé) via la parité — le XOF étant arrimé à l'euro,
 * USD/XOF = USD/EUR × 655,957 par construction. Chaque chiffre est sourcé ;
 * indisponible → « — », jamais une valeur inventée.
 */

interface MacroIndicator {
  key: string;
  label: string;
  value: number;
  unit: string;
  as_of: string;
}

async function getUsdXof(): Promise<{ value: number; date: string } | null> {
  try {
    const resp = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR', {
      next: { revalidate: 3600 },
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { date?: string; rates?: { EUR?: number } };
    const usdEur = json.rates?.EUR;
    if (usdEur == null || usdEur <= 0) return null;
    return { value: usdEur * 655.957, date: json.date ?? '' };
  } catch {
    return null;
  }
}

const fmt = (n: number, digits = 2) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export async function MacroBanner() {
  const sb = createPublicClient();
  const [{ data }, usdXof] = await Promise.all([
    sb.from('macro_indicators').select('key, label, value, unit, as_of'),
    getUsdXof(),
  ]);
  const byKey = new Map(((data ?? []) as MacroIndicator[]).map((r) => [r.key, r]));
  const taux = byKey.get('bceao_taux_directeur');
  const guichet = byKey.get('bceao_guichet_marginal');
  if (!taux && !usdXof) return null;

  const items: { label: string; value: string; hint: string }[] = [];
  if (taux) {
    items.push({
      label: 'Taux directeur BCEAO',
      value: `${fmt(taux.value)} %`,
      hint: `Taux minimum de soumission — en vigueur depuis le ${taux.as_of} (source bceao.int)`,
    });
  }
  if (guichet) {
    items.push({
      label: 'Guichet marginal',
      value: `${fmt(guichet.value)} %`,
      hint: `Taux du guichet de prêt marginal BCEAO — depuis le ${guichet.as_of}`,
    });
  }
  items.push({
    label: 'EUR / XOF',
    value: '655,96',
    hint: 'Parité fixe du franc CFA depuis 1999 (655,957 exactement)',
  });
  if (usdXof) {
    items.push({
      label: 'USD / XOF',
      value: `≈ ${fmt(usdXof.value, 1)}`,
      hint: `Dérivé du cours BCE USD/EUR du ${usdXof.date} × parité fixe — indicatif`,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-panel border border-border bg-surface/40 px-4 py-2.5">
      <span className="overline text-gold-2">Macro UEMOA</span>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-baseline gap-1.5 text-xs" title={it.hint}>
          <span className="text-muted">{it.label}</span>
          <span className="tabular font-bold text-ivory">{it.value}</span>
        </span>
      ))}
      <span className="ml-auto hidden text-[10px] text-faint sm:inline">sources : BCEAO · BCE</span>
    </div>
  );
}

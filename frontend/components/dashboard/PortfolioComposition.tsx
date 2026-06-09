import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EmptyStatePremium } from '@/components/ui/premium';

const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

interface Row {
  code: string;
  quantite: number;
  pru: number;
  cours: number | null;
  perf: number | null;
  valeur: number | null;
}

async function getComposition(): Promise<{ logged: boolean; rows: Row[]; total: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { logged: false, rows: [], total: 0 };

  // Portefeuille par défaut
  const { data: wls } = await supabase.from('watchlists').select('id, is_default').eq('user_id', user.id);
  const lists = (wls ?? []) as { id: string; is_default: boolean | null }[];
  const active = lists.find((w) => w.is_default) ?? lists[0] ?? null;
  if (!active) return { logged: true, rows: [], total: 0 };

  const { data: items } = await supabase
    .from('watchlist_items')
    .select('code, quantite, prix_entree')
    .eq('watchlist_id', active.id);
  const positions = (items ?? []).filter(
    (i): i is { code: string; quantite: number; prix_entree: number } =>
      i.quantite != null && i.quantite > 0 && i.prix_entree != null,
  );
  if (positions.length === 0) return { logged: true, rows: [], total: 0 };

  // Derniers cours
  const { data: lastDay } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const asOf = lastDay?.date_marche as string | undefined;
  const priceByCode = new Map<string, number>();
  if (asOf) {
    const { data: prices } = await supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour')
      .eq('date_marche', asOf)
      .in('code', positions.map((p) => p.code));
    for (const p of prices ?? []) if (p.cours_jour != null) priceByCode.set(p.code as string, p.cours_jour as number);
  }

  let total = 0;
  const rows: Row[] = positions.map((p) => {
    const cours = priceByCode.get(p.code) ?? null;
    const valeur = cours != null ? cours * p.quantite : null;
    const perf = cours != null && p.prix_entree > 0 ? ((cours - p.prix_entree) / p.prix_entree) * 100 : null;
    if (valeur != null) total += valeur;
    return { code: p.code, quantite: p.quantite, pru: p.prix_entree, cours, perf, valeur };
  });
  rows.sort((a, b) => (b.valeur ?? 0) - (a.valeur ?? 0));
  return { logged: true, rows, total };
}

export default async function PortfolioComposition() {
  const { logged, rows, total } = await getComposition();

  return (
    <section className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <span className="overline text-faint">Portefeuille</span>
          <h3 className="font-display text-base text-ivory">Composition</h3>
        </div>
        {rows.length > 0 && (
          <div className="text-right">
            <span className="overline text-faint">Valeur totale</span>
            <p className="tabular text-lg font-semibold text-ivory">{nf(total)} <span className="text-xs text-faint">FCFA</span></p>
          </div>
        )}
      </header>

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyStatePremium
            icon="◇"
            title={logged ? 'Aucune position' : 'Connectez-vous'}
            hint={logged ? 'Ajoutez des positions pour suivre votre composition.' : 'Accédez à votre portefeuille personnel.'}
            action={{ href: logged ? '/portefeuille' : '/login', label: logged ? 'Gérer le portefeuille' : 'Se connecter' }}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left">
                {['Action', 'Quantité', 'Prix moyen', 'Cours actuel', 'Performance', 'Valeur totale'].map((h, i) => (
                  <th key={h} className={`overline px-4 py-2.5 text-faint ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const up = (r.perf ?? 0) >= 0;
                return (
                  <tr key={r.code} className="border-b border-border/40 transition-colors last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/actions/${r.code}`} className="font-semibold text-ivory hover:text-cyan">{r.code}</Link>
                    </td>
                    <td className="tabular px-4 py-3 text-right text-muted">{nf(r.quantite)}</td>
                    <td className="tabular px-4 py-3 text-right text-muted">{nf(r.pru)}</td>
                    <td className="tabular px-4 py-3 text-right text-ivory">{r.cours != null ? nf(r.cours) : '—'}</td>
                    <td className={`tabular px-4 py-3 text-right font-medium ${r.perf == null ? 'text-faint' : up ? 'text-up' : 'text-down'}`}>
                      {r.perf != null ? `${up ? '+' : ''}${r.perf.toFixed(2)}%` : '—'}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-ivory">{r.valeur != null ? nf(r.valeur) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

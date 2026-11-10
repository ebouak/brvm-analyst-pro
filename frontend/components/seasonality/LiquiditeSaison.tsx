/**
 * F9 — Saison de la liquidité : par mois, valeur échangée rapportée à la
 * normale de l'année et part des séances avec échange, pour la valeur et pour
 * le marché. Rendu serveur, ne calcule rien (saisonLiquidite() en amont).
 */
import type { MoisLiquidite } from '@/lib/seasonality/liquidite';

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const fois = (r: number | null) => (r == null ? '—' : `×${r.toFixed(2).replace('.', ',')}`);
const part = (p: number | null) => (p == null ? '—' : `${Math.round(p * 100)} %`);
/** Ton neutre : la liquidité n'est ni bonne ni mauvaise, elle est forte ou faible. */
const fond = (r: number | null) => (r == null ? '' : r >= 1.15 ? 'bg-accent/20' : r <= 0.85 ? 'bg-surface' : '');

export default function LiquiditeSaison({ code, valeur, marche }: { code: string; valeur: MoisLiquidite[]; marche: MoisLiquidite[] }) {
  if (valeur.every((m) => m.annees === 0) && marche.every((m) => m.annees === 0)) return null;
  const anneesValeur = Math.max(...valeur.map((m) => m.annees));
  const anneesMarche = Math.max(...marche.map((m) => m.annees));
  return (
    <section aria-labelledby="liquidite-h" className="space-y-2">
      <h3 id="liquidite-h" className="text-sm font-medium text-ivory">Saison de la liquidité</h3>
      <p className="text-xs text-faint">
        Valeur échangée du mois rapportée au mois médian de l’année (médiane sur {anneesValeur} années pour{' '}
        <span className="font-mono">{code}</span>, {anneesMarche} pour le marché) ; « ×1,22 » : 22 % de plus qu’un mois
        ordinaire. Utile pour savoir quand une ligne peu liquide s’échange le plus facilement.
      </p>
      <div tabIndex={0} role="region" aria-label="Saison de la liquidité, défilement horizontal"
        className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead className="bg-surface text-muted">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">Mois</th>
              {MOIS.map((m) => <th key={m} scope="col" className="px-1 py-1.5 text-center font-medium">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/50">
              <th scope="row" className="px-2 py-1.5 text-left font-normal text-ivory">Valeur échangée, <span className="font-mono">{code}</span></th>
              {valeur.map((m) => <td key={m.mois} className={`px-1 py-1.5 text-center tabular text-ivory ${fond(m.ratio)}`}>{fois(m.ratio)}</td>)}
            </tr>
            <tr className="border-t border-border/50">
              <th scope="row" className="px-2 py-1.5 text-left font-normal text-ivory">Séances avec échange, <span className="font-mono">{code}</span></th>
              {valeur.map((m) => <td key={m.mois} className="px-1 py-1.5 text-center tabular text-muted">{part(m.partSeances)}</td>)}
            </tr>
            <tr className="border-t border-border/50">
              <th scope="row" className="px-2 py-1.5 text-left font-normal text-ivory">Valeur échangée, marché</th>
              {marche.map((m) => <td key={m.mois} className={`px-1 py-1.5 text-center tabular text-ivory ${fond(m.ratio)}`}>{fois(m.ratio)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

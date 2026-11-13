'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Rows3, Grid3x3 } from 'lucide-react';
import type { ActionRow } from '@/lib/screener/filters';
import ScreenerResults from '@/components/ScreenerResults';
import { fmtNumber, fmtPctSigne, fmtPctAbs } from '@/lib/format';
import { grouperParSecteur, niveau, valeurMesure, LIBELLE_MESURE, type MesureChaleur, type Vue } from '@/lib/screener/vues';

/**
 * Trois vues des mêmes résultats filtrés : tableau (tri, export), cartes
 * (lecture sur mobile) et carte de chaleur par secteur. La sélection est la
 * même dans les trois ; seule la présentation change.
 */
const VUES: Array<{ id: Vue; libelle: string; Icone: typeof Rows3 }> = [
  { id: 'tableau', libelle: 'Tableau', Icone: Rows3 },
  { id: 'cartes', libelle: 'Cartes', Icone: LayoutGrid },
  { id: 'chaleur', libelle: 'Carte de chaleur', Icone: Grid3x3 },
];

// Classes écrites en entier : Tailwind ne génère que ce qu'il lit.
const TEINTE_VARIATION: Record<number, string> = {
  [-3]: 'bg-down/40', [-2]: 'bg-down/25', [-1]: 'bg-down/10', 0: 'bg-elevated/60', 1: 'bg-up/10', 2: 'bg-up/25', 3: 'bg-up/40',
};
// RSI : ni vert ni rouge (un RSI bas n'est pas « bon ») ; deux teintes neutres.
const TEINTE_RSI: Record<number, string> = {
  [-3]: 'bg-info/40', [-2]: 'bg-info/25', [-1]: 'bg-info/10', 0: 'bg-elevated/60', 1: 'bg-warn/10', 2: 'bg-warn/25', 3: 'bg-warn/40',
};
const TEINTE_RENDEMENT: Record<number, string> = { 0: 'bg-elevated/60', 1: 'bg-accent/10', 2: 'bg-accent/25', 3: 'bg-accent/40' };

function teinte(m: MesureChaleur, n: number | null): string {
  if (n == null) return 'bg-transparent border-dashed';
  return (m === 'variation' ? TEINTE_VARIATION : m === 'rsi' ? TEINTE_RSI : TEINTE_RENDEMENT)[n] ?? 'bg-elevated/60';
}

function formatMesure(m: MesureChaleur, v: number | null): string {
  if (v == null) return '—';
  if (m === 'variation') return fmtPctSigne(v);
  if (m === 'rsi') return fmtNumber(v, 0);
  return fmtPctAbs(v);
}

export default function ScreenerVues({ results }: { results: ActionRow[] }) {
  const [vue, setVue] = useState<Vue>('tableau');
  const [mesure, setMesure] = useState<MesureChaleur>('variation');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Présentation des résultats">
        {VUES.map(({ id, libelle, Icone }) => (
          <button
            key={id}
            type="button"
            onClick={() => setVue(id)}
            aria-pressed={vue === id}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition-colors ${
              vue === id ? 'border-accent bg-accent text-bg' : 'border-border bg-surface text-muted hover:text-ivory'
            }`}
          >
            <Icone size={14} aria-hidden /> {libelle}
          </button>
        ))}
        {vue === 'chaleur' && (
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            Couleur :
            <select
              value={mesure}
              onChange={(e) => setMesure(e.target.value as MesureChaleur)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ivory"
            >
              {(Object.keys(LIBELLE_MESURE) as MesureChaleur[]).map((m) => (
                <option key={m} value={m}>{LIBELLE_MESURE[m]}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {vue === 'tableau' && <ScreenerResults results={results} />}
      {vue === 'cartes' && <Cartes results={results} />}
      {vue === 'chaleur' && <Chaleur results={results} mesure={mesure} />}
    </div>
  );
}

function Cartes({ results }: { results: ActionRow[] }) {
  if (!results.length) return <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">Aucune valeur ne correspond aux filtres.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((r) => (
        <li key={r.code}>
          <Link href={`/actions/${r.code}`} className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-medium text-ivory">{r.code}</span>
              <span className={`tabular text-sm ${r.variation_pct != null && r.variation_pct > 0 ? 'text-up' : r.variation_pct != null && r.variation_pct < 0 ? 'text-down' : 'text-muted'}`}>
                {r.variation_pct != null ? fmtPctSigne(r.variation_pct) : '—'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-faint">{r.secteur ?? 'Non classé'}</p>
            <p className="tabular mt-2 text-lg text-ivory">{r.cours_jour != null ? fmtNumber(r.cours_jour) : '—'} <span className="text-xs text-muted">FCFA</span></p>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
              {[
                ['RSI', r.rsi != null ? fmtNumber(r.rsi, 0) : '—'],
                ['Score', r.score_signal != null ? String(r.score_signal) : '—'],
                ['Div.', r.rendement_dividende != null ? fmtPctAbs(r.rendement_dividende) : '—'],
                ['Liq.', r.liquidite_classe ?? '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-faint">{k}</dt>
                  <dd className="tabular text-ivory">{v}</dd>
                </div>
              ))}
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Chaleur({ results, mesure }: { results: ActionRow[]; mesure: MesureChaleur }) {
  if (!results.length) return <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">Aucune valeur ne correspond aux filtres.</p>;
  return (
    <div className="space-y-4">
      {grouperParSecteur(results).map((g) => (
        <section key={g.secteur} aria-label={g.secteur}>
          <h3 className="mb-1.5 text-xs text-muted">{g.secteur} <span className="tabular text-faint">({g.actions.length})</span></h3>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-8">
            {g.actions.map((a) => {
              const v = valeurMesure(a, mesure);
              return (
                <li key={a.code}>
                  <Link
                    href={`/actions/${a.code}`}
                    title={`${a.code} · ${LIBELLE_MESURE[mesure]} : ${formatMesure(mesure, v)}`}
                    className={`flex flex-col items-center rounded-md border border-border/60 px-1 py-2 transition-colors hover:border-accent/60 ${teinte(mesure, niveau(mesure, v))}`}
                  >
                    <span className="font-mono text-xs font-medium text-ivory">{a.code}</span>
                    <span className="tabular text-[11px] text-muted">{formatMesure(mesure, v)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-[11px] text-faint">
        La teinte situe la mesure ({LIBELLE_MESURE[mesure].toLowerCase()}) ; elle ne qualifie pas la valeur. Bordure en tirets : donnée absente.
      </p>
    </div>
  );
}

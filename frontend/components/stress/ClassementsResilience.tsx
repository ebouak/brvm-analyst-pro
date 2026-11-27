'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import type {
  ActionResilienceRow,
  SecteurStressRow,
} from '@/lib/stress/resilienceTypes';
import { HeatmapSectorielle } from './HeatmapSectorielle';
import { RadarValorisations } from './RadarValorisations';
import { FicheValeurDrawer } from './FicheValeurDrawer';

type OngletClassement = 'A' | 'C' | 'decrochages' | 'tous';
type CleTri = 'drawdown' | 'perf_3m' | 'roe' | 'per' | 'dividende' | 'liquidite';

export function ClassementsResilience({
  actions,
  secteurs,
}: {
  actions: readonly ActionResilienceRow[];
  secteurs: readonly SecteurStressRow[];
}) {
  const [onglet, setOnglet] = useState<OngletClassement>('A');
  const [tri, setTri] = useState<CleTri>('drawdown');
  const [secteur, setSecteur] = useState<string>('TOUS');
  const [pays, setPays] = useState<string>('TOUS');
  const [masquerIlliquides, setMasquerIlliquides] = useState<boolean>(false);
  const [selection, setSelection] = useState<ActionResilienceRow | null>(null);

  const paysDispos = useMemo(
    () => [...new Set(actions.map((a) => a.pays).filter((p): p is string => Boolean(p)))].sort(),
    [actions],
  );

  const lignes = useMemo(() => {
    let arr = actions.filter((a) => {
      if (secteur !== 'TOUS' && a.secteur !== secteur) return false;
      if (pays !== 'TOUS' && a.pays !== pays) return false;
      if (masquerIlliquides && a.illiquide_flag) return false;
      return true;
    });

    if (onglet === 'A') {
      arr = arr.filter((a) => a.classement_a_rang != null).sort((a, b) => a.classement_a_rang! - b.classement_a_rang!);
    } else if (onglet === 'C') {
      arr = arr.filter((a) => a.classement_c_rang != null).sort((a, b) => a.classement_c_rang! - b.classement_c_rang!);
    } else if (onglet === 'decrochages') {
      arr = arr
        .filter((a) => a.decrochage_anormal)
        .sort((a, b) => (a.decrochage_relatif_pct ?? 0) - (b.decrochage_relatif_pct ?? 0));
    } else {
      arr = [...arr].sort((a, b) => {
        if (tri === 'perf_3m') return (b.perf_3m_pct ?? -999) - (a.perf_3m_pct ?? -999);
        if (tri === 'roe') return (b.fondamentaux.roe_pct ?? -999) - (a.fondamentaux.roe_pct ?? -999);
        if (tri === 'per') return (a.fondamentaux.per ?? 9999) - (b.fondamentaux.per ?? 9999);
        if (tri === 'dividende') return (b.dividendes.rendement_pct ?? -1) - (a.dividendes.rendement_pct ?? -1);
        if (tri === 'liquidite') return (b.liquidite.score_v2 ?? -1) - (a.liquidite.score_v2 ?? -1);
        return (b.drawdown_pct ?? -999) - (a.drawdown_pct ?? -999);
      });
    }
    return arr;
  }, [actions, onglet, tri, secteur, pays, masquerIlliquides]);

  const exportUrl = `/api/stress/resilience?format=csv&classement=${onglet === 'tous' ? 'tous' : onglet}${
    secteur !== 'TOUS' ? `&secteur=${encodeURIComponent(secteur)}` : ''
  }${pays !== 'TOUS' ? `&pays=${encodeURIComponent(pays)}` : ''}`;

  return (
    <div className="space-y-8">
      <HeatmapSectorielle secteurs={secteurs} secteurActif={secteur} onSelectSecteur={setSecteur} />

      <div className="rounded-panel border border-border bg-surface p-5">
        <RadarValorisations actions={actions} onSelectAction={setSelection} />
      </div>

      {/* Onglets factuels et tableau */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ['A', 'Plus résistantes (hors peu liquides)'],
                ['C', 'Plus fortes baisses'],
                ['decrochages', 'Décrochages anormaux'],
                ['tous', 'Toutes les valeurs'],
              ] as const
            ).map(([id, lbl]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOnglet(id)}
                className={`rounded-lg border px-3 py-1.5 font-medium transition-colors ${
                  onglet === id
                    ? 'border-accent-ink bg-accent-ink text-bg'
                    : 'border-border bg-sunken text-muted hover:text-ivory'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <a
            href={exportUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 py-1.5 text-xs font-medium text-ivory hover:border-accent"
          >
            <Download className="h-3.5 w-3.5 text-accent-ink" strokeWidth={1.75} />
            Exporter CSV
          </a>
        </div>

        {/* Filtres secondaires */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            Pays
            <select
              value={pays}
              onChange={(e) => setPays(e.target.value)}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value="TOUS">Tous</option>
              {paysDispos.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          {onglet === 'tous' && (
            <label className="flex items-center gap-1.5 text-muted">
              Trier par
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as CleTri)}
                className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
              >
                <option value="drawdown">Drawdown (du plus contenu au plus fort)</option>
                <option value="perf_3m">Performance 3 mois</option>
                <option value="roe">ROE publié</option>
                <option value="per">PER croissant</option>
                <option value="dividende">Rendement dividende</option>
                <option value="liquidite">Liquidité v2</option>
              </select>
            </label>
          )}

          <label className="inline-flex cursor-pointer items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={masquerIlliquides}
              onChange={(e) => setMasquerIlliquides(e.target.checked)}
              className="rounded border-border bg-sunken"
            />
            Exclure les valeurs peu liquides
          </label>
        </div>

        <p className="text-xs text-faint">
          Lecture factuelle : chaque indicateur (drawdown, écart relatif, ROE, PER, dividende, liquidité) est affiché séparément, sans score composite ni catégorie de recommandation.
        </p>

        {lignes.length === 0 ? (
          <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-muted">
            Aucune valeur ne correspond à ces critères.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-faint">
                  <th className="px-3 py-2.5 font-medium">Valeur</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cours</th>
                  <th className="px-3 py-2.5 text-right font-medium">Drawdown</th>
                  <th className="px-3 py-2.5 text-right font-medium">Perf. 3M</th>
                  <th className="px-3 py-2.5 text-right font-medium">Décrochage rel.</th>
                  <th className="px-3 py-2.5 text-right font-medium">PER / PBR</th>
                  <th className="px-3 py-2.5 text-right font-medium">ROE</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rdt div.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Liquidité</th>
                  <th className="px-3 py-2.5 font-medium">Comptes</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((a) => (
                  <tr
                    key={a.code}
                    onClick={() => setSelection(a)}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-elevated/50"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ivory">
                        {a.code}{' '}
                        {a.decrochage_anormal && (
                          <span className="ml-1 rounded-full border border-down/40 bg-down/10 px-1.5 py-0.5 text-[11px] font-medium text-down">
                            Décrochage
                          </span>
                        )}
                        {a.illiquide_flag && (
                          <span className="ml-1 rounded-full border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[11px] font-medium text-warn">
                            Peu liquide
                          </span>
                        )}
                      </p>
                      <p className="text-faint">
                        {a.designation} · {a.secteur}
                      </p>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-ivory">
                      {a.cours_jour != null ? fmtNumber(a.cours_jour, 0) : '—'}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-semibold text-down">
                      {a.drawdown_pct != null ? fmtPctSigne(a.drawdown_pct, 1) : '—'}
                    </td>
                    <td
                      className={`tabular px-3 py-2.5 text-right ${
                        (a.perf_3m_pct ?? 0) < 0 ? 'text-down' : 'text-up'
                      }`}
                    >
                      {a.perf_3m_pct != null ? fmtPctSigne(a.perf_3m_pct, 1) : '—'}
                    </td>
                    <td
                      className={`tabular px-3 py-2.5 text-right ${
                        (a.decrochage_relatif_pct ?? 0) < -5 ? 'text-down' : 'text-muted'
                      }`}
                    >
                      {a.decrochage_relatif_pct != null
                        ? `${fmtPctSigne(a.decrochage_relatif_pct, 1).replace(' %', '')} pts`
                        : '—'}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">
                      {a.fondamentaux.per != null ? `${fmtNumber(a.fondamentaux.per, 1)}x` : '—'} /{' '}
                      {a.fondamentaux.pbr != null ? `${fmtNumber(a.fondamentaux.pbr, 2)}x` : '—'}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-ivory">
                      {a.fondamentaux.roe_pct != null ? `${fmtNumber(a.fondamentaux.roe_pct, 1)} %` : '—'}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-up">
                      {a.dividendes.rendement_pct != null ? `${fmtNumber(a.dividendes.rendement_pct, 1)} %` : '—'}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">
                      {a.liquidite.score_v2 != null ? `${fmtNumber(a.liquidite.score_v2, 0)} (${a.liquidite.classe ?? '—'})` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {a.fondamentaux.exercice ?? '—'} ·{' '}
                      <span className="text-faint">
                        {a.famille_comptable === 'banque' ? 'Banque' : 'Entreprise'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FicheValeurDrawer action={selection} onClose={() => setSelection(null)} />
    </div>
  );
}

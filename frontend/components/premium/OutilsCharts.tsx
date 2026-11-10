'use client';
import { libelleSignal } from '@/lib/signalLabel';
import { useState } from 'react';
import type { ActionProcheBas, MoisSaisonnalite, ReactionEtatFinancier } from '@/lib/premium/outils';
import { fmtDateCourte } from '@/lib/format';

const SIGNAL_COLOR: Record<string, string> = {
  ACHAT: 'text-up bg-up/5 border-up/30',
  NEUTRE: 'text-warn bg-warn/10 border-warn/30',
  VENTE: 'text-down bg-down/5 border-down/30',
};

function ProchesBasTable({ data }: { data: ActionProcheBas[] }) {
  if (data.length === 0) return (
    <div className="bg-surface border border-border rounded-xl p-10 text-center">
      <p className="text-muted text-sm">Aucune donnée disponible.</p>
    </div>
  );
  return (
    <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="text-left py-2 px-3">#</th>
            <th className="text-left py-2 px-3">Action</th>
            <th className="text-right py-2 px-3">Cours (FCFA)</th>
            <th className="text-right py-2 px-3">Plus bas 52s (FCFA)</th>
            <th className="text-right py-2 px-3">Plus haut 52s (FCFA)</th>
            <th className="text-right py-2 px-3">Distance bas (%)</th>
            <th className="text-left py-2 px-3">Signal</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a, i) => (
            <tr key={a.code} className={`border-b border-border/40 hover:bg-elevated transition-colors ${i % 2 === 1 ? 'bg-elevated/40' : ''}`}>
              <td className="py-2 px-3 text-faint tabular">{i + 1}</td>
              <td className="py-2 px-3">
                <div className="font-medium text-white">{a.code}</div>
                <div className="text-xs text-muted">{a.designation}</div>
              </td>
              <td className="py-2 px-3 text-right tabular text-ivory">{a.cours_actuel.toLocaleString('fr-FR')} F</td>
              <td className="py-2 px-3 text-right tabular text-down">{a.cours_bas_52s.toLocaleString('fr-FR')} F</td>
              <td className="py-2 px-3 text-right tabular text-up">{a.cours_haut_52s.toLocaleString('fr-FR')} F</td>
              <td className="py-2 px-3 text-right">
                <span className={`tabular font-medium ${a.distance_pct < 5 ? 'text-down' : a.distance_pct < 15 ? 'text-warn' : 'text-muted'}`}>
                  +{a.distance_pct.toFixed(1)}%
                </span>
              </td>
              <td className="py-2 px-3">
                {a.signal ? (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${SIGNAL_COLOR[a.signal] ?? 'text-muted border-border'}`}>
                    {libelleSignal(a.signal)}
                  </span>
                ) : <span className="text-faint">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SaisonnaliteChart({ data }: { data: MoisSaisonnalite[] }) {
  if (data.length === 0) return (
    <div className="bg-surface border border-border rounded-xl p-10 text-center">
      <p className="text-muted text-sm">Aucune donnée disponible.</p>
    </div>
  );
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.perf_mediane)), 0.01);
  return (
    <div className="space-y-2">
      {data.map((m) => {
        const isPos = m.perf_mediane >= 0;
        // Une régularité non distinguable du hasard reste grise.
        const hasard = m.verdict === 'hasard';
        const barW = Math.min(100, (Math.abs(m.perf_mediane) / maxAbs) * 100);
        return (
          <div key={m.mois} className="flex items-center gap-3">
            <span className="text-xs text-muted w-8 shrink-0">{m.nom_mois}</span>
            <div className="flex-1 flex items-center gap-1 h-6">
              {!isPos && (
                <div
                  className={`h-4 rounded-l ml-auto ${hasard ? 'bg-border-strong' : 'bg-down/70'}`}
                  style={{ width: `${barW / 2}%` }}
                />
              )}
              <div className="w-px h-5 bg-border shrink-0" />
              {isPos && (
                <div
                  className={`h-4 rounded-r ${hasard ? 'bg-border-strong' : 'bg-up/70'}`}
                  style={{ width: `${barW / 2}%` }}
                />
              )}
            </div>
            <span className={`tabular text-xs w-16 text-right ${hasard ? 'text-muted' : isPos ? 'text-up' : 'text-down'}`}>
              {m.n === 0 ? '—' : `${isPos ? '+' : '−'}${Math.abs(m.perf_mediane).toFixed(1).replace('.', ',')}\u00a0%`}
            </span>
            <span className="text-xs text-muted w-28 text-right">
              {m.n === 0 ? 'aucune donnée' : `en hausse ${m.nb_hausses} an${m.nb_hausses > 1 ? 's' : ''} sur ${m.n}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReactionTable({ data }: { data: ReactionEtatFinancier[] }) {
  if (data.length === 0) return (
    <div className="bg-surface border border-border rounded-xl p-10 text-center">
      <p className="text-muted text-sm">Aucune réaction enregistrée. Les données apparaîtront au fur et à mesure des publications.</p>
    </div>
  );
  return (
    <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="text-left py-2 px-3">Action</th>
            <th className="text-left py-2 px-3">Date</th>
            <th className="text-left py-2 px-3">Type</th>
            <th className="text-right py-2 px-3">Perf J+1 (%)</th>
            <th className="text-right py-2 px-3">Perf J+5 (%)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={`${r.code}-${r.date_publication}`} className={`border-b border-border/40 hover:bg-elevated transition-colors ${i % 2 === 1 ? 'bg-elevated/40' : ''}`}>
              <td className="py-2 px-3">
                <div className="font-mono font-medium text-ivory">{r.code}</div>
                <div className="text-xs text-muted truncate max-w-[140px]">{r.designation}</div>
              </td>
              <td className="py-2 px-3 text-muted text-xs">{fmtDateCourte(r.date_publication)}</td>
              <td className="py-2 px-3 text-xs text-muted">{r.type_event}</td>
              <td className="py-2 px-3 text-right">
                <span className={`tabular text-sm font-medium ${r.perf_j1 >= 0 ? 'text-up' : 'text-down'}`}>
                  {r.perf_j1 >= 0 ? '+' : ''}{r.perf_j1.toFixed(2)}%
                </span>
              </td>
              <td className="py-2 px-3 text-right">
                <span className={`tabular text-sm font-medium ${r.perf_j5 >= 0 ? 'text-up' : 'text-down'}`}>
                  {r.perf_j5 >= 0 ? '+' : ''}{r.perf_j5.toFixed(2)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tab = 'bas' | 'saisonnalite' | 'etats';
const TABS: { id: Tab; label: string }[] = [
  { id: 'bas', label: 'Proches de leurs bas' },
  { id: 'saisonnalite', label: 'Saisonnalité' },
  { id: 'etats', label: 'Réaction États financiers' },
];

export default function OutilsCharts({
  actionsProchesBas,
  saisonnalite,
  reactionsEtats,
}: {
  actionsProchesBas: ActionProcheBas[];
  saisonnalite: MoisSaisonnalite[];
  reactionsEtats: ReactionEtatFinancier[];
}) {
  const [tab, setTab] = useState<Tab>('bas');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-up text-up'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bas' && (
        <div>
          <p className="text-xs text-muted mb-4">
            Actions classées par proximité de leur plus bas sur 52 semaines. Distance = écart entre le cours actuel et le plus bas (0% = au plus bas).
          </p>
          <ProchesBasTable data={actionsProchesBas} />
        </div>
      )}
      {tab === 'saisonnalite' && (
        <div>
          <p className="text-xs text-muted mb-4">
            Rendement mensuel médian du marché (moyenne équipondérée des actions cotées) sur les 5 dernières années, mois en cours exclu. Cinq années ne suffisent pas à établir une régularité : les barres grises ne se distinguent pas du hasard.
          </p>
          <SaisonnaliteChart data={saisonnalite} />
        </div>
      )}
      {tab === 'etats' && (
        <div>
          <p className="text-xs text-muted mb-4">
            Réaction du cours aux publications de résultats et états financiers. Perf J+1 = variation le lendemain de la publication ; J+5 = variation 5 séances après.
          </p>
          <ReactionTable data={reactionsEtats} />
        </div>
      )}
    </div>
  );
}

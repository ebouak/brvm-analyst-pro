'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { fmtDateFR, fmtNumber, fmtPctSigne } from '@/lib/format';
import { LIBELLES_NIVEAUX, SEUILS_CRISES, type EpisodeCrise } from '@/lib/stress/types';

type TriCle = 'date' | 'perte' | 'duree' | 'similarite';

export function TableauCrises({ episodes }: { episodes: readonly EpisodeCrise[] }) {
  const indicesDispos = useMemo(
    () => [...new Set(episodes.map((e) => e.indice_code))],
    [episodes],
  );

  const [indiceFiltre, setIndiceFiltre] = useState<string>(
    indicesDispos.includes('BRVMC') ? 'BRVMC' : (indicesDispos[0] ?? 'TOUS'),
  );
  const [seuilFiltre, setSeuilFiltre] = useState<number>(-10);
  const [statutFiltre, setStatutFiltre] = useState<'tous' | 'en_cours' | 'termine'>('tous');
  const [tri, setTri] = useState<TriCle>('date');
  const [ouvertKey, setOuvertKey] = useState<string | null>(null);

  const filtres = useMemo(() => {
    const out = episodes.filter((e) => {
      if (indiceFiltre !== 'TOUS' && e.indice_code !== indiceFiltre) return false;
      if (seuilFiltre !== 0 && Number(e.seuil_pct) !== seuilFiltre) return false;
      if (statutFiltre !== 'tous' && e.statut !== statutFiltre) return false;
      return true;
    });

    out.sort((a, b) => {
      if (tri === 'perte') return a.perte_max_pct - b.perte_max_pct;
      if (tri === 'duree') return b.nb_seances_baisse - a.nb_seances_baisse;
      if (tri === 'similarite') return (b.similarite_actuelle ?? -1) - (a.similarite_actuelle ?? -1);
      return b.date_sommet.localeCompare(a.date_sommet);
    });
    return out;
  }, [episodes, indiceFiltre, seuilFiltre, statutFiltre, tri]);

  const exportUrl = `/api/stress/crises?format=csv${
    indiceFiltre !== 'TOUS' ? `&indice=${encodeURIComponent(indiceFiltre)}` : ''
  }${seuilFiltre !== 0 ? `&seuil=${seuilFiltre}` : ''}${
    statutFiltre !== 'tous' ? `&statut=${statutFiltre}` : ''
  }`;

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            Indice
            <select
              value={indiceFiltre}
              onChange={(e) => setIndiceFiltre(e.target.value)}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value="TOUS">Tous les indices</option>
              {indicesDispos.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-muted">
            Seuil
            <select
              value={seuilFiltre}
              onChange={(e) => setSeuilFiltre(Number(e.target.value))}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value={0}>Tous les seuils</option>
              {SEUILS_CRISES.map((s) => (
                <option key={s} value={s}>{s} %</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-muted">
            Statut
            <select
              value={statutFiltre}
              onChange={(e) => setStatutFiltre(e.target.value as 'tous' | 'en_cours' | 'termine')}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value="tous">Tous</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminés</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-muted">
            Trier par
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value as TriCle)}
              className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
            >
              <option value="date">Date du sommet</option>
              <option value="perte">Amplitude maximale</option>
              <option value="duree">Durée de baisse</option>
              <option value="similarite">Similarité actuelle</option>
            </select>
          </label>
        </div>

        <a
          href={exportUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 py-1.5 text-xs font-medium text-ivory transition-colors hover:border-accent"
        >
          <Download className="h-3.5 w-3.5 text-accent-ink" strokeWidth={1.75} />
          Exporter CSV
        </a>
      </div>

      {/* Tableau */}
      {filtres.length === 0 ? (
        <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-muted">
          Aucun épisode ne correspond à cette combinaison de filtres.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-faint">
                <th className="px-3 py-2.5 font-medium">Épisode</th>
                <th className="px-3 py-2.5 font-medium">Indice</th>
                <th className="px-3 py-2.5 font-medium">Sommet → Creux</th>
                <th className="px-3 py-2.5 text-right font-medium">Perte max</th>
                <th className="px-3 py-2.5 text-right font-medium">Baisse</th>
                <th className="px-3 py-2.5 text-right font-medium">Récupération</th>
                <th className="px-3 py-2.5 text-right font-medium">Rebond 12M</th>
                <th className="px-3 py-2.5 text-right font-medium">Similarité</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((ep) => {
                const key = `${ep.indice_code}:${ep.seuil_pct}:${ep.date_sommet}`;
                const estOuvert = ouvertKey === key;
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={() => setOuvertKey(estOuvert ? null : key)}
                      className="cursor-pointer border-b border-border/60 transition-colors hover:bg-elevated/50"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {estOuvert ? (
                            <ChevronDown className="h-3.5 w-3.5 text-accent-ink" strokeWidth={1.75} />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-faint" strokeWidth={1.75} />
                          )}
                          <div>
                            <p className="font-medium text-ivory">{ep.libelle}</p>
                            <p className="text-faint">{LIBELLES_NIVEAUX[ep.niveau]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-ivory">{ep.indice_code}</td>
                      <td className="tabular px-3 py-2.5 text-muted">
                        {fmtDateFR(ep.date_sommet)} → {fmtDateFR(ep.date_creux)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-semibold text-down">
                        {fmtPctSigne(ep.perte_max_pct, 2)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-muted">
                        {fmtNumber(ep.nb_seances_baisse, 0)} séances
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-muted">
                        {ep.statut === 'en_cours'
                          ? 'En cours'
                          : ep.duree_totale_recuperation_jours != null
                            ? `${fmtNumber(ep.duree_totale_recuperation_jours, 0)} j`
                            : '—'}
                      </td>
                      <td
                        className={`tabular px-3 py-2.5 text-right font-medium ${
                          ep.rebond_12m_pct == null
                            ? 'text-faint'
                            : ep.rebond_12m_pct >= 0
                              ? 'text-up'
                              : 'text-down'
                        }`}
                      >
                        {ep.rebond_12m_pct != null ? fmtPctSigne(ep.rebond_12m_pct, 1) : '—'}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-ivory">
                        {ep.similarite_actuelle != null ? `${fmtNumber(ep.similarite_actuelle, 0)} / 100` : '—'}
                      </td>
                    </tr>
                    {estOuvert && (
                      <tr className="border-b border-border bg-sunken/80">
                        <td colSpan={8} className="p-4">
                          <FicheEpisode ep={ep} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FicheEpisode({ ep }: { ep: EpisodeCrise }) {
  const m = ep.contexte_marche;
  const mac = ep.contexte_macro;
  const ent = ep.contexte_entreprises;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface p-3">
        <p className="font-semibold text-ivory">Chronologie & Reprise</p>
        <p className="text-muted">
          Sommet : <span className="tabular text-ivory">{fmtNumber(ep.valeur_sommet, 2)}</span> le{' '}
          <span className="tabular">{fmtDateFR(ep.date_sommet)}</span>
        </p>
        <p className="text-muted">
          Creux : <span className="tabular text-ivory">{fmtNumber(ep.valeur_creux, 2)}</span> le{' '}
          <span className="tabular">{fmtDateFR(ep.date_creux)}</span>
        </p>
        <p className="text-muted">
          Rebonds intermédiaires : <span className="tabular text-ivory">{ep.nb_rebonds_intermediaires}</span>
          {ep.amplitude_max_rebond_pct != null && ` (max +${fmtNumber(ep.amplitude_max_rebond_pct, 1)} %)`}
        </p>
        <p className="text-muted">
          Post-creux 1M / 3M / 6M / 24M :{' '}
          <span className="tabular text-ivory">
            {[ep.rebond_1m_pct, ep.rebond_3m_pct, ep.rebond_6m_pct, ep.rebond_24m_pct]
              .map((v) => (v != null ? fmtPctSigne(v, 1) : '—'))
              .join(' · ')}
          </span>
        </p>
      </div>

      <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface p-3">
        <p className="font-semibold text-ivory">A. Contexte de marché</p>
        <p className="text-muted">
          BRVM-V moyenne :{' '}
          <span className="tabular text-ivory">
            {m?.volatilite_moyenne != null ? `${fmtNumber(m.volatilite_moyenne, 1)} %` : '—'}
          </span>
        </p>
        <p className="text-muted">
          Titres en baisse (moy.) :{' '}
          <span className="tabular text-ivory">
            {m?.pct_titres_baisse_moyen != null ? `${fmtNumber(m.pct_titres_baisse_moyen, 1)} %` : '—'}
          </span>
        </p>
        <p className="text-muted">
          Perf. banques :{' '}
          <span className="tabular text-ivory">
            {m?.perf_banques_pct != null ? fmtPctSigne(m.perf_banques_pct, 1) : '—'}
          </span>
        </p>
        <p className="text-muted">
          Dispersion sectorielle :{' '}
          <span className="tabular text-ivory">
            {m?.concentration_sectorielle != null ? `${fmtNumber(m.concentration_sectorielle, 1)} pts` : '—'}
          </span>
        </p>
      </div>

      <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface p-3">
        <p className="font-semibold text-ivory">B. Contexte économique UEMOA</p>
        <p className="text-muted">
          Taux BCEAO :{' '}
          <span className="tabular text-ivory">
            {mac?.taux_bceao_debut_pct != null ? `${fmtNumber(mac.taux_bceao_debut_pct, 2)} %` : '—'} →{' '}
            {mac?.taux_bceao_fin_pct != null ? `${fmtNumber(mac.taux_bceao_fin_pct, 2)} %` : '—'}
          </span>
        </p>
        <p className="text-muted">
          PIB UEMOA moyen :{' '}
          <span className="tabular text-ivory">
            {mac?.pib_uemoa_moyen_pct != null ? `${fmtNumber(mac.pib_uemoa_moyen_pct, 2)} %` : '—'}
          </span>
        </p>
        <p className="text-muted">
          Inflation UEMOA moy. :{' '}
          <span className="tabular text-ivory">
            {mac?.inflation_uemoa_moyenne_pct != null ? `${fmtNumber(mac.inflation_uemoa_moyenne_pct, 2)} %` : '—'}
          </span>
        </p>
        <p className="text-faint">Sources : BCEAO & Banque Mondiale</p>
      </div>

      <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface p-3">
        <p className="font-semibold text-ivory">C. Entreprises & Similarité</p>
        <p className="text-muted">
          Événements recensés : <span className="tabular text-ivory">{ent?.nb_evenements ?? 0}</span>
        </p>
        {ep.similarite_details ? (
          <>
            <p className="text-muted">
              Euclidienne / Forme / Corr. :{' '}
              <span className="tabular text-ivory">
                {[
                  ep.similarite_details.composantes.euclidienne,
                  ep.similarite_details.composantes.formeDrawdown,
                  ep.similarite_details.composantes.correlation,
                ]
                  .map((x) => (x != null ? Math.round(x) : '—'))
                  .join(' / ')}
              </span>
            </p>
            <p className="text-faint">{ep.similarite_details.avertissement}</p>
          </>
        ) : (
          <p className="text-faint">Épisode de référence pour la comparaison actuelle.</p>
        )}
      </div>
    </div>
  );
}

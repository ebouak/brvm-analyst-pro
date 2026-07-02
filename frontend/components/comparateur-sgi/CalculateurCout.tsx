'use client';

import { useMemo, useState } from 'react';
import { SGI_FRAIS_SEED } from '@/lib/sgi-frais/seed-data';
import { calculerCoutSGI, calculerSeuilRentabilite } from '@/lib/sgi-frais/calculateur';
import { PAYS, SGI_DIRECTORY, type Sgi } from '@/lib/sgi-frais/directory';
import type { SgiFrais } from '@/lib/sgi-frais/types';
import { TableauResultatCout } from './TableauResultatCout';
import { GraphiqueCoutSGI } from './GraphiqueCoutSGI';
import { CarteRecommandee } from './CarteRecommandee';

const DUREE_OPTIONS = [
  { value: 0.25, label: '3 mois' },
  { value: 0.5, label: '6 mois' },
  { value: 1, label: '1 an' },
  { value: 2, label: '2 ans' },
  { value: 3, label: '3 ans' },
  { value: 5, label: '5 ans' },
];

const ORDRE_OPTIONS = Array.from({ length: 13 }, (_, i) => i);

const DEPOT_FILTRES = [
  { value: 0, label: 'Tous dépôts' },
  { value: 100_000, label: '≤ 100 000 FCFA' },
  { value: 300_000, label: '≤ 300 000 FCFA' },
  { value: 500_000, label: '≤ 500 000 FCFA' },
  { value: 1_000_000, label: '≤ 1 000 000 FCFA' },
  { value: 2_000_000, label: '≤ 2 000 000 FCFA' },
];

function fmtFcfa(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA';
}

/**
 * Calculateur de coût réel — classe automatiquement toutes les SGI (avec
 * barème connu) par coût total pour un montant / nombre d'ordres / durée
 * donnés, filtrable par pays et par dépôt minimum accessible. Remplace
 * l'ancien mode « sélection manuelle » : un classement filtré est plus utile
 * qu'une comparaison manuelle. Aucun champ inventé (pas de filtre « app
 * mobile »/« ordre en ligne » — aucune donnée vérifiée sur ces critères) ;
 * les taux non renseignés restent signalés, jamais silencieusement à 0.
 */
export function CalculateurCout({
  frais,
  directory,
}: {
  /** Barèmes depuis Supabase (repli sur le TS si non fourni). */
  frais?: SgiFrais[];
  /** Annuaire depuis Supabase (repli sur le TS si non fourni). */
  directory?: Sgi[];
}) {
  const fraisSource = frais ?? SGI_FRAIS_SEED;
  const directoryParNom = useMemo(
    () => new Map((directory ?? SGI_DIRECTORY).map((s) => [s.nom, s])),
    [directory],
  );

  const [montant, setMontant] = useState(1_000_000);
  const [dureeAns, setDureeAns] = useState(1);
  const [nbAchats, setNbAchats] = useState(4);
  const [nbVentes, setNbVentes] = useState(4);
  const [filtrePays, setFiltrePays] = useState<'ALL' | keyof typeof PAYS>('ALL');
  const [depotMax, setDepotMax] = useState(0); // 0 = pas de filtre

  const nbOrdres = nbAchats + nbVentes;

  const filtered = useMemo(
    () =>
      fraisSource.filter((sgi) => {
        const dir = directoryParNom.get(sgi.sgiNom);
        if (filtrePays !== 'ALL' && dir?.pays !== filtrePays) return false;
        if (depotMax !== 0 && (sgi.depotMinimum ?? 0) > depotMax) return false;
        return true;
      }),
    [fraisSource, directoryParNom, filtrePays, depotMax],
  );

  const sgiParNom = useMemo(() => new Map(filtered.map((s) => [s.sgiNom, s])), [filtered]);

  const resultats = useMemo(
    () =>
      filtered
        .map((sgi) => calculerCoutSGI(sgi, { montant, nbOrdres, dureeAns }))
        .sort((a, b) => a.total - b.total),
    [filtered, montant, nbOrdres, dureeAns],
  );

  // SGI de l'annuaire SANS barème public connu : jamais classées (les classer
  // obligerait à inventer leurs frais) — mais toujours signalées explicitement.
  const sansBareme = useMemo(() => {
    const avecBareme = new Set(fraisSource.map((f) => f.sgiNom));
    return (directory ?? SGI_DIRECTORY).filter((d) => !avecBareme.has(d.nom)).map((d) => d.nom);
  }, [directory, fraisSource]);

  const top10 = resultats.slice(0, 10);
  const recommandee = resultats[0] ?? null;
  const seuilRecommandee = useMemo(() => {
    if (!recommandee) return null;
    const sgi = sgiParNom.get(recommandee.sgiNom);
    return sgi ? calculerSeuilRentabilite(sgi, montant) : null;
  }, [recommandee, sgiParNom, montant]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
      {/* Sidebar — paramètres */}
      <div className="space-y-5 rounded-panel border border-white/10 bg-white/[0.02] p-5 lg:sticky lg:top-24">
        <p className="overline text-gold-2">Paramètres</p>

        <label className="block text-xs text-muted">
          Montant investi
          <div className="mt-1 tabular font-display text-2xl text-info">{fmtFcfa(montant)}</div>
          <input
            type="range"
            min={50_000}
            max={10_000_000}
            step={50_000}
            value={montant}
            onChange={(e) => setMontant(Number(e.target.value))}
            className="mt-2 w-full accent-info"
            aria-label="Montant investi en FCFA"
          />
        </label>

        <label className="block text-xs text-muted">
          Durée de détention
          <select
            value={dureeAns}
            onChange={(e) => setDureeAns(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          >
            {DUREE_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted">
          Nombre d&apos;achats
          <select
            value={nbAchats}
            onChange={(e) => setNbAchats(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          >
            {ORDRE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} achat{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted">
          Nombre de ventes
          <select
            value={nbVentes}
            onChange={(e) => setNbVentes(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          >
            {ORDRE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} vente{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted">
          Filtrer par pays
          <select
            value={filtrePays}
            onChange={(e) => setFiltrePays(e.target.value as 'ALL' | keyof typeof PAYS)}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          >
            <option value="ALL">Tous les pays UEMOA</option>
            {Object.entries(PAYS).map(([code, p]) => (
              <option key={code} value={code}>{p.nom}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted">
          Dépôt minimum accessible
          <select
            value={depotMax}
            onChange={(e) => setDepotMax(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          >
            {DEPOT_FILTRES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Résultats */}
      <div className="space-y-5">
        {recommandee ? (
          <>
            <CarteRecommandee
              resultat={recommandee}
              sgi={sgiParNom.get(recommandee.sgiNom)!}
              directory={directoryParNom.get(recommandee.sgiNom) ?? null}
              montant={montant}
              dureeAns={dureeAns}
              seuilPct={seuilRecommandee?.seuilPct ?? null}
            />

            <GraphiqueCoutSGI
              resultats={top10}
              title={resultats.length > 10 ? 'Coût total par SGI (FCFA) — top 10' : 'Coût total par SGI (FCFA)'}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted">Toutes les SGI · triées par coût total</p>
                <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-faint">
                  {resultats.length} SGI
                </span>
              </div>
              <TableauResultatCout
                resultats={resultats}
                sgiParNom={sgiParNom}
                directoryParNom={directoryParNom}
                montant={montant}
              />
            </div>

            {sansBareme.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted">
                  <span className="font-semibold text-ivory">{sansBareme.length} SGI de l&apos;annuaire ne sont pas
                  classées</span> — aucun barème public n&apos;a encore été trouvé pour elles, et nous n&apos;inventons
                  jamais de frais :
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{sansBareme.join(' · ')}</p>
                <p className="mt-1.5 text-[11px] text-faint">
                  Leur fiche reste consultable dans l&apos;annuaire ci-dessous ; demandez-leur le barème écrit avant
                  d&apos;ouvrir un compte.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Aucune SGI ne correspond à ces filtres.
          </p>
        )}
      </div>
    </div>
  );
}

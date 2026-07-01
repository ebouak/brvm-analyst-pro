'use client';

import { useMemo, useState } from 'react';
import { SGI_FRAIS_SEED } from '@/lib/sgi-frais/seed-data';
import { calculerCoutSGI, calculerSeuilRentabilite, estSousDepotMinimum } from '@/lib/sgi-frais/calculateur';
import type { SgiFrais } from '@/lib/sgi-frais/types';
import { TableauResultatCout } from './TableauResultatCout';
import { GraphiqueCoutSGI } from './GraphiqueCoutSGI';
import { CarteRecommandee } from './CarteRecommandee';

const NOMS_SGI = SGI_FRAIS_SEED.map((s) => s.sgiNom);
const SEED_PAR_NOM = new Map(SGI_FRAIS_SEED.map((s) => [s.sgiNom, s]));

const DEPOT_FILTRES = [
  { value: 0, label: 'Tous dépôts' },
  { value: 100_000, label: '≤ 100 000 FCFA' },
  { value: 300_000, label: '≤ 300 000 FCFA' },
  { value: 500_000, label: '≤ 500 000 FCFA' },
  { value: 1_000_000, label: '≤ 1 000 000 FCFA' },
  { value: 2_000_000, label: '≤ 2 000 000 FCFA' },
];

/** Champs numériques éditables par l'utilisateur (bascule le badge de confiance). */
type ChampEditable = 'courtagePctMax' | 'droitsGardePctMax' | 'tenueCompteMontant' | 'fraisVirement';

const CHAMPS: { key: ChampEditable; label: string; suffix: string }[] = [
  { key: 'courtagePctMax', label: 'Courtage (%)', suffix: '%' },
  { key: 'droitsGardePctMax', label: 'Droits de garde (%/an)', suffix: '%' },
  { key: 'tenueCompteMontant', label: 'Tenue de compte (FCFA/an)', suffix: 'FCFA' },
  { key: 'fraisVirement', label: 'Frais de virement (FCFA)', suffix: 'FCFA' },
];

/**
 * Calculateur de coût réel — sélection de 2 à 4 SGI, montant, nombre
 * d'ordres, durée. Les champs sont pré-remplis avec la donnée agrégée
 * publique (seed) mais restent modifiables ; toute modification bascule
 * automatiquement le badge de cette SGI vers « estimation saisie par vous ».
 */
export function CalculateurCout() {
  const [selection, setSelection] = useState<string[]>(['SOGEBOURSE', 'BICI Bourse']);
  const [montant, setMontant] = useState(1_000_000);
  const [nbOrdres, setNbOrdres] = useState(4);
  const [dureeAns, setDureeAns] = useState(1);
  const [depotMax, setDepotMax] = useState(0); // 0 = pas de filtre
  // Surcharges utilisateur par SGI (bascule confiance -> 'saisie_utilisateur' pour le champ modifié).
  const [overrides, setOverrides] = useState<Record<string, Partial<Record<ChampEditable, number>>>>({});

  function toggleSgi(nom: string) {
    setSelection((prev) => {
      if (prev.includes(nom)) return prev.filter((n) => n !== nom);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, nom];
    });
  }

  function setOverride(nom: string, champ: ChampEditable, value: number | null) {
    setOverrides((prev) => {
      const next = { ...prev, [nom]: { ...prev[nom] } };
      if (value == null || Number.isNaN(value)) delete next[nom][champ];
      else next[nom][champ] = value;
      return next;
    });
  }

  const sgiEffectifs = useMemo<Map<string, SgiFrais>>(() => {
    const map = new Map<string, SgiFrais>();
    for (const nom of selection) {
      const seed = SEED_PAR_NOM.get(nom);
      if (!seed) continue;
      const ov = overrides[nom] ?? {};
      const hasOverride = Object.keys(ov).length > 0;
      map.set(nom, {
        ...seed,
        ...ov,
        confiance: hasOverride ? 'saisie_utilisateur' : seed.confiance,
      });
    }
    return map;
  }, [selection, overrides]);

  const resultats = useMemo(
    () =>
      [...sgiEffectifs.values()].map((sgi) => calculerCoutSGI(sgi, { montant, nbOrdres, dureeAns })),
    [sgiEffectifs, montant, nbOrdres, dureeAns],
  );

  return (
    <div className="space-y-5">
      {/* Paramètres */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-xs text-muted">
          Montant à investir (FCFA)
          <input
            type="number"
            min={0}
            step={50_000}
            value={montant}
            onChange={(e) => setMontant(Math.max(0, Number(e.target.value)))}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          />
        </label>
        <label className="block text-xs text-muted">
          Nombre d&apos;ordres sur l&apos;année
          <input
            type="number"
            min={1}
            value={nbOrdres}
            onChange={(e) => setNbOrdres(Math.max(1, Number(e.target.value)))}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          />
        </label>
        <label className="block text-xs text-muted">
          Durée de détention (ans)
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={dureeAns}
            onChange={(e) => setDureeAns(Math.max(0.5, Number(e.target.value)))}
            className="mt-1 w-full rounded-lg border border-border bg-bg/40 p-2 text-sm text-ivory"
          />
        </label>
      </div>

      {/* Filtre dépôt minimum */}
      <label className="block max-w-xs text-xs text-muted">
        Dépôt minimum max.
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

      {/* Sélection des SGI (2 à 4) */}
      <div>
        <p className="mb-2 text-xs text-muted">Sélectionnez 2 à 4 SGI à comparer</p>
        <div className="flex flex-wrap gap-2">
          {NOMS_SGI.map((nom) => {
            const active = selection.includes(nom);
            const seed = SEED_PAR_NOM.get(nom);
            const eligible = depotMax === 0 || (seed?.depotMinimum ?? 0) <= depotMax;
            return (
              <button
                key={nom}
                type="button"
                onClick={() => toggleSgi(nom)}
                disabled={!eligible && !active}
                aria-pressed={active ? 'true' : 'false'}
                title={!eligible ? `Dépôt minimum ${seed?.depotMinimum?.toLocaleString('fr-FR')} FCFA — au-delà du filtre` : undefined}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? 'border-info bg-info/10 text-info'
                    : eligible
                      ? 'border-border text-muted hover:text-white'
                      : 'border-border/40 text-faint/50 cursor-not-allowed'
                }`}
              >
                {nom}
              </button>
            );
          })}
        </div>
      </div>

      {/* Champs éditables par SGI sélectionnée */}
      {selection.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {selection.map((nom) => {
            const seed = SEED_PAR_NOM.get(nom);
            if (!seed) return null;
            const ov = overrides[nom] ?? {};
            const sousDepotMin = estSousDepotMinimum(seed, montant);
            return (
              <div key={nom} className="rounded-xl border border-border bg-surface p-4 space-y-2">
                <p className="text-sm font-medium text-white">{nom}</p>
                {sousDepotMin && (
                  <p className="rounded border border-warn/30 bg-warn/10 px-2 py-1 text-[11px] text-warn">
                    ⚠ Montant inférieur au dépôt minimum de cette SGI ({seed.depotMinimum?.toLocaleString('fr-FR')} FCFA)
                  </p>
                )}
                {CHAMPS.map((c) => {
                  const seedVal = seed[c.key];
                  const value = ov[c.key] ?? seedVal ?? '';
                  return (
                    <label key={c.key} className="block text-[11px] text-faint">
                      {c.label}
                      <input
                        type="number"
                        step="any"
                        value={value}
                        placeholder={seedVal == null ? 'Non publié — renseignez si connu' : undefined}
                        onChange={(e) => {
                          const v = e.target.value === '' ? null : Number(e.target.value);
                          setOverride(nom, c.key, v);
                        }}
                        className="mt-0.5 w-full rounded border border-border bg-bg/40 p-1.5 text-xs text-ivory placeholder:text-faint"
                      />
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Résultat */}
      {selection.length >= 2 ? (
        <>
          <CarteRecommandee resultats={resultats} sgiParNom={sgiEffectifs} montant={montant} />
          <GraphiqueCoutSGI resultats={resultats} />
          <TableauResultatCout resultats={resultats} sgiParNom={sgiEffectifs} />

          {/* Seuil de rentabilité (aller-retour simple, hors frais de détention) */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="mb-2 text-xs text-muted">
              Seuil de rentabilité — hausse du cours nécessaire pour qu&apos;un aller-retour (1 achat + 1 vente) soit
              à l&apos;équilibre, hors frais de détention (garde, tenue de compte).
            </p>
            <div className="flex flex-wrap gap-3">
              {[...sgiEffectifs.values()].map((sgi) => {
                const seuil = calculerSeuilRentabilite(sgi, montant);
                return (
                  <div key={sgi.sgiNom} className="rounded-lg border border-border bg-bg/40 px-3 py-2 text-xs">
                    <span className="text-muted">{sgi.sgiNom} : </span>
                    <span className="tabular font-semibold text-white">+{seuil.seuilPct.toFixed(2)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Sélectionnez au moins 2 SGI pour lancer la comparaison.
        </p>
      )}
    </div>
  );
}

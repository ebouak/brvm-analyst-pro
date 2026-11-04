'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { SGI_FRAIS_SEED } from '@/lib/sgi-frais/seed-data';
import { baremeComplet, calculerCoutSGI, calculerSeuilRentabilite, classerResultats, montantParOrdreParDefaut } from '@/lib/sgi-frais/calculateur';
import { PAYS, SGI_DIRECTORY, type Sgi } from '@/lib/sgi-frais/directory';
import type { SgiFrais } from '@/lib/sgi-frais/types';
import { TableauResultatCout } from './TableauResultatCout';
import { ClassementCout } from './ClassementCout';
import { CarteRecommandee } from './CarteRecommandee';
import { ChiffreAnime } from './ChiffreAnime';

const DUREE_OPTIONS = [
  { value: 0.25, label: '3 mois' },
  { value: 0.5, label: '6 mois' },
  { value: 1, label: '1 an' },
  { value: 2, label: '2 ans' },
  { value: 3, label: '3 ans' },
  { value: 5, label: '5 ans' },
];

const MONTANTS_RAPIDES = [
  { value: 100_000, label: '100 k' },
  { value: 500_000, label: '500 k' },
  { value: 1_000_000, label: '1 M' },
  { value: 5_000_000, label: '5 M' },
];

const ORDRES_MAX = 12;

const DEPOT_FILTRES = [
  { value: 0, label: 'Tous dépôts' },
  { value: 100_000, label: '≤ 100 000 FCFA' },
  { value: 300_000, label: '≤ 300 000 FCFA' },
  { value: 500_000, label: '≤ 500 000 FCFA' },
  { value: 1_000_000, label: '≤ 1 000 000 FCFA' },
  { value: 2_000_000, label: '≤ 2 000 000 FCFA' },
];

const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const fmtNombre = (n: number) => Math.round(n).toLocaleString('fr-FR');

/** Pastille de choix rapide (montant, durée) — état lisible par les lecteurs d'écran. */
function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors active:scale-95 ${
        actif ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:border-accent/40 hover:text-ivory'
      }`}
    >
      {children}
    </button>
  );
}

/** Compteur − n + : plus rapide qu'une liste déroulante de 13 valeurs, surtout au doigt. */
function Compteur({ libelle, unite, valeur, onChange }: { libelle: string; unite: [string, string]; valeur: number; onChange: (n: number) => void }) {
  const bouton =
    'flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border text-lg text-ivory transition-colors hover:border-accent/50 hover:text-accent active:scale-90 disabled:opacity-30 disabled:hover:border-border disabled:hover:text-ivory';
  return (
    <div>
      <p className="text-xs text-muted" id={`compteur-${unite[0]}`}>{libelle}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2" role="group" aria-labelledby={`compteur-${unite[0]}`}>
        <button type="button" className={bouton} onClick={() => onChange(valeur - 1)} disabled={valeur <= 0} aria-label={`Retirer un ${unite[0]}`}>
          −
        </button>
        <output className="tabular text-sm text-ivory" aria-live="polite">
          {valeur} {valeur > 1 ? unite[1] : unite[0]}
        </output>
        <button type="button" className={bouton} onClick={() => onChange(valeur + 1)} disabled={valeur >= ORDRES_MAX} aria-label={`Ajouter un ${unite[0]}`}>
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Calculateur de coût réel — classe automatiquement toutes les SGI (avec
 * barème connu) par coût total pour un montant / nombre d'ordres / durée
 * donnés, filtrable par pays et par dépôt minimum accessible. Aucun champ
 * inventé ; les taux non renseignés restent signalés, jamais silencieusement
 * à 0. Chaque réglage recalcule le classement à l'instant, et le mouvement
 * (chiffres, barres, rangs) montre ce qui a changé.
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
  const [tableau, setTableau] = useState(false);

  const nbOrdres = nbAchats + nbVentes;
  // Courtage et frais BRVM portent sur chaque ordre, la garde sur le capital :
  // compter chaque ordre sur tout le capital simulait 8 M FCFA échangés pour
  // 1 M investi. Saisie libre, sinon capital réparti sur les achats.
  const [montantOrdreSaisi, setMontantOrdreSaisi] = useState<number | null>(null);
  const montantParOrdre = montantOrdreSaisi ?? montantParOrdreParDefaut(montant, nbAchats);

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
      // Barèmes complets d'abord : un poste inconnu compte 0 dans le total.
      classerResultats(filtered.map((sgi) => calculerCoutSGI(sgi, { montant, montantParOrdre, nbOrdres, dureeAns }))),
    [filtered, montant, montantParOrdre, nbOrdres, dureeAns],
  );

  // SGI de l'annuaire SANS barème public connu : jamais classées (les classer
  // obligerait à inventer leurs frais) — mais toujours signalées explicitement.
  const sansBareme = useMemo(() => {
    const avecBareme = new Set(fraisSource.map((f) => f.sgiNom));
    return (directory ?? SGI_DIRECTORY).filter((d) => !avecBareme.has(d.nom)).map((d) => d.nom);
  }, [directory, fraisSource]);

  // Jamais une SGI dont un poste essentiel est inconnu : son total serait
  // faussement bas.
  const recommandee = resultats.find(baremeComplet) ?? null;
  const seuilRecommandee = useMemo(() => {
    if (!recommandee) return null;
    const sgi = sgiParNom.get(recommandee.sgiNom);
    // Aller-retour d'un ordre type : un minimum de perception pèse plus sur un petit ordre.
    return sgi ? calculerSeuilRentabilite(sgi, montantParOrdre) : null;
  }, [recommandee, sgiParNom, montantParOrdre]);

  const filtresActifs = (filtrePays !== 'ALL' ? 1 : 0) + (depotMax !== 0 ? 1 : 0);

  return (
    // « user » : framer coupe déplacements et transformations quand le
    // système demande moins d'animations, sans rendu serveur différent.
    <MotionConfig reducedMotion="user">
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
      {/* Panneau — réglages */}
      <div className="rounded-panel border border-border bg-surface/60 p-5 lg:sticky lg:top-24">
        <p className="overline mb-4 text-gold-2">Votre scénario</p>

        <div className="space-y-5">
          {/* Montant */}
          <div>
            <label htmlFor="calc-montant" className="text-xs text-muted">Montant investi</label>
            <div className="tabular mt-1 font-display text-2xl text-accent">{fmtFcfa(montant)}</div>
            <input
              id="calc-montant"
              type="range"
              min={50_000}
              max={10_000_000}
              step={50_000}
              value={montant}
              onChange={(e) => setMontant(Number(e.target.value))}
              className="mt-2 w-full accent-accent"
              aria-valuetext={fmtFcfa(montant)}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MONTANTS_RAPIDES.map((m) => (
                <Pastille key={m.value} actif={montant === m.value} onClick={() => setMontant(m.value)}>
                  {m.label}
                </Pastille>
              ))}
            </div>
          </div>

          {/* Durée */}
          <div>
            <p className="text-xs text-muted" id="calc-duree">Durée de détention</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-labelledby="calc-duree">
              {DUREE_OPTIONS.map((d) => (
                <Pastille key={d.value} actif={dureeAns === d.value} onClick={() => setDureeAns(d.value)}>
                  {d.label}
                </Pastille>
              ))}
            </div>
          </div>

          {/* Ordres */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Compteur libelle="Achats sur la période" unite={['achat', 'achats']} valeur={nbAchats} onChange={setNbAchats} />
            <Compteur libelle="Ventes sur la période" unite={['vente', 'ventes']} valeur={nbVentes} onChange={setNbVentes} />
          </div>

          {/* Montant par ordre */}
          <div>
            <label htmlFor="calc-ordre" className="text-xs text-muted">Montant moyen par ordre</label>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-bg/40 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
              <input
                id="calc-ordre"
                type="text"
                inputMode="numeric"
                value={fmtNombre(montantParOrdre)}
                onChange={(e) => {
                  const chiffres = e.target.value.replace(/\D/g, '');
                  setMontantOrdreSaisi(chiffres === '' ? null : Number(chiffres));
                }}
                className="tabular w-full bg-transparent p-2 text-sm text-ivory outline-none"
                aria-describedby="aide-montant-ordre"
              />
              <span className="pr-3 text-xs text-faint">FCFA</span>
            </div>
            <p id="aide-montant-ordre" className="mt-1 text-[11px] text-faint">
              {montantOrdreSaisi == null ? (
                <>Calculé : montant investi ÷ nombre d&apos;achats.</>
              ) : (
                <button type="button" onClick={() => setMontantOrdreSaisi(null)} className="text-accent hover:underline">
                  Revenir au calcul automatique
                </button>
              )}
            </p>
          </div>

          {/* Filtres secondaires */}
          <details className="group border-t border-border pt-4" open={filtresActifs > 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs text-muted hover:text-ivory">
              <span>
                Affiner la liste
                {filtresActifs > 0 && <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 text-[10px] text-accent">{filtresActifs}</span>}
              </span>
              <span aria-hidden className="transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-muted">
                Pays de la SGI
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
          </details>
        </div>

        {/* Mobile : le résultat reste en vue pendant qu'on règle le scénario. */}
        {recommandee && (
          <a
            href="#resultats-cout"
            className="sticky bottom-3 z-10 mt-5 flex items-center justify-between gap-3 rounded-xl border border-up/30 bg-bg/95 px-4 py-3 shadow-lg backdrop-blur lg:hidden"
          >
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wide text-faint">La moins chère</span>
              <span className="block truncate text-sm font-medium text-ivory">{recommandee.sgiNom}</span>
            </span>
            <span className="flex flex-none items-center gap-2">
              <ChiffreAnime valeur={recommandee.total} format={fmtFcfa} className="tabular whitespace-nowrap text-sm font-semibold text-up" />
              <span aria-hidden className="text-accent">↓</span>
            </span>
          </a>
        )}
      </div>

      {/* Résultats */}
      <div id="resultats-cout" className="scroll-mt-24 space-y-5">
        {recommandee ? (
          <>
            {/* Pas d'animation d'entrée : rendue à opacity 0 côté serveur, la
                carte resterait invisible sans JavaScript. */}
            <CarteRecommandee
              resultat={recommandee}
              sgi={sgiParNom.get(recommandee.sgiNom)!}
              directory={directoryParNom.get(recommandee.sgiNom) ?? null}
              montant={montant}
              dureeAns={dureeAns}
              seuilPct={seuilRecommandee?.seuilPct ?? null}
            />

            <ClassementCout resultats={resultats} sgiParNom={sgiParNom} directoryParNom={directoryParNom} />

            {/* Tableau complet : utile pour comparer les taux, mais long — replié. */}
            <div className="hidden md:block">
              <button
                type="button"
                onClick={() => setTableau((v) => !v)}
                aria-expanded={tableau}
                aria-controls="tableau-cout"
                className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-xs text-muted transition-colors hover:border-accent/40 hover:text-ivory"
              >
                <span>Tableau détaillé : pays, dépôt minimum, courtage, conservation</span>
                <span aria-hidden className={`transition-transform ${tableau ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              {tableau && (
                <div id="tableau-cout" className="mt-3">
                  <TableauResultatCout
                    resultats={resultats}
                    sgiParNom={sgiParNom}
                    directoryParNom={directoryParNom}
                    montant={montant}
                  />
                </div>
              )}
            </div>

            <p className="text-[11px] leading-relaxed text-faint">
              Tarifs hors taxes : les barèmes homologués sont exprimés HT, et les taxes sur les commissions
              s&apos;ajoutent sur l&apos;avis d&apos;opéré. Commissions BRVM (0,2 %) et DC/BR (0,1 %) incluses, à
              l&apos;achat comme à la vente. Courtage et commissions sont comptés sur le montant moyen par ordre,
              la garde sur le montant investi.
            </p>

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
          <div className="rounded-panel border border-border bg-surface p-8 text-center">
            <p className="text-sm text-muted">Aucune SGI ne correspond à ces filtres.</p>
            <button
              type="button"
              onClick={() => {
                setFiltrePays('ALL');
                setDepotMax(0);
              }}
              className="mt-3 text-xs font-semibold text-accent hover:underline"
            >
              Retirer les filtres
            </button>
          </div>
        )}
      </div>
    </div>
    </MotionConfig>
  );
}

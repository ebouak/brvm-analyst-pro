'use client';

import { useEffect, useId, useState } from 'react';
import type { Simulation } from '@/lib/academy/types';
import {
  executerOrdre,
  executerOrdreVente,
  VALIDITES,
  type ConditionOrdre,
  type LimiteOrdre,
  type NiveauCarnet,
  type ResultatOrdre,
  type ValiditeOrdre,
} from '@/lib/academy/carnet';
import { carnetDepuisLigne, type LigneCarnetReel } from '@/lib/academy/carnetReel';
import { fcfa, lectureFixing, nombre } from '@/lib/academy/risques';
import { dateSeanceLongue } from '@/components/CarnetOrdres';

type ModeLimite = 'au_mieux' | 'limite' | 'aucune';
type SourceCarnet = 'fictif' | 'reel';
type ModeMarche = 'continu' | 'fixing';
type SensOrdre = 'achat' | 'vente';

type EtatReel =
  | { etat: 'repos' }
  | { etat: 'chargement' }
  | { etat: 'erreur' }
  | { etat: 'vide' }
  | { etat: 'pret'; ligne: LigneCarnetReel };

const ACHAT_DEFAUT: NiveauCarnet[] = [
  { prix: 3270, quantite: 2200 },
  { prix: 3260, quantite: 3400 },
  { prix: 3250, quantite: 4800 },
];

interface ScenarioGuide {
  id: string;
  label: string;
  sens: SensOrdre;
  quantite: string;
  modeLimite: ModeLimite;
  prixLimite: string;
  condition: ConditionOrdre;
  validite: ValiditeOrdre;
  modeMarche: ModeMarche;
}

const SCENARIOS_GUIDES: ScenarioGuide[] = [
  {
    id: 'atelier-5000',
    label: '5 000 actions au mieux (cas de la leçon)',
    sens: 'achat',
    quantite: '5000',
    modeLimite: 'au_mieux',
    prixLimite: '3280',
    condition: 'sans',
    validite: 'jour',
    modeMarche: 'continu',
  },
  {
    id: 'limite-3270',
    label: 'Achat limité à 3 270 FCFA',
    sens: 'achat',
    quantite: '5000',
    modeLimite: 'limite',
    prixLimite: '3270',
    condition: 'sans',
    validite: 'mensuel',
    modeMarche: 'continu',
  },
  {
    id: 'tor-10000',
    label: 'Tout ou rien : 10 000 titres à 3 290 FCFA',
    sens: 'achat',
    quantite: '10000',
    modeLimite: 'limite',
    prixLimite: '3290',
    condition: 'tout_ou_rien',
    validite: 'jour',
    modeMarche: 'continu',
  },
  {
    id: 'vente-4000',
    label: 'Vendre 4 000 titres au mieux',
    sens: 'vente',
    quantite: '4000',
    modeLimite: 'au_mieux',
    prixLimite: '3270',
    condition: 'sans',
    validite: 'jour',
    modeMarche: 'continu',
  },
  {
    id: 'fixing-5000',
    label: 'Même ordre au fixing',
    sens: 'achat',
    quantite: '5000',
    modeLimite: 'limite',
    prixLimite: '3290',
    condition: 'sans',
    validite: 'jour',
    modeMarche: 'fixing',
  },
];

export default function AtelierOrdresBrvm({
  sim,
}: {
  sim: Extract<Simulation, { type: 'carnet' }>;
}) {
  const id = useId();
  const [source, setSource] = useState<SourceCarnet>('fictif');
  const [modeMarche, setModeMarche] = useState<ModeMarche>('continu');
  const [code, setCode] = useState(sim.codes[0] ?? 'SNTS');
  const [reel, setReel] = useState<EtatReel>({ etat: 'repos' });

  const [sens, setSens] = useState<SensOrdre>('achat');
  const [quantite, setQuantite] = useState(String(sim.quantite_defaut));
  const [modeLimite, setModeLimite] = useState<ModeLimite>('au_mieux');
  const [prixLimite, setPrixLimite] = useState(String(sim.niveaux[0]?.prix ?? 3280));
  const [condition, setCondition] = useState<ConditionOrdre>('sans');
  const [validite, setValidite] = useState<ValiditeOrdre>('jour');
  const [scenarioActif, setScenarioActif] = useState<string>('atelier-5000');

  useEffect(() => {
    if (source !== 'reel' || !code) return;
    const ctrl = new AbortController();
    setReel({ etat: 'chargement' });
    fetch(`/api/academy/carnet?code=${encodeURIComponent(code)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { carnet: LigneCarnetReel | null };
        setReel(j.carnet ? { etat: 'pret', ligne: j.carnet } : { etat: 'vide' });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== 'AbortError') setReel({ etat: 'erreur' });
      });
    return () => ctrl.abort();
  }, [source, code]);

  // En mode carnet réel BOC, seul l'achat face à la meilleure offre publiée est documenté
  useEffect(() => {
    if (source === 'reel' && sens === 'vente') setSens('achat');
  }, [source, sens]);

  const niveauxVenteFictifs: NiveauCarnet[] = sim.niveaux;
  const niveauxAchatFictifs: NiveauCarnet[] =
    sim.niveaux_achat && sim.niveaux_achat.length > 0 ? sim.niveaux_achat : ACHAT_DEFAUT;

  const carnetReel = reel.etat === 'pret' && source === 'reel' ? carnetDepuisLigne(reel.ligne) : null;
  const ligneReelle = reel.etat === 'pret' && source === 'reel' ? reel.ligne : null;

  const niveauxVente: NiveauCarnet[] = source === 'fictif' ? niveauxVenteFictifs : (carnetReel?.niveaux ?? []);
  const niveauxAchat: NiveauCarnet[] =
    source === 'fictif'
      ? niveauxAchatFictifs
      : ligneReelle &&
          ligneReelle.qte_achat != null &&
          ligneReelle.qte_achat > 0 &&
          (ligneReelle.achat_au_marche || (ligneReelle.cours_achat != null && ligneReelle.cours_achat > 0))
        ? [{ prix: ligneReelle.achat_au_marche ? null : ligneReelle.cours_achat, quantite: ligneReelle.qte_achat }]
        : [];

  const pret = source === 'fictif' || carnetReel !== null;

  const qteTrim = quantite.trim().replace(/\s/g, '');
  const qteNum = /^\d+$/.test(qteTrim) ? Number(qteTrim) : NaN;
  const prixNum = Number(prixLimite.replace(/\s/g, '').replace(',', '.'));
  const limite: LimiteOrdre =
    modeLimite === 'au_mieux'
      ? 'au_mieux'
      : modeLimite === 'limite' && prixLimite.trim() !== ''
        ? { prix: prixNum }
        : null;

  // Calcul synchrone à chaque paramètre valide (ou affichage clair de l'erreur de saisie)
  let resultatContinu: ResultatOrdre | null = null;
  let resultatFixing: ReturnType<typeof lectureFixing> | null = null;
  let erreurValidation: string | null = null;

  if (qteTrim === '') {
    erreurValidation = 'Renseignez une quantité entière de titres (ex. 5 000).';
  } else if (!Number.isInteger(qteNum) || qteNum <= 0) {
    erreurValidation = 'La quantité doit être un nombre entier strictement positif.';
  } else if (qteNum > 1_000_000) {
    erreurValidation = 'Quantité limitée à 1 000 000 de titres dans cet atelier pédagogique.';
  } else if (modeLimite === 'limite' && (prixLimite.trim() === '' || !Number.isFinite(prixNum) || prixNum <= 0)) {
    erreurValidation = 'Indiquez un cours limité supérieur à 0 FCFA.';
  } else if (pret) {
    if (modeLimite === 'aucune') {
      resultatContinu = executerOrdre(niveauxVente, {
        sens: 'achat',
        quantite: qteNum,
        limite: null,
        condition,
        validite,
      });
    } else if (modeMarche === 'fixing') {
      const face = sens === 'achat' ? niveauxVente : niveauxAchat;
      resultatFixing = lectureFixing(face, { sens, quantite: qteNum, limite, condition });
    } else if (sens === 'achat') {
      resultatContinu = executerOrdre(
        niveauxVente,
        { sens: 'achat', quantite: qteNum, limite, condition, validite },
        { profondeurInconnue: source === 'reel' },
      );
    } else {
      resultatContinu = executerOrdreVente(niveauxAchat, {
        sens: 'vente',
        quantite: qteNum,
        limite,
        condition,
        validite,
      });
    }
  }

  const maxQteCarnet = Math.max(
    1,
    ...niveauxVente.map((n) => n.quantite),
    ...niveauxAchat.map((n) => n.quantite),
  );

  const quantiteServieAuPrix = (cote: 'achat' | 'vente', prix: number | null): number => {
    if (!resultatContinu || prix == null) return 0;
    if ((sens === 'achat' && cote !== 'vente') || (sens === 'vente' && cote !== 'achat')) return 0;
    return resultatContinu.lignes.find((l) => l.prix === prix)?.quantite ?? 0;
  };

  function appliquerScenario(sc: ScenarioGuide) {
    setSource('fictif');
    setScenarioActif(sc.id);
    setSens(sc.sens);
    setQuantite(sc.quantite);
    setModeLimite(sc.modeLimite);
    setPrixLimite(sc.prixLimite);
    setCondition(sc.condition);
    setValidite(sc.validite);
    setModeMarche(sc.modeMarche);
  }

  const meilleurAchat = niveauxAchat.find((n) => n.prix != null)?.prix ?? null;
  const meilleurVente = niveauxVente.find((n) => n.prix != null)?.prix ?? null;
  const ecartFourchette =
    meilleurAchat != null && meilleurVente != null && meilleurVente >= meilleurAchat
      ? meilleurVente - meilleurAchat
      : null;

  return (
    <div className="l7-sim-shell">
      <div className="l7-sim-inner">
        <div className="l7-sim-header">
          <div>
            <span className="l7-eyebrow">Atelier interactif · Règlement général BRVM (art. 44 à 46)</span>
            <h3 className="l7-sim-title">Simulateur de passage d’ordres BRVM</h3>
          </div>
          <span className={`lp-badge${source === 'reel' ? ' lp-badge--reel' : ''}`}>
            {source === 'fictif' ? 'Simulation pédagogique (carnet fictif)' : 'Meilleure limite publiée (BOC BRVM)'}
          </span>
        </div>

        {/* Barre de réglages de marché + scénarios rapides */}
        <div className="l7-toolbar">
          <div className="l7-seg-group" role="group" aria-label="Source du carnet">
            <button
              type="button"
              className={`l7-seg-btn${source === 'fictif' ? ' is-active' : ''}`}
              onClick={() => setSource('fictif')}
            >
              Carnet pédagogique
            </button>
            {sim.codes.length > 0 && (
              <button
                type="button"
                className={`l7-seg-btn${source === 'reel' ? ' is-active' : ''}`}
                onClick={() => {
                  setSource('reel');
                  setScenarioActif('');
                }}
              >
                Carnet réel BOC
              </button>
            )}
          </div>

          <div className="l7-seg-group" role="group" aria-label="Mécanisme de cotation">
            <button
              type="button"
              className={`l7-seg-btn${modeMarche === 'continu' ? ' is-active' : ''}`}
              onClick={() => {
                setModeMarche('continu');
                setScenarioActif('');
              }}
            >
              Marché continu
            </button>
            <button
              type="button"
              className={`l7-seg-btn${modeMarche === 'fixing' ? ' is-active' : ''}`}
              onClick={() => {
                setModeMarche('fixing');
                setScenarioActif('');
              }}
            >
              Fixing (cours unique)
            </button>
          </div>

          {source === 'reel' && (
            <div className="l7-inline-select">
              <label htmlFor={`${id}-valeur`}>Valeur BRVM :</label>
              <select id={`${id}-valeur`} value={code} onChange={(e) => setCode(e.target.value)}>
                {sim.codes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {source === 'fictif' && (
          <div className="l7-presets" aria-label="Mises en situation guidées">
            <span className="l7-presets-label">Tester un cas concret :</span>
            <div className="l7-presets-list">
              {SCENARIOS_GUIDES.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  className={`l7-preset-chip${scenarioActif === sc.id ? ' is-active' : ''}`}
                  onClick={() => appliquerScenario(sc)}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grille 3 colonnes : A. Carnet | B. Formulaire | C. Résultat */}
        <div className="l7-order-grid">
          {/* COLONNE A — CARNET D'ORDRES */}
          <section className="l7-order-col l7-order-book" aria-labelledby={`${id}-col-a`}>
            <div className="l7-col-head">
              <span className="l7-col-step">A</span>
              <div>
                <h4 id={`${id}-col-a`} className="l7-col-title">
                  Carnet d’ordres
                </h4>
                <p className="l7-col-sub">
                  {source === 'fictif'
                    ? 'Offres et demandes affichées en séance (données fictives)'
                    : ligneReelle
                      ? `${ligneReelle.designation ?? ligneReelle.code} (${ligneReelle.code})`
                      : 'Lecture du Bulletin officiel de la cote'}
                </p>
              </div>
            </div>

            {source === 'reel' && reel.etat === 'chargement' && (
              <p className="l7-state-msg" role="status">
                Lecture du carnet publié à la clôture…
              </p>
            )}
            {source === 'reel' && reel.etat === 'erreur' && (
              <p className="l7-state-msg l7-state-msg--error" role="alert">
                Le carnet réel est momentanément indisponible. Revenez au carnet pédagogique pour poursuivre l’exercice.
              </p>
            )}
            {source === 'reel' && reel.etat === 'vide' && (
              <p className="l7-state-msg" role="status">
                Aucun carnet publié pour cette valeur. Testez une autre valeur ou le carnet pédagogique.
              </p>
            )}

            {pret && (
              <>
                {/* Côté Vendeurs (Offre) */}
                <div className="l7-book-half">
                  <div className="l7-book-caption l7-book-caption--ask">
                    <span>Vendeurs (offre)</span>
                    <span>{sens === 'achat' ? 'En face de votre achat' : 'Prix demandés'}</span>
                  </div>
                  <table className="l7-book-table">
                    <thead>
                      <tr>
                        <th scope="col">Prix vendeur</th>
                        <th scope="col" className="l7-num">
                          Quantité vendeuse
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {niveauxVente.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="l7-book-empty">
                            Aucun vendeur affiché à la clôture.
                          </td>
                        </tr>
                      ) : (
                        [...niveauxVente]
                          .sort((a, b) => (b.prix ?? 0) - (a.prix ?? 0))
                          .map((n, idx) => {
                            const pris = modeMarche === 'continu' ? quantiteServieAuPrix('vente', n.prix) : 0;
                            const pctBar = Math.round((n.quantite / maxQteCarnet) * 100);
                            return (
                              <tr key={idx} className={pris > 0 ? 'is-matched' : undefined}>
                                <td className="l7-book-price l7-book-price--ask">
                                  <span
                                    className="l7-depth-bar l7-depth-bar--ask"
                                    style={{ width: `${pctBar}%` }}
                                    aria-hidden="true"
                                  />
                                  <span className="l7-book-cell-text">
                                    {n.prix == null ? 'Au marché' : fcfa(n.prix)}
                                  </span>
                                </td>
                                <td className="l7-num">
                                  <span className="l7-book-cell-text">
                                    {nombre(n.quantite, 0)}
                                    {pris > 0 && (
                                      <small className="l7-matched-tag">dont {nombre(pris, 0)} servis</small>
                                    )}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Écart achat / vente */}
                <div className="l7-spread-bar">
                  <span>Écart acheteur / vendeur</span>
                  <strong>
                    {ecartFourchette != null ? `${nombre(ecartFourchette, 0)} FCFA` : 'Meilleure limite seule'}
                  </strong>
                </div>

                {/* Côté Acheteurs (Demande) */}
                <div className="l7-book-half">
                  <div className="l7-book-caption l7-book-caption--bid">
                    <span>Acheteurs (demande)</span>
                    <span>{sens === 'vente' ? 'En face de votre vente' : 'Prix offerts'}</span>
                  </div>
                  <table className="l7-book-table">
                    <thead>
                      <tr>
                        <th scope="col">Prix acheteur</th>
                        <th scope="col" className="l7-num">
                          Quantité acheteuse
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {niveauxAchat.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="l7-book-empty">
                            Aucun acheteur affiché à la clôture.
                          </td>
                        </tr>
                      ) : (
                        [...niveauxAchat]
                          .sort((a, b) => (b.prix ?? 0) - (a.prix ?? 0))
                          .map((n, idx) => {
                            const pris = modeMarche === 'continu' ? quantiteServieAuPrix('achat', n.prix) : 0;
                            const pctBar = Math.round((n.quantite / maxQteCarnet) * 100);
                            return (
                              <tr key={idx} className={pris > 0 ? 'is-matched' : undefined}>
                                <td className="l7-book-price l7-book-price--bid">
                                  <span
                                    className="l7-depth-bar l7-depth-bar--bid"
                                    style={{ width: `${pctBar}%` }}
                                    aria-hidden="true"
                                  />
                                  <span className="l7-book-cell-text">
                                    {n.prix == null ? 'Au marché' : fcfa(n.prix)}
                                  </span>
                                </td>
                                <td className="l7-num">
                                  <span className="l7-book-cell-text">
                                    {nombre(n.quantite, 0)}
                                    {pris > 0 && (
                                      <small className="l7-matched-tag">dont {nombre(pris, 0)} servis</small>
                                    )}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>

                {source === 'reel' && ligneReelle && (
                  <p className="l7-micro-note">
                    Clôture du {dateSeanceLongue(ligneReelle.date_marche)} (BOC BRVM). Seule la meilleure limite est
                    publiée : la profondeur au-delà est inconnue et n’est jamais supposée exécutée.
                  </p>
                )}
              </>
            )}
          </section>

          {/* COLONNE B — FORMULAIRE D'ORDRE */}
          <section className="l7-order-col l7-order-form" aria-labelledby={`${id}-col-b`}>
            <div className="l7-col-head">
              <span className="l7-col-step">B</span>
              <div>
                <h4 id={`${id}-col-b`} className="l7-col-title">
                  Formulaire d’ordre
                </h4>
                <p className="l7-col-sub">Renseignez les paramètres transmis à votre SGI</p>
              </div>
            </div>

            <div className="l7-field-stack">
              {/* Sens */}
              <div className="l7-field">
                <span className="l7-label">Sens de l’opération</span>
                <div className="l7-toggle-pair" role="group" aria-label="Sens de l'ordre">
                  <button
                    type="button"
                    className={`l7-sens-btn l7-sens-btn--buy${sens === 'achat' ? ' is-active' : ''}`}
                    onClick={() => {
                      setSens('achat');
                      setScenarioActif('');
                    }}
                  >
                    Achat
                  </button>
                  <button
                    type="button"
                    disabled={source === 'reel'}
                    title={source === 'reel' ? 'Disponible sur le carnet pédagogique complet' : undefined}
                    className={`l7-sens-btn l7-sens-btn--sell${sens === 'vente' ? ' is-active' : ''}`}
                    onClick={() => {
                      setSens('vente');
                      if (modeLimite === 'limite') setPrixLimite('3265');
                      setScenarioActif('');
                    }}
                  >
                    Vente
                  </button>
                </div>
              </div>

              {/* Quantité */}
              <div className="l7-field">
                <label htmlFor={`${id}-qte`} className="l7-label">
                  Quantité de titres
                </label>
                <input
                  id={`${id}-qte`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="l7-input"
                  value={quantite}
                  onChange={(e) => {
                    setQuantite(e.target.value);
                    setScenarioActif('');
                  }}
                />
              </div>

              {/* Limite de prix (art. 44) */}
              <div className="l7-field">
                <span className="l7-label">Modalité de prix (art. 44)</span>
                <div className="l7-radio-cards">
                  <label className={`l7-radio-card${modeLimite === 'au_mieux' ? ' is-selected' : ''}`}>
                    <input
                      type="radio"
                      name={`${id}-lim`}
                      checked={modeLimite === 'au_mieux'}
                      onChange={() => {
                        setModeLimite('au_mieux');
                        setScenarioActif('');
                      }}
                    />
                    <span>
                      <strong>Au mieux</strong>
                      <small>Priorité à l’exécution, prix non plafonné</small>
                    </span>
                  </label>
                  <label className={`l7-radio-card${modeLimite === 'limite' ? ' is-selected' : ''}`}>
                    <input
                      type="radio"
                      name={`${id}-lim`}
                      checked={modeLimite === 'limite'}
                      onChange={() => {
                        setModeLimite('limite');
                        setScenarioActif('');
                      }}
                    />
                    <span>
                      <strong>À cours limité</strong>
                      <small>{sens === 'achat' ? 'Plafond maximal d’achat' : 'Plancher minimal de vente'}</small>
                    </span>
                  </label>
                  <label className={`l7-radio-card${modeLimite === 'aucune' ? ' is-selected' : ''}`}>
                    <input
                      type="radio"
                      name={`${id}-lim`}
                      checked={modeLimite === 'aucune'}
                      onChange={() => {
                        setModeLimite('aucune');
                        setScenarioActif('');
                      }}
                    />
                    <span>
                      <strong>Sans indication de limite</strong>
                      <small>Tester la règle de rejet BRVM</small>
                    </span>
                  </label>
                </div>
              </div>

              {modeLimite === 'limite' && (
                <div className="l7-field">
                  <label htmlFor={`${id}-prix`} className="l7-label">
                    {sens === 'achat' ? 'Cours maximal accepté (FCFA)' : 'Cours minimal accepté (FCFA)'}
                  </label>
                  <input
                    id={`${id}-prix`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="l7-input"
                    value={prixLimite}
                    onChange={(e) => {
                      setPrixLimite(e.target.value);
                      setScenarioActif('');
                    }}
                  />
                </div>
              )}

              {/* Validité (art. 45) */}
              <div className="l7-field">
                <label htmlFor={`${id}-validite`} className="l7-label">
                  Durée de validité (art. 45)
                </label>
                <select
                  id={`${id}-validite`}
                  className="l7-select"
                  value={validite}
                  onChange={(e) => {
                    setValidite(e.target.value as ValiditeOrdre);
                    setScenarioActif('');
                  }}
                >
                  {(Object.keys(VALIDITES) as ValiditeOrdre[]).map((v) => (
                    <option key={v} value={v}>
                      {VALIDITES[v].libelle}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition d'exécution (art. 46) */}
              <div className="l7-field">
                <span className="l7-label">Condition d’exécution (art. 46)</span>
                <div className="l7-toggle-pair" role="group" aria-label="Condition d'exécution">
                  <button
                    type="button"
                    className={`l7-cond-btn${condition === 'sans' ? ' is-active' : ''}`}
                    onClick={() => {
                      setCondition('sans');
                      setScenarioActif('');
                    }}
                  >
                    Sans condition
                  </button>
                  <button
                    type="button"
                    className={`l7-cond-btn${condition === 'tout_ou_rien' ? ' is-active' : ''}`}
                    onClick={() => {
                      setCondition('tout_ou_rien');
                      setScenarioActif('');
                    }}
                  >
                    Tout ou rien
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* COLONNE C — RÉSULTAT & EXPLICATION PÉDAGOGIQUE */}
          <section
            className="l7-order-col l7-order-result"
            aria-labelledby={`${id}-col-c`}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="l7-col-head">
              <span className="l7-col-step">C</span>
              <div>
                <h4 id={`${id}-col-c`} className="l7-col-title">
                  Résultat simulé
                </h4>
                <p className="l7-col-sub">
                  {modeMarche === 'continu' ? 'Confrontation immédiate au carnet' : 'Mécanisme de fixing à cours unique'}
                </p>
              </div>
            </div>

            {erreurValidation && (
              <div className="l7-verdict-box l7-verdict-box--warn" role="alert">
                <strong>Paramètre à corriger</strong>
                <p>{erreurValidation}</p>
              </div>
            )}

            {!erreurValidation && resultatFixing && (
              <>
                <div className="l7-verdict-box l7-verdict-box--fixing">
                  <span className="l7-status-pill l7-status-pill--fixing">Fixing · Cours d’équilibre non prévisible</span>
                  <p>
                    Au fixing, aucune exécution ne peut être présentée comme certaine avant la confrontation générale des
                    ordres.
                  </p>
                </div>

                <dl className="l7-kpi-grid">
                  <div className="l7-kpi-card">
                    <dt>Quantité exécutée</dt>
                    <dd>À déterminer au fixing</dd>
                  </div>
                  <div className="l7-kpi-card">
                    <dt>Titres compatibles visibles</dt>
                    <dd>{nombre(resultatFixing.quantiteCompatible, 0)} titres</dd>
                  </div>
                  <div className="l7-kpi-card">
                    <dt>Prix d’exécution</dt>
                    <dd>Cours d’équilibre unique</dd>
                  </div>
                  <div className="l7-kpi-card">
                    <dt>Validité choisie</dt>
                    <dd>{VALIDITES[validite].libelle}</dd>
                  </div>
                </dl>

                <div className="l7-pedago-notes">
                  {resultatFixing.phrases.map((ph, i) => (
                    <p key={i}>{ph}</p>
                  ))}
                </div>
              </>
            )}

            {!erreurValidation && resultatContinu && (
              <>
                <div className={`l7-verdict-box l7-verdict-box--${resultatContinu.statut}`}>
                  <span className={`l7-status-pill l7-status-pill--${resultatContinu.statut}`}>
                    {resultatContinu.statut === 'execute'
                      ? 'Exécuté en totalité'
                      : resultatContinu.statut === 'partiel'
                        ? 'Exécution partielle'
                        : resultatContinu.statut === 'non_execute'
                          ? 'En attente au carnet'
                          : resultatContinu.statut === 'rejete'
                            ? 'Ordre rejeté (art. 44)'
                            : 'Profondeur non publiée'}
                  </span>
                  <p>{resultatContinu.explication}</p>
                </div>

                <dl className="l7-kpi-grid">
                  <div className="l7-kpi-card">
                    <dt>Quantité exécutée</dt>
                    <dd>{nombre(resultatContinu.quantiteServie, 0)} titres</dd>
                  </div>
                  <div className="l7-kpi-card">
                    <dt>Quantité restante</dt>
                    <dd>
                      {resultatContinu.quantiteInconnue > 0
                        ? `${nombre(resultatContinu.quantiteInconnue, 0)} (profondeur inconnue)`
                        : `${nombre(resultatContinu.reliquat, 0)} titres`}
                    </dd>
                  </div>
                  <div className="l7-kpi-card">
                    <dt>Prix moyen</dt>
                    <dd>{resultatContinu.prixMoyen == null ? '—' : fcfa(resultatContinu.prixMoyen)}</dd>
                  </div>
                  <div className="l7-kpi-card">
                    <dt>{sens === 'achat' ? 'Montant brut d’achat' : 'Montant brut de vente'}</dt>
                    <dd>{resultatContinu.quantiteServie > 0 ? fcfa(resultatContinu.coutTotal) : '0 FCFA'}</dd>
                  </div>
                </dl>

                {resultatContinu.lignes.length > 0 && (
                  <div className="l7-exec-breakdown">
                    <p className="l7-breakdown-title">Détail des paliers touchés dans le carnet</p>
                    <table className="lp-table">
                      <thead>
                        <tr>
                          <th scope="col">Palier de prix</th>
                          <th scope="col" className="lp-num">
                            Titres servis
                          </th>
                          <th scope="col" className="lp-num">
                            Montant
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultatContinu.lignes.map((l) => (
                          <tr key={l.prix}>
                            <th scope="row" className="lp-ligne-tete">
                              {fcfa(l.prix)}
                            </th>
                            <td className="lp-num">{nombre(l.quantite, 0)}</td>
                            <td className="lp-num">{fcfa(l.montant)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <ul className="lp-hypotheses">
          <li>
            Règles appliquées : Règlement général de la BRVM (version du 1er juillet 2022), art. 44 (au mieux ou à cours
            limité ; ordre sans limite rejeté), art. 45 (validité jour par défaut, mensuel, à exécution 3 mois max),
            art. 46 (sans condition ou tout ou rien).
          </li>
          <li>
            Montants bruts hors commissions de courtage SGI, commission BRVM/DC/BR et fiscalité. Au fixing ou sur la
            meilleure limite publiée au BOC, l’exécution complète dépend des ordres non visibles et n’est jamais simulée
            comme acquise.
          </li>
        </ul>
      </div>
    </div>
  );
}

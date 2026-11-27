'use client';

import { useId, useState } from 'react';
import {
  analyserPortefeuille,
  fcfa,
  nombre,
  pct,
  pctSigne,
  SEUIL_SECTEUR_PCT,
  SEUIL_SOCIETE_PCT,
  simulerPortefeuille,
  type LignePortefeuille,
} from '@/lib/academy/risques';

const SECTEURS_DISPO = [
  'Banques',
  'Télécoms',
  'Agro-industrie',
  'Distribution',
  'Énergie',
  'Industrie',
  'Services publics',
] as const;

const PALETTE = ['#0b192c', '#0b7d93', '#2396ad', '#b8892a', '#4f6d8a', '#1d7a46'];

interface ProfilAllocation {
  id: string;
  label: string;
  lignes: LignePortefeuille[];
}

const PROFILS: ProfilAllocation[] = [
  {
    id: 'equilibre',
    label: '5 valeurs équilibrées (leçon)',
    lignes: [
      { nom: 'Société 1', secteur: 'Banques', pct: 20 },
      { nom: 'Société 2', secteur: 'Télécoms', pct: 20 },
      { nom: 'Société 3', secteur: 'Agro-industrie', pct: 20 },
      { nom: 'Société 4', secteur: 'Distribution', pct: 20 },
      { nom: 'Société 5', secteur: 'Énergie', pct: 20 },
    ],
  },
  {
    id: 'concentre-1',
    label: 'Tout sur 1 seule valeur (100 %)',
    lignes: [
      { nom: 'Société 1', secteur: 'Banques', pct: 100 },
      { nom: 'Société 2', secteur: 'Télécoms', pct: 0 },
      { nom: 'Société 3', secteur: 'Agro-industrie', pct: 0 },
      { nom: 'Société 4', secteur: 'Distribution', pct: 0 },
      { nom: 'Société 5', secteur: 'Énergie', pct: 0 },
    ],
  },
  {
    id: 'faux-diversifie',
    label: 'Faux diversifié : 3 banques (60 %)',
    lignes: [
      { nom: 'Société 1', secteur: 'Banques', pct: 20 },
      { nom: 'Société 2', secteur: 'Banques', pct: 20 },
      { nom: 'Société 3', secteur: 'Banques', pct: 20 },
      { nom: 'Société 4', secteur: 'Télécoms', pct: 20 },
      { nom: 'Société 5', secteur: 'Agro-industrie', pct: 20 },
    ],
  },
];

export default function SimulateurDiversification({
  capitalDefaut = 1_000_000,
  rendementDefaut = 8,
}: {
  capitalDefaut?: number;
  rendementDefaut?: number;
}) {
  const id = useId();
  const [profilId, setProfilId] = useState<string>('equilibre');
  const [lignes, setLignes] = useState<LignePortefeuille[]>(() => PROFILS[0]!.lignes.map((l) => ({ ...l })));
  const [vueCamembert, setVueCamembert] = useState<'societe' | 'secteur'>('secteur');

  // Chocs simulés : par défaut, la démonstration exacte de la leçon (dividende divisé par deux sur la Société 1)
  const [marchePct, setMarchePct] = useState<number>(0);
  const [secteurCible, setSecteurCible] = useState<string>('Banques');
  const [baisseSecteurPct, setBaisseSecteurPct] = useState<number>(0);
  const [societeDividende, setSocieteDividende] = useState<string>('Société 1');
  const [reductionDivPct, setReductionDivPct] = useState<number>(50);

  const analyse = analyserPortefeuille(lignes);
  const totalValide = Math.abs(analyse.totalPct - 100) <= 0.01;

  const secteursPresents = analyse.parSecteur.map((s) => s.secteur);
  const secteurEffectif = secteursPresents.includes(secteurCible)
    ? secteurCible
    : (secteursPresents[0] ?? 'Banques');

  const lignesActives = lignes.filter((l) => l.pct > 0);
  const societeEffective = lignesActives.some((l) => l.nom === societeDividende)
    ? societeDividende
    : (lignesActives[0]?.nom ?? lignes[0]!.nom);

  const resultat = totalValide
    ? simulerPortefeuille(
        { capital: capitalDefaut, rendementPct: rendementDefaut, lignes },
        {
          marchePct,
          secteur: baisseSecteurPct > 0 ? { nom: secteurEffectif, baissePct: baisseSecteurPct } : null,
          dividende: reductionDivPct > 0 ? { nom: societeEffective, reductionPct: reductionDivPct } : null,
        },
      )
    : null;

  const donneesPie =
    vueCamembert === 'societe'
      ? lignes.filter((l) => l.pct > 0).map((l) => ({ name: `${l.nom} (${l.secteur})`, value: l.pct }))
      : analyse.parSecteur.map((s) => ({ name: s.secteur, value: s.pct }));

  function choisirProfil(p: ProfilAllocation) {
    setProfilId(p.id);
    setLignes(p.lignes.map((l) => ({ ...l })));
  }

  function modifierPct(idx: number, valeur: number) {
    setProfilId('');
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, pct: valeur } : l)));
  }

  function modifierSecteur(idx: number, secteur: string) {
    setProfilId('');
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, secteur } : l)));
  }

  function reequilibrer100() {
    const somme = lignes.reduce((s, l) => s + l.pct, 0);
    if (somme <= 0) {
      choisirProfil(PROFILS[0]!);
      return;
    }
    const ajustees = lignes.map((l) => ({ ...l, pct: Math.round((l.pct / somme) * 20) * 5 }));
    const diff = 100 - ajustees.reduce((s, l) => s + l.pct, 0);
    const idxMax = ajustees.reduce((best, cur, i, arr) => (cur.pct > arr[best]!.pct ? i : best), 0);
    ajustees[idxMax] = { ...ajustees[idxMax]!, pct: Math.max(0, Math.min(100, ajustees[idxMax]!.pct + diff)) };
    setLignes(ajustees);
  }

  return (
    <div className="l7-sim-shell">
      <div className="l7-sim-inner">
        <div className="l7-sim-header">
          <div>
            <span className="l7-eyebrow">Simulateur interactif · Allocation & résistance aux chocs</span>
            <h3 className="l7-sim-title">Construire et éprouver un portefeuille de {fcfa(capitalDefaut)}</h3>
          </div>
          <span className="lp-badge">Simulation pédagogique</span>
        </div>

        {/* Profils types */}
        <div className="l7-presets" aria-label="Profils de portefeuille">
          <span className="l7-presets-label">Comparer une structure :</span>
          <div className="l7-presets-list">
            {PROFILS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`l7-preset-chip${profilId === p.id ? ' is-active' : ''}`}
                onClick={() => choisirProfil(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Partie 1 : Curseurs pleine largeur */}
        <div className="l7-alloc-sliders">
          <div className="l7-subhead">
            <h4>1. Répartition par société et par secteur</h4>
            <span className={`l7-total-badge${totalValide ? ' is-valid' : ' is-invalid'}`}>
              Total : {pct(analyse.totalPct)}
            </span>
          </div>

          <div className="l7-lines-list">
            {lignes.map((l, i) => {
              const depasseSociete = l.pct > SEUIL_SOCIETE_PCT;
              return (
                <div key={l.nom} className="l7-line-row">
                  <div className="l7-line-id">
                    <span className="l7-dot" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden="true" />
                    <label htmlFor={`${id}-rng-${i}`} className="l7-line-name">
                      {l.nom}
                    </label>
                  </div>
                  <select
                    aria-label={`Secteur de ${l.nom}`}
                    className="l7-mini-select"
                    value={l.secteur}
                    onChange={(e) => modifierSecteur(i, e.target.value)}
                  >
                    {SECTEURS_DISPO.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                  <div className="l7-line-slider-wrap">
                    <input
                      id={`${id}-rng-${i}`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={l.pct}
                      aria-valuetext={`${l.pct} %, soit ${fcfa((capitalDefaut * l.pct) / 100)}`}
                      onChange={(e) => modifierPct(i, Number(e.target.value))}
                    />
                  </div>
                  <output
                    htmlFor={`${id}-rng-${i}`}
                    className={`l7-line-out${depasseSociete ? ' is-alert' : ''}`}
                  >
                    <strong>{l.pct} %</strong>
                    <small>{fcfa((capitalDefaut * l.pct) / 100)}</small>
                  </output>
                </div>
              );
            })}
          </div>

          {!totalValide && (
            <div className="l7-inline-fix" role="alert">
              <span>
                {analyse.reste > 0
                  ? `Il reste ${pct(analyse.reste)} à allouer pour atteindre 100 %.`
                  : `Vous dépassez 100 % de ${pct(-analyse.reste)}.`}
              </span>
              <button type="button" className="l7-link-btn" onClick={reequilibrer100}>
                Ramener automatiquement à 100 %
              </button>
            </div>
          )}
        </div>

        {/* Partie 2 : Diagnostic visuel (camembert + barres sectorielles côte à côte) */}
        <div className="l7-alloc-visual">
          <div className="l7-subhead">
            <h4>Diagnostic de concentration</h4>
            <div className="l7-seg-group l7-seg-group--sm" role="group" aria-label="Vue du graphique circulaire">
              <button
                type="button"
                className={`l7-seg-btn${vueCamembert === 'secteur' ? ' is-active' : ''}`}
                onClick={() => setVueCamembert('secteur')}
              >
                Par secteur
              </button>
              <button
                type="button"
                className={`l7-seg-btn${vueCamembert === 'societe' ? ' is-active' : ''}`}
                onClick={() => setVueCamembert('societe')}
              >
                Par société
              </button>
            </div>
          </div>

          <div className="l7-diag-split">
            <div className="l7-donut-wrap" role="img" aria-label="Répartition circulaire du portefeuille">
              {donneesPie.length > 0 ? (
                <svg viewBox="0 0 160 160" className="l7-donut-svg">
                  {(() => {
                    const totalPie = donneesPie.reduce((acc, d) => acc + d.value, 0) || 1;
                    const r = 56;
                    const circ = 2 * Math.PI * r;
                    let cumul = 0;
                    return donneesPie.map((entry, idx) => {
                      const frac = entry.value / totalPie;
                      const dash = Math.max(0, frac * circ - (donneesPie.length > 1 ? 2 : 0));
                      const offset = -cumul * circ;
                      cumul += frac;
                      return (
                        <circle
                          key={entry.name}
                          cx="80"
                          cy="80"
                          r={r}
                          fill="none"
                          stroke={PALETTE[idx % PALETTE.length]}
                          strokeWidth="22"
                          strokeDasharray={`${dash} ${circ}`}
                          strokeDashoffset={offset}
                          transform="rotate(-90 80 80)"
                        >
                          <title>{`${entry.name} : ${nombre(entry.value, 1)} %`}</title>
                        </circle>
                      );
                    });
                  })()}
                  <text x="80" y="76" textAnchor="middle" className="l7-donut-center-big">
                    { `${Math.round(analyse.totalPct)} %` }
                  </text>
                  <text x="80" y="94" textAnchor="middle" className="l7-donut-center-sub">
                    {vueCamembert === 'secteur'
                      ? `${analyse.parSecteur.length} sect.`
                      : `${lignesActives.length} soc.`}
                  </text>
                </svg>
              ) : (
                <p className="l7-state-msg">Aucune ligne active.</p>
              )}
            </div>

            <div className="l7-sector-bars">
              {analyse.parSecteur.map((s) => {
                const haut = s.pct > SEUIL_SECTEUR_PCT;
                return (
                  <div key={s.secteur} className="l7-sector-bar-row">
                    <div className="l7-sector-bar-top">
                      <span className="l7-sector-name">{s.secteur}</span>
                      <strong className={`l7-sector-val${haut ? ' is-alert' : ''}`}>
                        {pct(s.pct)}
                        {haut ? ` (> ${SEUIL_SECTEUR_PCT} %)` : ''}
                      </strong>
                    </div>
                    <div className="l7-sector-track">
                      <div
                        className={`l7-sector-fill${haut ? ' is-alert' : ''}`}
                        style={{ width: `${Math.min(100, s.pct)}%` }}
                      />
                      <span
                        className="l7-sector-limit"
                        style={{ left: `${SEUIL_SECTEUR_PCT}%` }}
                        title={`Repère pédagogique : ${SEUIL_SECTEUR_PCT} % max par secteur`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <dl className="l7-conc-metrics">
            <div>
              <dt>Diversification effective</dt>
              <dd>{analyse.nombreEffectif > 0 ? `${nombre(analyse.nombreEffectif, 1)} lignes équivalentes` : '—'}</dd>
            </div>
            <div>
              <dt>Plus forte société (repère ≤ {SEUIL_SOCIETE_PCT} %)</dt>
              <dd className={analyse.ligneMax && analyse.ligneMax.pct > SEUIL_SOCIETE_PCT ? 'is-alert' : undefined}>
                {analyse.ligneMax ? `${analyse.ligneMax.nom} · ${pct(analyse.ligneMax.pct)}` : '—'}
              </dd>
            </div>
          </dl>

          {analyse.alertes.length > 0 ? (
            <ul className="l7-alert-list" aria-live="polite">
              {analyse.alertes.map((al) => (
                <li key={al}>{al}</li>
              ))}
            </ul>
          ) : (
            <p className="l7-ok-note">
              Repères pédagogiques respectés : aucune société ne dépasse {SEUIL_SOCIETE_PCT} % et aucun secteur ne
              dépasse {SEUIL_SECTEUR_PCT} %.
            </p>
          )}
        </div>

        {/* Partie basse : Simulation de chocs & comparaison Avant / Après */}
        <div className="l7-shock-panel">
          <div className="l7-subhead">
            <h4>2. Simuler un choc de marché, sectoriel ou de dividende</h4>
            <button
              type="button"
              className="l7-link-btn"
              onClick={() => {
                setMarchePct(0);
                setBaisseSecteurPct(0);
                setReductionDivPct(50);
                setSocieteDividende('Société 1');
              }}
            >
              Revenir au cas de la leçon (dividende −50 %)
            </button>
          </div>

          <div className="l7-shock-controls">
            <div className="l7-shock-box">
              <label htmlFor={`${id}-choc-marche`} className="l7-label">
                Choc de marché global : <strong>{marchePct === 0 ? 'Aucun' : `−${marchePct} %`}</strong>
              </label>
              <input
                id={`${id}-choc-marche`}
                type="range"
                min={0}
                max={40}
                step={5}
                value={marchePct}
                onChange={(e) => setMarchePct(Number(e.target.value))}
              />
              <small>Affecte toutes les sociétés simultanément</small>
            </div>

            <div className="l7-shock-box">
              <div className="l7-shock-label-row">
                <label htmlFor={`${id}-choc-sec`} className="l7-label">
                  Choc sectoriel : <strong>{baisseSecteurPct === 0 ? 'Aucun' : `−${baisseSecteurPct} %`}</strong>
                </label>
                <select
                  aria-label="Secteur touché par la baisse"
                  className="l7-mini-select"
                  value={secteurEffectif}
                  onChange={(e) => setSecteurCible(e.target.value)}
                >
                  {secteursPresents.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
              <input
                id={`${id}-choc-sec`}
                type="range"
                min={0}
                max={50}
                step={5}
                value={baisseSecteurPct}
                onChange={(e) => setBaisseSecteurPct(Number(e.target.value))}
              />
              <small>Baisse supplémentaire du secteur sélectionné</small>
            </div>

            <div className="l7-shock-box">
              <div className="l7-shock-label-row">
                <label htmlFor={`${id}-choc-div`} className="l7-label">
                  Réduction de dividende : <strong>{reductionDivPct === 0 ? 'Aucune' : `−${reductionDivPct} %`}</strong>
                </label>
                <select
                  aria-label="Société réduisant son dividende"
                  className="l7-mini-select"
                  value={societeEffective}
                  onChange={(e) => setSocieteDividende(e.target.value)}
                >
                  {lignesActives.map((l) => (
                    <option key={l.nom} value={l.nom}>
                      {l.nom} ({l.pct} %)
                    </option>
                  ))}
                </select>
              </div>
              <input
                id={`${id}-choc-div`}
                type="range"
                min={0}
                max={100}
                step={25}
                value={reductionDivPct}
                onChange={(e) => setReductionDivPct(Number(e.target.value))}
              />
              <small>50 % = dividende divisé par deux · 100 % = supprimé</small>
            </div>
          </div>

          {resultat ? (
            <div className="l7-before-after" aria-live="polite">
              <div className="l7-ba-card">
                <span className="l7-ba-kicker">Capital du portefeuille</span>
                <div className="l7-ba-nums">
                  <div>
                    <small>Avant choc</small>
                    <strong>{fcfa(resultat.capitalAvant)}</strong>
                  </div>
                  <span className="l7-ba-arrow" aria-hidden="true">
                    →
                  </span>
                  <div>
                    <small>Après choc</small>
                    <strong>{fcfa(resultat.capitalApres)}</strong>
                  </div>
                  <span className={`l7-ba-delta${resultat.variationCapitalPct < 0 ? ' is-neg' : ''}`}>
                    {resultat.variationCapitalPct === 0 ? '0 %' : pctSigne(resultat.variationCapitalPct)}
                  </span>
                </div>
                <div className="l7-ba-bar">
                  <div
                    className="l7-ba-bar-fill"
                    style={{ width: `${Math.max(0, Math.min(100, (resultat.capitalApres / resultat.capitalAvant) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="l7-ba-card">
                <span className="l7-ba-kicker">Revenu annuel de dividendes (hypothèse {rendementDefaut} %)</span>
                <div className="l7-ba-nums">
                  <div>
                    <small>Avant choc</small>
                    <strong>{fcfa(resultat.revenuAvant)}</strong>
                  </div>
                  <span className="l7-ba-arrow" aria-hidden="true">
                    →
                  </span>
                  <div>
                    <small>Après choc</small>
                    <strong>{fcfa(resultat.revenuApres)}</strong>
                  </div>
                  <span className={`l7-ba-delta${resultat.variationRevenuPct < 0 ? ' is-neg' : ''}`}>
                    {resultat.variationRevenuPct === 0 ? '0 %' : pctSigne(resultat.variationRevenuPct)}
                  </span>
                </div>
                <div className="l7-ba-bar">
                  <div
                    className="l7-ba-bar-fill l7-ba-bar-fill--gold"
                    style={{ width: `${Math.max(0, Math.min(100, (resultat.revenuApres / resultat.revenuAvant) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="l7-state-msg">Ajustez le total de la répartition à 100 % pour calculer l’impact des chocs.</p>
          )}
        </div>

        {/* Avertissement explicite sur le risque de marché et les corrélations */}
        <div className="l7-warning-banner" role="note">
          <strong>Limite essentielle de la diversification :</strong> la diversification réduit l’impact d’un accident
          propre à une entreprise, mais <em>elle ne supprime pas le risque de marché</em> (testez un choc global de
          −20 % ci-dessus : un portefeuille diversifié recule aussi de 20 %). Prenez également en compte les{' '}
          <strong>corrélations entre titres</strong> : deux sociétés distinctes peuvent dépendre de la même matière
          première agricole, des mêmes taux d’intérêt de l’UEMOA ou du même marché domestique.
        </div>

        {resultat && (
          <ul className="lp-hypotheses">
            {resultat.hypotheses.map((h) => (
              <li key={h}>{h}</li>
            ))}
            <li>
              Simulation pédagogique : les lignes « Société 1 à 5 » et le rendement de {rendementDefaut} % sont des
              hypothèses d’apprentissage, distinctes des données de marché.
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

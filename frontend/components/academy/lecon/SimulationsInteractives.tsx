'use client';

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import type { Simulation } from '@/lib/academy/types';
import {
  executerOrdre,
  VALIDITES,
  type ConditionOrdre,
  type LimiteOrdre,
  type NiveauCarnet,
  type ResultatOrdre,
  type ValiditeOrdre,
} from '@/lib/academy/carnet';
import { carnetDepuisLigne, type LigneCarnetReel } from '@/lib/academy/carnetReel';
import {
  analyserAllocation,
  simulerScenario,
  type LigneAllocation,
  type ScenarioBaisse,
} from '@/lib/academy/allocation';
import { dateSeanceLongue } from '@/components/CarnetOrdres';

/**
 * Trois simulateurs interactifs de la leçon 6 : atelier d'ordre, répartition par
 * secteur, scénarios de baisse. Calculs dans lib/academy (purs, testés) ; ici,
 * seulement l'interface. Résultats annoncés (aria-live), contrôles étiquetés.
 */

const nombre = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
const fcfa = (n: number) => `${nombre(n)} FCFA`;
const pct = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(n)} %`.replace('-', '−');

function Entete({ titre }: { titre: string }) {
  return (
    <div className="lp-figure-tete">
      <p className="lp-figure-titre">{titre}</p>
      <span className="lp-badge">Simulation pédagogique</span>
    </div>
  );
}

// ── 1. Atelier « Choisissez votre ordre » ───────────────────────────────────

type ModeLimite = 'au_mieux' | 'limite' | 'aucune';
type SourceCarnet = 'fictif' | 'reel';
type EtatReel =
  | { etat: 'repos' }
  | { etat: 'chargement' }
  | { etat: 'erreur' }
  | { etat: 'vide' }
  | { etat: 'pret'; ligne: LigneCarnetReel };

function Carnet({ sim }: { sim: Extract<Simulation, { type: 'carnet' }> }) {
  const id = useId();
  const [source, setSource] = useState<SourceCarnet>('fictif');
  const [code, setCode] = useState(sim.codes[0] ?? '');
  const [reel, setReel] = useState<EtatReel>({ etat: 'repos' });

  const [quantite, setQuantite] = useState(String(sim.quantite_defaut));
  const [modeLimite, setModeLimite] = useState<ModeLimite>('au_mieux');
  const [prixLimite, setPrixLimite] = useState(String(sim.niveaux[0]?.prix ?? ''));
  const [condition, setCondition] = useState<ConditionOrdre>('sans');
  const [validite, setValidite] = useState<ValiditeOrdre>('jour');
  const [analyse, setAnalyse] = useState<{ resultat: ResultatOrdre; reel: boolean } | null>(null);

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

  // Tout changement rend l'analyse précédente périmée : on l'efface.
  useEffect(() => { setAnalyse(null); }, [source, code, quantite, modeLimite, prixLimite, condition, validite]);

  const carnetReel = reel.etat === 'pret' && source === 'reel' ? carnetDepuisLigne(reel.ligne) : null;
  const niveaux: NiveauCarnet[] = source === 'fictif' ? sim.niveaux : carnetReel?.niveaux ?? [];
  const pret = source === 'fictif' || carnetReel !== null;

  function analyser() {
    const q = /^\d+$/.test(quantite.trim()) ? Number(quantite.trim()) : NaN;
    const p = Number(prixLimite.replace(/\s/g, '').replace(',', '.'));
    const limite: LimiteOrdre =
      modeLimite === 'au_mieux' ? 'au_mieux' : modeLimite === 'limite' && prixLimite.trim() !== '' ? { prix: p } : null;
    const resultat = executerOrdre(
      niveaux,
      { sens: 'achat', quantite: q, limite, condition, validite },
      { profondeurInconnue: source === 'reel' },
    );
    setAnalyse({ resultat, reel: source === 'reel' });
  }

  const r = analyse?.resultat ?? null;
  const ligneReelle = reel.etat === 'pret' ? reel.ligne : null;

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <Entete titre="Atelier : choisissez votre ordre d’achat" />

      {sim.codes.length > 0 && (
        <fieldset className="lp-champ-groupe">
          <legend>Carnet utilisé</legend>
          <div className="lp-choix">
            <label><input type="radio" name={`${id}-src`} checked={source === 'fictif'} onChange={() => setSource('fictif')} /> Carnet fictif</label>
            <label><input type="radio" name={`${id}-src`} checked={source === 'reel'} onChange={() => setSource('reel')} /> Carnet réel d’une valeur</label>
          </div>
          {source === 'reel' && (
            <div className="lp-champ">
              <label htmlFor={`${id}-code`}>Valeur</label>
              <select id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)}>
                {sim.codes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </fieldset>
      )}

      <div className="lp-carnet-entete">
        <p className="lp-carnet-titre">
          {source === 'fictif'
            ? 'Carnet fictif : côté vente'
            : ligneReelle
              ? `Carnet réel : ${ligneReelle.designation ?? ligneReelle.code} (${ligneReelle.code}), côté vente`
              : 'Carnet réel : côté vente'}
        </p>
        {source === 'fictif' && <span className="lp-badge">Carnet fictif</span>}
      </div>

      {source === 'reel' && reel.etat === 'chargement' && <p className="lp-note" role="status">Lecture du carnet publié…</p>}
      {source === 'reel' && reel.etat === 'erreur' && (
        <p className="lp-alerte-texte" role="alert">Le carnet réel est indisponible pour le moment. Réessayez plus tard ou utilisez le carnet fictif.</p>
      )}
      {source === 'reel' && reel.etat === 'vide' && (
        <p className="lp-note" role="status">Aucun carnet publié pour cette valeur : utilisez le carnet fictif.</p>
      )}

      {pret && (
        <div className="lp-table-wrap">
          <table className="lp-table">
            <caption className="sr-only">Quantités proposées à la vente, par prix</caption>
            <thead>
              <tr>
                <th scope="col">Prix vendeur</th>
                <th scope="col" className="lp-num">Quantité proposée</th>
              </tr>
            </thead>
            <tbody>
              {source === 'reel' && niveaux.length === 0 && (
                <tr><td colSpan={2}>Aucune quantité à la vente n’est publiée.</td></tr>
              )}
              {niveaux.map((n, i) => (
                <tr key={i}>
                  <th scope="row" className="lp-ligne-tete">{n.prix == null ? 'Au marché (aucun cours publié)' : fcfa(n.prix)}</th>
                  <td className="lp-num">{nombre(n.quantite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {source === 'reel' && ligneReelle && (
        <p className="lp-note">
          Séance du {dateSeanceLongue(ligneReelle.date_marche)}. Source : Bulletin officiel de la cote, BRVM. Ce sont les quantités
          restées en carnet à la clôture, pas l’état du marché à cet instant. La BRVM ne publie que la meilleure limite
          {carnetReel?.quantiteVisible != null ? ` : au-delà de ${nombre(carnetReel.quantiteVisible)} titres, la profondeur n’est pas connue` : ''}.
          {ligneReelle.vente_au_marche ? ' Ici, le côté vente est « au marché » : il n’a pas de prix, donc pas de prix d’exécution calculable.' : ''}
        </p>
      )}
      {source === 'fictif' && <p className="lp-note">Carnet fictif : les quantités et les prix ne décrivent aucune valeur réelle.</p>}

      <form
        className="lp-ordre"
        onSubmit={(e) => { e.preventDefault(); if (pret) analyser(); }}
      >
        <fieldset className="lp-champ-groupe">
          <legend>Votre ordre</legend>

          <div className="lp-champ">
            <label htmlFor={`${id}-qte`}>Quantité (titres, achat)</label>
            <input id={`${id}-qte`} type="text" inputMode="numeric" autoComplete="off" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
          </div>

          <fieldset className="lp-champ-groupe lp-sous">
            <legend>Limite de prix (art. 44)</legend>
            <div className="lp-choix">
              <label><input type="radio" name={`${id}-lim`} checked={modeLimite === 'au_mieux'} onChange={() => setModeLimite('au_mieux')} /> Au mieux</label>
              <label><input type="radio" name={`${id}-lim`} checked={modeLimite === 'limite'} onChange={() => setModeLimite('limite')} /> À cours limité</label>
              <label><input type="radio" name={`${id}-lim`} checked={modeLimite === 'aucune'} onChange={() => setModeLimite('aucune')} /> Aucune limite indiquée</label>
            </div>
            {modeLimite === 'limite' && (
              <div className="lp-champ">
                <label htmlFor={`${id}-prix`}>Prix maximum à l’achat (FCFA)</label>
                <input id={`${id}-prix`} type="text" inputMode="decimal" autoComplete="off" value={prixLimite} onChange={(e) => setPrixLimite(e.target.value)} />
              </div>
            )}
          </fieldset>

          <fieldset className="lp-champ-groupe lp-sous">
            <legend>Réponse partielle (art. 46)</legend>
            <div className="lp-choix">
              <label><input type="radio" name={`${id}-cond`} checked={condition === 'sans'} onChange={() => setCondition('sans')} /> Sans condition</label>
              <label><input type="radio" name={`${id}-cond`} checked={condition === 'tout_ou_rien'} onChange={() => setCondition('tout_ou_rien')} /> Tout ou rien</label>
            </div>
          </fieldset>

          <div className="lp-champ">
            <label htmlFor={`${id}-val`}>Validité (art. 45)</label>
            <select id={`${id}-val`} value={validite} onChange={(e) => setValidite(e.target.value as ValiditeOrdre)}>
              {(Object.keys(VALIDITES) as ValiditeOrdre[]).map((v) => <option key={v} value={v}>{VALIDITES[v].libelle}</option>)}
            </select>
          </div>
        </fieldset>

        <button type="submit" className="lp-bouton" disabled={!pret}>Analyser mon ordre</button>
      </form>

      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        {r && (
          <>
            <p className={`lp-verdict lp-verdict--${r.statut}`}>{r.explication}</p>
            {r.lignes.length > 0 && (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <caption className="sr-only">Exécutions de votre ordre</caption>
                  <thead>
                    <tr>
                      <th scope="col">Prix</th>
                      <th scope="col" className="lp-num">Quantité</th>
                      <th scope="col" className="lp-num">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lignes.map((l) => (
                      <tr key={l.prix}>
                        <th scope="row" className="lp-ligne-tete">{fcfa(l.prix)}</th>
                        <td className="lp-num">{nombre(l.quantite)}</td>
                        <td className="lp-num">{fcfa(l.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className="lp-ligne-tete">Total servi</th>
                      <td className="lp-num">{nombre(r.quantiteServie)}</td>
                      <td className="lp-num">{fcfa(r.coutTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <dl className="lp-synthese">
              <div><dt>Prix moyen</dt><dd>{r.prixMoyen == null ? 'Aucun titre servi' : fcfa(r.prixMoyen)}</dd></div>
              <div><dt>Coût total</dt><dd>{r.quantiteServie > 0 ? fcfa(r.coutTotal) : '0 FCFA'}</dd></div>
              <div><dt>Titres non servis</dt><dd>{r.quantiteInconnue > 0 ? `${nombre(r.quantiteInconnue)} (profondeur inconnue)` : nombre(r.reliquat)}</dd></div>
            </dl>
          </>
        )}
      </div>

      <ul className="lp-hypotheses">
        <li>Seuls les ordres du règlement général de la BRVM (version du 1er juillet 2022) sont simulés. D’autres conditions existent sur d’autres marchés (meilleure limite, quantité minimale, exécuté ou éliminé) : à vérifier auprès de votre SGI.</li>
        <li>Achat uniquement ; hors frais de courtage et impôt. Sur une valeur au fixing, l’exécution se fait à un cours d’équilibre unique : cet atelier montre le principe, pas le résultat exact d’une séance.</li>
        <li>Ordre à exécution : date limite possible, non simulée ici.</li>
      </ul>
    </figure>
  );
}

// ── 2. Répartir 1 000 000 FCFA ──────────────────────────────────────────────

/** Répartition publiée par le simulateur 2, relue par le simulateur 3 (même page). */
let partage: { capital: number; lignes: LigneAllocation[] } | null = null;
const abonnes = new Set<() => void>();
const publier = (v: typeof partage) => { partage = v; abonnes.forEach((f) => f()); };
const s = (cb: () => void) => { abonnes.add(cb); return () => { abonnes.delete(cb); }; };

function Allocation({ sim }: { sim: Extract<Simulation, { type: 'allocation' }> }) {
  const id = useId();
  const [pcts, setPcts] = useState<number[]>(() => sim.secteurs.map((x) => x.pct));
  const lignes: LigneAllocation[] = sim.secteurs.map((x, i) => ({ nom: x.nom, pct: pcts[i] ?? 0 }));
  const a = analyserAllocation(lignes, sim.capital, sim.seuil_secteur_pct);

  useEffect(() => {
    publier({ capital: sim.capital, lignes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcts, sim.capital]);
  useEffect(() => () => publier(null), []);

  const reinitialiser = () => setPcts(sim.secteurs.map((x) => x.pct));
  const reste = a.resteAReparti;

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <Entete titre={`Répartir ${fcfa(sim.capital)} entre ${sim.secteurs.length} secteurs`} />
      <p className="lp-note lp-note--haut">Déplacez les curseurs au clavier (flèches) ou à la souris ; le total doit faire 100 %.</p>

      <div className="lp-curseurs">
        {a.lignes.map((l, i) => (
          <div key={l.nom} className="lp-curseur">
            <label htmlFor={`${id}-${i}`}>{l.nom}</label>
            <input
              id={`${id}-${i}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={l.pct}
              aria-valuetext={`${l.pct} %, soit ${fcfa(l.montant)}`}
              onChange={(e) => setPcts((p) => p.map((v, j) => (j === i ? Number(e.target.value) : v)))}
            />
            <output htmlFor={`${id}-${i}`} className={l.pct > sim.seuil_secteur_pct ? 'lp-alerte' : undefined}>
              {l.pct} % · {fcfa(l.montant)}
            </output>
          </div>
        ))}
      </div>

      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        <p className={`lp-total${a.totalPct === 100 ? '' : ' lp-alerte'}`}>
          Total : {nombre(a.totalPct)} %
          {reste > 0 ? ` : il reste ${nombre(reste)} % à répartir` : reste < 0 ? ` : ${nombre(-reste)} % de trop` : ' : le capital est entièrement réparti'}
        </p>
        {a.alertes.length > 0 && (
          <ul className="lp-alertes">
            {a.alertes.map((x) => <li key={x.type + x.message}>{x.message}</li>)}
          </ul>
        )}
      </div>

      <button type="button" className="lp-bouton lp-bouton--discret" onClick={reinitialiser}>Réinitialiser</button>

      <ul className="lp-hypotheses">
        <li>Répartition par secteur ≠ diversification effective si les sociétés ont des risques communs (même matière première, même marché, même client).</li>
        <li>Le repère de {nombre(sim.seuil_secteur_pct)} % par secteur est pédagogique : ce n’est ni une règle de la BRVM ni un conseil.</li>
      </ul>
    </figure>
  );
}

// ── 3. Tester une mauvaise nouvelle ─────────────────────────────────────────

type ChoixScenario = 'marche10' | 'marche20' | 'secteur30' | 'dividende';

const LIBELLES: Record<ChoixScenario, string> = {
  marche10: 'Le marché baisse de 10 %',
  marche20: 'Le marché baisse de 20 %',
  secteur30: 'Un secteur baisse de 30 %',
  dividende: 'Un dividende est divisé par deux',
};

function Scenario({ sim }: { sim: Extract<Simulation, { type: 'scenario_baisse' }> }) {
  const id = useId();
  const partageActuel = useSyncExternalStore(s, () => partage, () => null);
  const depuisAllocation = useMemo(() => {
    if (!partageActuel) return null;
    const total = partageActuel.lignes.reduce((t, l) => t + l.pct, 0);
    return Math.abs(total - 100) < 0.01 ? partageActuel : null;
  }, [partageActuel]);

  const base = depuisAllocation ?? { capital: sim.capital, lignes: sim.secteurs };
  const [choix, setChoix] = useState<ChoixScenario>('marche10');
  const [cible, setCible] = useState('');

  const noms = base.lignes.map((l) => l.nom);
  const plusLourde = [...base.lignes].sort((x, y) => y.pct - x.pct)[0]!.nom;
  const cibleValide = noms.includes(cible) ? cible : plusLourde;

  const scenario: ScenarioBaisse =
    choix === 'marche10' ? { type: 'marche', baisse_pct: 10 }
    : choix === 'marche20' ? { type: 'marche', baisse_pct: 20 }
    : choix === 'secteur30' ? { type: 'secteur', nom: cibleValide, baisse_pct: 30 }
    : { type: 'dividende', nom: cibleValide, facteur: 0.5 };

  const r = simulerScenario({ capital: base.capital, rendement_pct: sim.rendement_pct, lignes: base.lignes }, scenario);
  const phrase =
    `${LIBELLES[choix]}${choix === 'secteur30' || choix === 'dividende' ? ` (${cibleValide})` : ''} : ` +
    `capital de ${fcfa(r.capitalAvant)} à ${fcfa(r.capitalApres)} (${pct(r.variationCapitalPct)}), ` +
    `revenu annuel de ${fcfa(r.revenuAvant)} à ${fcfa(r.revenuApres)} (${pct(r.variationRevenuPct)}).`;

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <Entete titre="Tester une mauvaise nouvelle" />
      <p className="lp-note lp-note--haut">
        {depuisAllocation
          ? 'Répartition utilisée : celle que vous venez de composer au-dessus.'
          : `Répartition utilisée : celle de la leçon (${noms.join(', ')}). Composez la vôtre au-dessus pour la tester.`}
      </p>

      <fieldset className="lp-champ-groupe">
        <legend>Scénario</legend>
        <div className="lp-choix lp-choix--colonne">
          {(Object.keys(LIBELLES) as ChoixScenario[]).map((c) => (
            <label key={c}><input type="radio" name={`${id}-sc`} checked={choix === c} onChange={() => setChoix(c)} /> {LIBELLES[c]}</label>
          ))}
        </div>
        {(choix === 'secteur30' || choix === 'dividende') && (
          <div className="lp-champ">
            <label htmlFor={`${id}-cible`}>{choix === 'secteur30' ? 'Secteur touché' : 'Ligne dont le dividende est divisé'}</label>
            <select id={`${id}-cible`} value={cibleValide} onChange={(e) => setCible(e.target.value)}>
              {base.lignes.map((l) => <option key={l.nom} value={l.nom}>{l.nom} ({nombre(l.pct)} %)</option>)}
            </select>
          </div>
        )}
      </fieldset>

      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        <p className="lp-verdict">{phrase}</p>
        <div className="lp-table-wrap">
          <table className="lp-table">
            <caption className="sr-only">Capital et revenu annuel avant et après le scénario</caption>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Mesure</span></th>
                <th scope="col" className="lp-num">Avant</th>
                <th scope="col" className="lp-num">Après</th>
                <th scope="col" className="lp-num">Variation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="lp-ligne-tete">Capital</th>
                <td className="lp-num">{fcfa(r.capitalAvant)}</td>
                <td className="lp-num">{fcfa(r.capitalApres)}</td>
                <td className="lp-num">{pct(r.variationCapitalPct)}</td>
              </tr>
              <tr>
                <th scope="row" className="lp-ligne-tete">Revenu annuel</th>
                <td className="lp-num">{fcfa(r.revenuAvant)}</td>
                <td className="lp-num">{fcfa(r.revenuApres)}</td>
                <td className="lp-num">{pct(r.variationRevenuPct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ul className="lp-hypotheses">
        {r.hypotheses.map((h) => <li key={h}>{h}</li>)}
        <li>Valeurs d’illustration : aucun chiffre de marché réel, ni prévision ni conseil.</li>
      </ul>
    </figure>
  );
}

export default function SimulationInteractive({ sim }: { sim: Extract<Simulation, { type: 'carnet' | 'allocation' | 'scenario_baisse' }> }) {
  if (sim.type === 'carnet') return <Carnet sim={sim} />;
  if (sim.type === 'allocation') return <Allocation sim={sim} />;
  return <Scenario sim={sim} />;
}

'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Simulation } from '@/lib/academy/types';
import type { RatiosValeur } from '@/lib/academy/donneesReelles';
import { PAYS_LABELS, type PaysUemoa } from '@/lib/tax/rates';
import {
  PARITE_EUR_FCFA,
  SaisieInvalide,
  calculerBanque,
  calculerChange,
  calculerCroissance,
  calculerDistribution,
  calculerEndettement,
  calculerRoeMoyen,
  calculerDps,
  calculerFrais,
  calculerObligation,
  calculerOpcvm,
  calculerPbRoe,
  calculerPer,
  calculerPosition,
  calculerRendementNet,
  calculerRendementTotal,
  calculerSouscription,
  calculerValeurFuture,
  lecturePbRoe,
  type Lecture,
} from '@/lib/academy/simulateurs';
import { lireBougie } from '@/lib/academy/simTechnique';
import { dateSeanceLongue } from '@/components/CarnetOrdres';

/**
 * Simulateurs des leçons : interface seulement, tous les calculs et toutes les
 * phrases viennent de lib/academy/simulateurs.ts (purs, testés). Chaque champ
 * est étiqueté, chaque résultat est annoncé (aria-live), rien ne s'anime.
 */

export type SimulationSimple = Exclude<
  Simulation,
  { type: 'reinvestissement' | 'objectif' | 'carnet' | 'allocation' | 'scenario_baisse' | 'technique' | 'bougies' | 'figure_bougies' | 'moyenne_glissante' | 'rsi_pas_a_pas' }
>;

const nombre = (n: number, dec = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec }).format(n);
const fcfa = (n: number) => `${nombre(Math.round(n))} FCFA`;
const pct = (n: number, dec = 1) => `${nombre(n, dec)} %`.replace('-', '−');
const COULEUR = { a: '#0b7d93', b: '#8a96a6', axe: '#5d6b7d', trame: '#e6dfd3' };

/** Nombre saisi à la française (espaces, virgule décimale) ; vide = NaN. */
function lire(s: string): number {
  const t = s.replace(/[\s  ]/g, '').replace(',', '.');
  return t === '' ? NaN : Number(t);
}

function useChamps<K extends string>(init: Record<K, number>) {
  const [v, setV] = useState<Record<K, string>>(
    () => Object.fromEntries(Object.entries(init).map(([k, x]) => [k, String(x).replace('.', ',')])) as Record<K, string>,
  );
  const n = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, lire(x as string)])) as Record<K, number>;
  const set = (k: K) => (x: string) => setV((p) => ({ ...p, [k]: x }));
  const reinit = () =>
    setV(Object.fromEntries(Object.entries(init).map(([k, x]) => [k, String(x).replace('.', ',')])) as Record<K, string>);
  return { v, n, set, reinit };
}

/** Calcul protégé : une saisie impossible devient un message, jamais une erreur de page. */
function essayer<T>(f: () => T): { ok: true; r: T } | { ok: false; message: string } {
  try {
    return { ok: true, r: f() };
  } catch (e) {
    if (e instanceof SaisieInvalide) return { ok: false, message: e.message };
    return { ok: false, message: 'Ces valeurs ne permettent pas de calculer.' };
  }
}

function Entete({ titre, reel = false }: { titre: string; reel?: boolean }) {
  return (
    <div className="lp-figure-tete">
      <p className="lp-figure-titre">{titre}</p>
      <span className={`lp-badge${reel ? ' lp-badge--reel' : ''}`}>{reel ? 'Données réelles' : 'Simulation pédagogique'}</span>
    </div>
  );
}

function Champ({ id, label, value, onChange, unite, aide, entier = false }: {
  id: string; label: string; value: string; onChange: (v: string) => void; unite?: string; aide?: string; entier?: boolean;
}) {
  return (
    <div className="lp-champ">
      <label htmlFor={id}>{label}{unite ? <span className="lp-unite"> ({unite})</span> : null}</label>
      <input
        id={id}
        type="text"
        inputMode={entier ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={aide ? `${id}-aide` : undefined}
      />
      {aide && <span id={`${id}-aide`} className="lp-champ-aide">{aide}</span>}
    </div>
  );
}

function Synthese({ items }: { items: [string, string][] }) {
  return (
    <dl className="lp-synthese">
      {items.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
    </dl>
  );
}

/** Zone annoncée : lecture dérivée du calcul, alertes, ou message de saisie. */
function Resultat({ calc, children }: { calc: { ok: true; r: Lecture } | { ok: false; message: string }; children?: ReactNode }) {
  return (
    <div className="lp-resultat" aria-live="polite" aria-atomic="true">
      {calc.ok ? (
        <>
          {children}
          <p className="lp-verdict">{calc.r.lecture}</p>
          {calc.r.alertes.length > 0 && (
            <ul className="lp-alertes">{calc.r.alertes.map((a) => <li key={a}>{a}</li>)}</ul>
          )}
        </>
      ) : (
        <p className="lp-alerte-texte" role="status">{calc.message}</p>
      )}
    </div>
  );
}

function Cadre({ titre, consigne, reel, children, hypotheses, reinit }: {
  titre: string; consigne?: string; reel?: boolean; children: ReactNode; hypotheses: string[]; reinit?: () => void;
}) {
  return (
    <figure className="lp-figure lp-large lp-atelier">
      <Entete titre={titre} reel={reel} />
      {consigne && <p className="lp-note lp-note--haut">{consigne}</p>}
      {children}
      {reinit && <button type="button" className="lp-bouton lp-bouton--discret" onClick={reinit}>Revenir aux valeurs de la leçon</button>}
      <ul className="lp-hypotheses">
        {hypotheses.map((h) => <li key={h}>{h}</li>)}
      </ul>
    </figure>
  );
}

function Grille({ children }: { children: ReactNode }) {
  return <div className="lp-champs">{children}</div>;
}

// ── Graphique d'une évolution sur N années (valeur future, OPCVM) ───────────

function CourbeAnnees({ donnees, a, b, resume }: {
  donnees: { annee: string; a: number; b: number }[]; a: string; b: string; resume: string;
}) {
  return (
    <>
      <div className="lp-legende" aria-hidden="true">
        <span><i style={{ background: COULEUR.a }} />{a}</span>
        <span><i style={{ background: COULEUR.b }} />{b}</span>
      </div>
      <div className="lp-graphe" role="img" aria-label={resume}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={donnees} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke={COULEUR.trame} vertical={false} />
            <XAxis dataKey="annee" tick={{ fill: COULEUR.axe, fontSize: 12 }} axisLine={{ stroke: COULEUR.trame }} tickLine={false} />
            <YAxis tick={{ fill: COULEUR.axe, fontSize: 12 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => `${nombre(Math.round(v / 1000))} k`} />
            <Tooltip formatter={(v: number, n: string) => [fcfa(v), n === 'a' ? a : b]} contentStyle={{ background: '#fff', border: `1px solid ${COULEUR.trame}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#0f1f33' }} />
            <Line type="monotone" dataKey="b" stroke={COULEUR.b} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="a" stroke={COULEUR.a} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="lp-note">Axe vertical : milliers de FCFA.</p>
    </>
  );
}

// ── 1. Frais d'un ordre ─────────────────────────────────────────────────────

function FraisOrdre({ sim }: { sim: Extract<Simulation, { type: 'frais_ordre' }> }) {
  const id = useId();
  const c = useChamps({ cours: sim.cours, quantite: sim.quantite, taux: sim.taux_frais_pct, minimum: sim.minimum_fcfa });
  const calc = essayer(() => calculerFrais({ cours: c.n.cours, quantite: c.n.quantite, taux_frais_pct: c.n.taux, minimum_fcfa: c.n.minimum }));
  return (
    <Cadre
      titre="Ce que coûte vraiment un ordre"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Les mêmes frais s’appliquent à l’achat et à la revente. Le taux et le minimum varient d’une SGI à l’autre : demandez sa grille tarifaire.',
        'Hors impôt sur une éventuelle plus-value. Valeurs d’illustration, sans lien avec une société cotée.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-c`} label="Cours de l’action" unite="FCFA" value={c.v.cours} onChange={c.set('cours')} />
        <Champ id={`${id}-q`} label="Quantité" unite="titres" entier value={c.v.quantite} onChange={c.set('quantite')} />
        <Champ id={`${id}-t`} label="Frais par ordre" unite="%" value={c.v.taux} onChange={c.set('taux')} />
        <Champ id={`${id}-m`} label="Frais minimum par ordre" unite="FCFA" value={c.v.minimum} onChange={c.set('minimum')} aide="0 si votre SGI n’applique pas de minimum." />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Montant des actions', fcfa(calc.r.montant)],
            ['Frais à l’achat', `${fcfa(calc.r.frais)} (${pct(calc.r.fraisPct, 2)})`],
            ['Coût total', fcfa(calc.r.coutTotal)],
            ['Cours de revente sans perte', fcfa(Math.ceil(calc.r.prixSansPerte))],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 2. Rendement total ──────────────────────────────────────────────────────

function RendementTotal({ sim }: { sim: Extract<Simulation, { type: 'rendement_total' }> }) {
  const id = useId();
  const c = useChamps({ achat: sim.prix_achat, vente: sim.prix_vente, actions: sim.actions, div: sim.dividendes_par_action, annees: sim.annees });
  const calc = essayer(() => calculerRendementTotal({ prix_achat: c.n.achat, prix_vente: c.n.vente, actions: c.n.actions, dividendes_par_action: c.n.div, annees: c.n.annees }));
  return (
    <Cadre
      titre="Dividendes et cours : le rendement total"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Montants bruts, sans frais ni impôt. Le rendement annuel est une moyenne géométrique : il suppose un rythme régulier, ce que la bourse ne garantit pas.',
        'Valeurs d’illustration : ni des données de marché, ni une prévision.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-a`} label="Prix d’achat" unite="FCFA" value={c.v.achat} onChange={c.set('achat')} />
        <Champ id={`${id}-v`} label="Prix de revente" unite="FCFA" value={c.v.vente} onChange={c.set('vente')} />
        <Champ id={`${id}-n`} label="Nombre d’actions" entier value={c.v.actions} onChange={c.set('actions')} />
        <Champ id={`${id}-d`} label="Dividendes reçus par action, sur toute la durée" unite="FCFA" value={c.v.div} onChange={c.set('div')} />
        <Champ id={`${id}-y`} label="Durée de détention" unite="années" entier value={c.v.annees} onChange={c.set('annees')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Somme investie', fcfa(calc.r.investi)],
            ['Dividendes reçus', fcfa(calc.r.dividendes)],
            ['Plus ou moins-value', fcfa(calc.r.plusValue)],
            ['Rendement total', pct(calc.r.rendementTotalPct)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 3. Valeur future ────────────────────────────────────────────────────────

function ValeurFuture({ sim }: { sim: Extract<Simulation, { type: 'valeur_future' }> }) {
  const id = useId();
  const c = useChamps({ capital: sim.capital_initial, versement: sim.versement_mensuel, taux: sim.taux_pct, annees: sim.annees, objectif: sim.objectif });
  const calc = essayer(() => calculerValeurFuture({ capital_initial: c.n.capital, versement_mensuel: c.n.versement, taux_pct: c.n.taux, annees: c.n.annees, objectif: c.n.objectif }));
  return (
    <Cadre
      titre="Faire grandir une épargne dans le temps"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Le rendement est supposé identique chaque année et entièrement réinvesti ; les versements tombent chaque fin de mois.',
        'Rendement hypothétique, non garanti : une année de baisse change le résultat. Montants avant frais et impôt.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-c`} label="Capital de départ" unite="FCFA" value={c.v.capital} onChange={c.set('capital')} />
        <Champ id={`${id}-v`} label="Versement mensuel" unite="FCFA" value={c.v.versement} onChange={c.set('versement')} />
        <Champ id={`${id}-t`} label="Rendement annuel supposé" unite="%" value={c.v.taux} onChange={c.set('taux')} />
        <Champ id={`${id}-a`} label="Durée" unite="années" entier value={c.v.annees} onChange={c.set('annees')} />
        <Champ id={`${id}-o`} label="Capital visé (facultatif)" unite="FCFA" value={c.v.objectif} onChange={c.set('objectif')} aide="0 pour ne pas fixer d’objectif." />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <>
            <CourbeAnnees
              donnees={calc.r.points.map((p) => ({ annee: `An ${p.annee}`, a: p.valeur, b: p.verse }))}
              a="Valeur du placement"
              b="Sommes versées"
              resume={`Après ${calc.r.points.length - 1} ans : ${fcfa(calc.r.valeurFinale)} pour ${fcfa(calc.r.totalVerse)} versés.`}
            />
            <Synthese items={[
              ['Sommes versées', fcfa(calc.r.totalVerse)],
              ['Valeur finale', fcfa(calc.r.valeurFinale)],
              ['Produit du placement', fcfa(calc.r.gains)],
            ]} />
          </>
        )}
      </Resultat>
    </Cadre>
  );
}

// ── Mode « données réelles » commun au PER et au P/B ────────────────────────

type EtatRatios = { etat: 'repos' } | { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'vide' } | { etat: 'pret'; r: RatiosValeur };

function useRatios(actif: boolean, code: string): EtatRatios {
  const [e, setE] = useState<EtatRatios>({ etat: 'repos' });
  useEffect(() => {
    if (!actif || !code) return;
    const ctrl = new AbortController();
    setE({ etat: 'chargement' });
    fetch(`/api/academy/ratios?code=${encodeURIComponent(code)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { ratios: RatiosValeur | null };
        setE(j.ratios ? { etat: 'pret', r: j.ratios } : { etat: 'vide' });
      })
      .catch((err: unknown) => { if ((err as { name?: string }).name !== 'AbortError') setE({ etat: 'erreur' }); });
    return () => ctrl.abort();
  }, [actif, code]);
  return e;
}

function ChoixSource({ id, codes, reel, setReel, code, setCode, libelleFictif }: {
  id: string; codes: string[]; reel: boolean; setReel: (b: boolean) => void; code: string; setCode: (c: string) => void; libelleFictif: string;
}) {
  if (codes.length === 0) return null;
  return (
    <fieldset className="lp-champ-groupe">
      <legend>Chiffres utilisés</legend>
      <div className="lp-choix">
        <label><input type="radio" name={`${id}-src`} checked={!reel} onChange={() => setReel(false)} /> {libelleFictif}</label>
        <label><input type="radio" name={`${id}-src`} checked={reel} onChange={() => setReel(true)} /> Une valeur cotée (base WestBourse)</label>
      </div>
      {reel && (
        <div className="lp-champ">
          <label htmlFor={`${id}-code`}>Valeur</label>
          <select id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)}>
            {codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </fieldset>
  );
}

function EtatReel({ e }: { e: EtatRatios }) {
  if (e.etat === 'chargement') return <p className="lp-note" role="status">Lecture des comptes et du dernier cours…</p>;
  if (e.etat === 'erreur') return <p className="lp-alerte-texte" role="alert">Données indisponibles pour le moment. Réessayez plus tard ou revenez à l’exemple.</p>;
  if (e.etat === 'vide') return <p className="lp-note" role="status">Pas de ratio calculable pour cette valeur : il manque le cours, le nombre de titres ou un exercice publié avec résultat et fonds propres.</p>;
  if (e.etat !== 'pret') return null;
  return (
    <p className="lp-note">
      {e.r.nom} ({e.r.code}) : cours de clôture du {dateSeanceLongue(e.r.dateCours)}, comptes de l’exercice {e.r.exercice}, nombre de titres du
      référentiel. Ratios recalculés par WestBourse ; source des cours : BRVM. Une description, pas une recommandation.
    </p>
  );
}

// ── 4. PER ──────────────────────────────────────────────────────────────────

function Per({ sim }: { sim: Extract<Simulation, { type: 'per' }> }) {
  const id = useId();
  const [reel, setReel] = useState(false);
  const [code, setCode] = useState(sim.codes[0] ?? '');
  const etat = useRatios(reel, code);
  const c = useChamps({ cours: sim.cours, bpa: sim.bpa, croissance: sim.croissance_pct, annees: sim.annees });
  const source = reel && etat.etat === 'pret' ? { cours: etat.r.cours, bpa: etat.r.bpa } : reel ? null : { cours: c.n.cours, bpa: c.n.bpa };
  const calc = source
    ? essayer(() => calculerPer({ cours: source.cours, bpa: source.bpa, croissance_pct: c.n.croissance, annees: c.n.annees }))
    : null;
  return (
    <Cadre
      titre="Combien de fois son bénéfice paie-t-on une action ?"
      consigne={sim.consigne}
      reel={reel && etat.etat === 'pret'}
      reinit={reel ? undefined : c.reinit}
      hypotheses={[
        'Le PER se calcule sur le bénéfice du dernier exercice publié ; il bouge à chaque séance avec le cours.',
        'Les repères (moins de 8, 8 à 15, plus de 20) sont pédagogiques, pas des normes : un PER se compare au secteur et à l’historique de la société.',
        'La croissance du bénéfice est une hypothèse que vous fixez : elle n’est pas une prévision.',
      ]}
    >
      <ChoixSource id={id} codes={sim.codes} reel={reel} setReel={setReel} code={code} setCode={setCode} libelleFictif="Exemple de la leçon (fictif)" />
      {reel && <EtatReel e={etat} />}
      <Grille>
        {!reel && <Champ id={`${id}-c`} label="Cours de l’action" unite="FCFA" value={c.v.cours} onChange={c.set('cours')} />}
        {!reel && <Champ id={`${id}-b`} label="Bénéfice par action (BPA)" unite="FCFA" value={c.v.bpa} onChange={c.set('bpa')} />}
        <Champ id={`${id}-g`} label="Progression du bénéfice supposée" unite="% par an" value={c.v.croissance} onChange={c.set('croissance')} />
        <Champ id={`${id}-n`} label="Pendant" unite="années" entier value={c.v.annees} onChange={c.set('annees')} />
      </Grille>
      {calc && (
        <Resultat calc={calc}>
          {calc.ok && source && (
            <Synthese items={[
              ['Cours', fcfa(source.cours)],
              ['BPA', `${nombre(source.bpa, 2)} FCFA`],
              ['PER', calc.r.per == null ? 'Sans signification' : nombre(calc.r.per, 1)],
              ['Rendement bénéficiaire', calc.r.rendementBeneficiairePct == null ? '—' : pct(calc.r.rendementBeneficiairePct)],
            ]} />
          )}
        </Resultat>
      )}
    </Cadre>
  );
}

// ── 5. P/B = PER × ROE ──────────────────────────────────────────────────────

function PbRoe({ sim }: { sim: Extract<Simulation, { type: 'pb_roe' }> }) {
  const id = useId();
  const [reel, setReel] = useState(false);
  const [code, setCode] = useState(sim.codes[0] ?? '');
  const etat = useRatios(reel, code);
  const [vals, setVals] = useState(() => sim.societes.map((s) => ({ per: String(s.per).replace('.', ','), roe: String(s.roe_pct).replace('.', ',') })));
  const calc = essayer(() => {
    const r = calculerPbRoe(sim.societes.map((s, i) => ({ nom: s.nom, per: lire(vals[i]!.per), roe_pct: lire(vals[i]!.roe) })));
    return { lignes: r, lecture: r.map((x) => `${x.nom} : ${x.lecture}`).join(' '), alertes: [] as string[] };
  });
  const reelPret = reel && etat.etat === 'pret' ? etat.r : null;
  return (
    <Cadre
      titre="Le P/B se lit avec le ROE"
      consigne={sim.consigne}
      reel={reelPret != null}
      hypotheses={[
        'P/B = PER × ROE : le bénéfice par action s’annule entre les deux ratios. Le lien vaut pour des chiffres tirés du même exercice.',
        'Les lectures sont des repères pédagogiques de la leçon, pas un jugement sur une société.',
      ]}
      reinit={reel ? undefined : () => setVals(sim.societes.map((s) => ({ per: String(s.per).replace('.', ','), roe: String(s.roe_pct).replace('.', ',') })))}
    >
      <ChoixSource id={id} codes={sim.codes} reel={reel} setReel={setReel} code={code} setCode={setCode} libelleFictif="Sociétés fictives de la leçon" />
      {reel ? (
        <>
          <EtatReel e={etat} />
          {reelPret && (
            <div className="lp-resultat" aria-live="polite" aria-atomic="true">
              <Synthese items={[
                ['PER', reelPret.per == null ? 'Sans signification' : nombre(reelPret.per, 1)],
                ['ROE', reelPret.roePct == null ? 'Non calculable' : pct(reelPret.roePct)],
                ['P/B', reelPret.pb == null ? 'Non calculable' : nombre(reelPret.pb, 2)],
                ['PER × ROE', reelPret.per != null && reelPret.roePct != null ? nombre((reelPret.per * reelPret.roePct) / 100, 2) : '—'],
              ]} />
              <p className="lp-verdict">
                {reelPret.per != null && reelPret.roePct != null
                  ? lecturePbRoe(reelPret.per, reelPret.roePct)
                  : 'Avec un résultat nul ou négatif, le PER n’a pas de sens et le lien P/B = PER × ROE ne se lit plus.'}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="lp-societes">
            {sim.societes.map((s, i) => (
              <fieldset key={s.nom} className="lp-champ-groupe">
                <legend>{s.nom}</legend>
                <Grille>
                  <Champ id={`${id}-${i}-p`} label="PER" value={vals[i]!.per} onChange={(x) => setVals((v) => v.map((o, j) => (j === i ? { ...o, per: x } : o)))} />
                  <Champ id={`${id}-${i}-r`} label="ROE" unite="%" value={vals[i]!.roe} onChange={(x) => setVals((v) => v.map((o, j) => (j === i ? { ...o, roe: x } : o)))} />
                </Grille>
              </fieldset>
            ))}
          </div>
          <Resultat calc={calc}>
            {calc.ok && <Synthese items={calc.r.lignes.map((l) => [`P/B de ${l.nom}`, nombre(l.pb, 2)] as [string, string])} />}
          </Resultat>
        </>
      )}
    </Cadre>
  );
}

// ── 6. Banque ───────────────────────────────────────────────────────────────

function Banque({ sim }: { sim: Extract<Simulation, { type: 'banque' }> }) {
  const id = useId();
  const c = useChamps({ pnb: sim.pnb, frais: sim.frais_generaux, risque: sim.cout_risque });
  const calc = essayer(() => calculerBanque({ pnb: c.n.pnb, frais_generaux: c.n.frais, cout_risque: c.n.risque }));
  const u = sim.unite;
  return (
    <Cadre
      titre="Ce que les frais et le coût du risque laissent à la banque"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        `Montants en ${u}, avant impôt. Le résultat avant impôt ne tient pas compte des éléments exceptionnels.`,
        'Valeurs d’illustration : la plupart des banques publient elles-mêmes ces indicateurs dans leur rapport d’activité.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-p`} label="Produit net bancaire" unite={u} value={c.v.pnb} onChange={c.set('pnb')} />
        <Champ id={`${id}-f`} label="Frais généraux" unite={u} value={c.v.frais} onChange={c.set('frais')} />
        <Champ id={`${id}-r`} label="Coût du risque" unite={u} value={c.v.risque} onChange={c.set('risque')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Coefficient d’exploitation', pct(calc.r.coefficientPct)],
            ['Résultat brut d’exploitation', `${nombre(calc.r.resultatBrutExploitation, 1)} ${u}`],
            ['Résultat avant impôt', `${nombre(calc.r.resultatAvantImpot, 1)} ${u}`],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── Module zéro : croissance (TCAM), endettement, ROE moyen ─────────────────

function Croissance({ sim }: { sim: Extract<Simulation, { type: 'croissance' }> }) {
  const id = useId();
  const c = useChamps({ ini: sim.valeur_initiale, fin: sim.valeur_finale, ans: sim.annees });
  const calc = essayer(() => calculerCroissance({ valeur_initiale: c.n.ini, valeur_finale: c.n.fin, annees: c.n.ans }));
  const u = sim.unite;
  return (
    <Cadre
      titre="Croissance totale et taux de croissance annuel moyen (TCAM)"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Le nombre d’années est l’écart entre les deux exercices : de 2021 à 2025, il y en a 4.',
        'Le TCAM suppose une progression régulière : la trajectoire affichée n’est pas celle des comptes publiés.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-i`} label="Valeur initiale" unite={u} value={c.v.ini} onChange={c.set('ini')} />
        <Champ id={`${id}-f`} label="Valeur finale" unite={u} value={c.v.fin} onChange={c.set('fin')} />
        <Champ id={`${id}-a`} label="Nombre d’années" unite="ans" value={c.v.ans} onChange={c.set('ans')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Croissance totale', pct(calc.r.croissanceTotalePct)],
            ['TCAM', pct(calc.r.tcamPct, 2)],
            ['Valeur à mi-parcours (régulière)', `${nombre(calc.r.trajectoire[Math.floor(calc.r.trajectoire.length / 2)]!, 1)} ${u}`],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

function Endettement({ sim }: { sim: Extract<Simulation, { type: 'endettement' }> }) {
  const id = useId();
  const c = useChamps({
    dettes: sim.dettes_financieres, treso: sim.tresorerie, cp: sim.capitaux_propres,
    ro: sim.resultat_operationnel, interets: sim.charges_interets,
  });
  const calc = essayer(() => calculerEndettement({
    dettes_financieres: c.n.dettes, tresorerie: c.n.treso, capitaux_propres: c.n.cp,
    resultat_operationnel: c.n.ro, charges_interets: c.n.interets,
  }));
  const u = sim.unite;
  return (
    <Cadre
      titre="Dette nette, gearing et couverture des intérêts"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        `Montants en ${u}, lus au bilan et au compte de résultat du même exercice.`,
        'Réservé aux entreprises non financières : pour une banque, la dette est la matière première, ces ratios n’ont pas de sens.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-d`} label="Emprunts et dettes financières" unite={u} value={c.v.dettes} onChange={c.set('dettes')} />
        <Champ id={`${id}-t`} label="Trésorerie" unite={u} value={c.v.treso} onChange={c.set('treso')} />
        <Champ id={`${id}-c`} label="Capitaux propres" unite={u} value={c.v.cp} onChange={c.set('cp')} />
        <Champ id={`${id}-r`} label="Résultat opérationnel" unite={u} value={c.v.ro} onChange={c.set('ro')} />
        <Champ id={`${id}-i`} label="Charges d’intérêts" unite={u} value={c.v.interets} onChange={c.set('interets')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Dette nette', `${nombre(calc.r.detteNette, 1)} ${u}`],
            ['Gearing', pct(calc.r.gearingPct)],
            ['Couverture des intérêts', calc.r.couverture == null ? 'non calculable' : `${nombre(calc.r.couverture, 1)} fois`],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

function RoeMoyen({ sim }: { sim: Extract<Simulation, { type: 'roe_moyen' }> }) {
  const id = useId();
  const c = useChamps({
    rn: sim.resultat_net, cpd: sim.capitaux_debut, cpf: sim.capitaux_fin,
    ad: sim.actif_debut ?? 0, af: sim.actif_fin ?? 0,
  });
  const calc = essayer(() => calculerRoeMoyen({
    resultat_net: c.n.rn, capitaux_debut: c.n.cpd, capitaux_fin: c.n.cpf,
    actif_debut: c.n.ad > 0 ? c.n.ad : undefined, actif_fin: c.n.af > 0 ? c.n.af : undefined,
  }));
  const u = sim.unite;
  return (
    <Cadre
      titre="ROE sur capitaux propres moyens ou de clôture"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Capitaux propres moyens = (début + fin) ÷ 2, soit la clôture de l’exercice précédent et celle de l’exercice étudié.',
        'Laissez l’actif à zéro pour ne pas calculer le ROA.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-r`} label="Résultat net de l’exercice" unite={u} value={c.v.rn} onChange={c.set('rn')} />
        <Champ id={`${id}-d`} label="Capitaux propres au début" unite={u} value={c.v.cpd} onChange={c.set('cpd')} />
        <Champ id={`${id}-f`} label="Capitaux propres à la fin" unite={u} value={c.v.cpf} onChange={c.set('cpf')} />
        <Champ id={`${id}-ad`} label="Total de l’actif au début" unite={u} value={c.v.ad} onChange={c.set('ad')} />
        <Champ id={`${id}-af`} label="Total de l’actif à la fin" unite={u} value={c.v.af} onChange={c.set('af')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['ROE (capitaux moyens)', pct(calc.r.roeMoyenPct)],
            ['ROE (capitaux de clôture)', pct(calc.r.roeClotPct)],
            ['ROA (actif moyen)', calc.r.roaMoyenPct == null ? 'non calculé' : pct(calc.r.roaMoyenPct, 2)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 7. DPS ──────────────────────────────────────────────────────────────────

function Dps({ sim }: { sim: Extract<Simulation, { type: 'dps' }> }) {
  const id = useId();
  const c = useChamps({ cours: sim.cours, prix: sim.prix_emission, parite: sim.parite, actions: sim.actions });
  const calc = essayer(() => calculerDps({ cours: c.n.cours, prix_emission: c.n.prix, parite: c.n.parite, actions: c.n.actions }));
  return (
    <Cadre
      titre="Augmentation de capital : la valeur d’un droit et vos trois choix"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Valeurs théoriques : en séance, le droit cote selon l’offre et la demande et s’écarte de ce calcul.',
        'Hors frais de courtage sur la vente ou l’achat de droits. Exemple fictif.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-c`} label="Cours avant l’opération" unite="FCFA" value={c.v.cours} onChange={c.set('cours')} />
        <Champ id={`${id}-p`} label="Prix d’émission" unite="FCFA" value={c.v.prix} onChange={c.set('prix')} />
        <Champ id={`${id}-r`} label="Parité : actions anciennes pour 1 nouvelle" entier value={c.v.parite} onChange={c.set('parite')} />
        <Champ id={`${id}-n`} label="Actions détenues" entier value={c.v.actions} onChange={c.set('actions')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Valeur théorique du droit', fcfa(calc.r.valeurDroit)],
            ['Cours théorique après détachement', fcfa(calc.r.coursTheorique)],
            ['Souscrire', `${nombre(calc.r.nouvellesPossibles)} action(s), ${fcfa(calc.r.coutSouscription)}`],
            ['Vendre les droits', fcfa(calc.r.valeurDroits)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 8. Rendement net d'IRVM ─────────────────────────────────────────────────

function RendementNet({ sim }: { sim: Extract<Simulation, { type: 'rendement_net' }> }) {
  const id = useId();
  const c = useChamps({ brut: sim.dividende_brut, cours: sim.cours });
  const [pays, setPays] = useState<PaysUemoa>(sim.pays);
  const calc = essayer(() => calculerRendementNet({ dividende_brut: c.n.brut, cours: c.n.cours, pays }));
  return (
    <Cadre
      titre="Du dividende brut au dividende net"
      consigne={sim.consigne}
      reinit={() => { c.reinit(); setPays(sim.pays); }}
      hypotheses={[
        'Taux de retenue à la source des personnes physiques, selon le pays de la société qui verse le dividende (barème WestBourse, page Fiscalité, sources citées).',
        'Un taux non vérifié n’est jamais supposé : la ligne reste sans montant. Votre pays de résidence peut aussi imposer ce revenu.',
        ...(sim.euros ? [`Conversion en euros à la parité fixe : 1 € = ${nombre(PARITE_EUR_FCFA, 3)} FCFA, avant frais de virement.`] : []),
      ]}
    >
      <Grille>
        <Champ id={`${id}-d`} label="Dividende brut par action" unite="FCFA" value={c.v.brut} onChange={c.set('brut')} />
        <Champ id={`${id}-c`} label="Cours de l’action" unite="FCFA" value={c.v.cours} onChange={c.set('cours')} />
        <div className="lp-champ">
          <label htmlFor={`${id}-p`}>Pays de la société</label>
          <select id={`${id}-p`} value={pays} onChange={(e) => setPays(e.target.value as PaysUemoa)}>
            {(Object.keys(PAYS_LABELS) as PaysUemoa[]).map((p) => <option key={p} value={p}>{PAYS_LABELS[p]}</option>)}
          </select>
        </div>
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <div className="lp-table-wrap">
            <table className="lp-table">
              <caption className="sr-only">Dividende net et rendement net selon le pays de la société</caption>
              <thead>
                <tr>
                  <th scope="col">Pays de la société</th>
                  <th scope="col" className="lp-num">Retenue</th>
                  <th scope="col" className="lp-num">Net par action</th>
                  <th scope="col" className="lp-num">Rendement net</th>
                  {sim.euros && <th scope="col" className="lp-num">Net en euros</th>}
                </tr>
              </thead>
              <tbody>
                {calc.r.lignes.map((l) => (
                  <tr key={l.pays} aria-current={l.pays === pays ? 'true' : undefined} className={l.pays === pays ? 'lp-ligne-choisie' : undefined}>
                    <th scope="row" className="lp-ligne-tete">{l.libelle}</th>
                    <td className="lp-num">{l.taux == null ? 'Non vérifié' : pct(l.taux * 100)}</td>
                    <td className="lp-num">{l.net == null ? '—' : fcfa(l.net)}</td>
                    <td className="lp-num">{l.rendementNetPct == null ? '—' : pct(l.rendementNetPct, 2)}</td>
                    {sim.euros && <td className="lp-num">{l.netEuros == null ? '—' : `${nombre(l.netEuros, 2)} €`}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 9. Obligation ───────────────────────────────────────────────────────────

function Obligation({ sim }: { sim: Extract<Simulation, { type: 'obligation' }> }) {
  const id = useId();
  const c = useChamps({ nominal: sim.nominal, taux: sim.taux_nominal_pct, prix: sim.prix, annees: sim.annees_restantes, jours: sim.jours_ecoules, marche: sim.taux_marche_pct });
  const calc = essayer(() => calculerObligation({ nominal: c.n.nominal, taux_nominal_pct: c.n.taux, prix: c.n.prix, annees_restantes: c.n.annees, jours_ecoules: c.n.jours, taux_marche_pct: c.n.marche }));
  return (
    <Cadre
      titre="Prix, coupon et rendement d’une obligation"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Obligation remboursée en une fois à l’échéance (in fine), coupon annuel. Un emprunt amorti rend son capital par tranches : son rendement se calcule autrement.',
        'Rendement actuariel : le taux qui égalise le prix payé et les flux futurs, si l’émetteur paie tout à l’heure. Avant impôt. Exemple fictif.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-n`} label="Valeur nominale" unite="FCFA" value={c.v.nominal} onChange={c.set('nominal')} />
        <Champ id={`${id}-t`} label="Taux nominal" unite="%" value={c.v.taux} onChange={c.set('taux')} />
        <Champ id={`${id}-p`} label="Prix payé" unite="FCFA" value={c.v.prix} onChange={c.set('prix')} />
        <Champ id={`${id}-a`} label="Durée restante" unite="années" entier value={c.v.annees} onChange={c.set('annees')} />
        <Champ id={`${id}-j`} label="Jours depuis le dernier coupon" entier value={c.v.jours} onChange={c.set('jours')} />
        <Champ id={`${id}-m`} label="Taux d’un nouvel emprunt comparable" unite="%" value={c.v.marche} onChange={c.set('marche')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Coupon annuel', fcfa(calc.r.coupon)],
            ['Rendement courant', pct(calc.r.rendementCourantPct, 2)],
            ['Rendement actuariel', calc.r.rendementActuarielPct == null ? 'Non calculable' : pct(calc.r.rendementActuarielPct, 2)],
            ['Prix au taux de marché', fcfa(calc.r.prixAuTauxMarche)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 10. Frais d'OPCVM ───────────────────────────────────────────────────────

function Opcvm({ sim }: { sim: Extract<Simulation, { type: 'opcvm_frais' }> }) {
  const id = useId();
  const c = useChamps({ montant: sim.montant, annees: sim.annees, entree: sim.frais_entree_pct, gestion: sim.frais_gestion_pct, sortie: sim.frais_sortie_pct, perf: sim.performance_pct });
  const calc = essayer(() => calculerOpcvm({ montant: c.n.montant, annees: c.n.annees, frais_entree_pct: c.n.entree, frais_gestion_pct: c.n.gestion, frais_sortie_pct: c.n.sortie, performance_pct: c.n.perf }));
  return (
    <Cadre
      titre="Ce que les frais d’un fonds coûtent sur la durée"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Frais de gestion prélevés chaque année sur l’encours ; performance des titres supposée identique chaque année.',
        'Les taux réels figurent dans le prospectus du fonds. Exemple fictif.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-m`} label="Somme investie" unite="FCFA" value={c.v.montant} onChange={c.set('montant')} />
        <Champ id={`${id}-a`} label="Durée" unite="années" entier value={c.v.annees} onChange={c.set('annees')} />
        <Champ id={`${id}-e`} label="Frais d’entrée" unite="%" value={c.v.entree} onChange={c.set('entree')} />
        <Champ id={`${id}-g`} label="Frais de gestion annuels" unite="%" value={c.v.gestion} onChange={c.set('gestion')} />
        <Champ id={`${id}-s`} label="Frais de sortie" unite="%" value={c.v.sortie} onChange={c.set('sortie')} />
        <Champ id={`${id}-p`} label="Performance annuelle des titres, avant frais" unite="%" value={c.v.perf} onChange={c.set('perf')} aide="0 : l’encours reste stable, comme dans l’exemple de la leçon." />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <>
            <CourbeAnnees
              donnees={calc.r.points.map((p) => ({ annee: `An ${p.annee}`, a: p.avecFrais, b: p.sansFrais }))}
              a="Avec les frais"
              b="Sans frais"
              resume={`Après ${calc.r.points.length - 1} ans : ${fcfa(calc.r.valeurFinale)} avec frais, ${fcfa(calc.r.valeurSansFrais)} sans.`}
            />
            <Synthese items={[
              ['Valeur finale', fcfa(calc.r.valeurFinale)],
              ['Total des frais', `${fcfa(calc.r.totalFrais)} (${pct(calc.r.totalFraisPct)})`],
              ['Performance pour compenser', `${pct(calc.r.performancePourCompenserPct, 2)} par an`],
            ]} />
          </>
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 11. Taille de position ──────────────────────────────────────────────────

function Position({ sim }: { sim: Extract<Simulation, { type: 'position' }> }) {
  const id = useId();
  const c = useChamps({ pf: sim.portefeuille, risque: sim.risque_pct, achat: sim.prix_achat, stop: sim.stop, objectif: sim.objectif });
  const calc = essayer(() => calculerPosition({ portefeuille: c.n.pf, risque_pct: c.n.risque, prix_achat: c.n.achat, stop: c.n.stop, objectif: c.n.objectif }));
  return (
    <Cadre
      titre="Partir du risque, pas de la somme"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Le stop est une décision fixée à l’avance. Sur une valeur peu échangée, le cours peut le franchir d’une séance à l’autre : la perte réelle peut dépasser la perte prévue.',
        'Hors frais de courtage. Le taux de 1 % est un repère pédagogique, pas une règle. Exemple fictif.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-pf`} label="Portefeuille" unite="FCFA" value={c.v.pf} onChange={c.set('pf')} />
        <Champ id={`${id}-r`} label="Risque accepté par position" unite="% du portefeuille" value={c.v.risque} onChange={c.set('risque')} />
        <Champ id={`${id}-a`} label="Prix d’achat" unite="FCFA" value={c.v.achat} onChange={c.set('achat')} />
        <Champ id={`${id}-s`} label="Stop" unite="FCFA" value={c.v.stop} onChange={c.set('stop')} />
        <Champ id={`${id}-o`} label="Objectif (facultatif)" unite="FCFA" value={c.v.objectif} onChange={c.set('objectif')} aide="Un niveau visible sur le graphique, comme un ancien sommet. 0 pour l’ignorer." />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Perte maximale acceptée', fcfa(calc.r.risqueMax)],
            ['Nombre d’actions', nombre(calc.r.actions)],
            ['Somme investie', `${fcfa(calc.r.investi)} (${pct(calc.r.partPortefeuillePct)})`],
            ['Rapport gain sur risque', calc.r.rapportGainRisque == null ? '—' : nombre(calc.r.rapportGainRisque, 1)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 12. Souscription à une introduction ─────────────────────────────────────

function Souscription({ sim }: { sim: Extract<Simulation, { type: 'souscription_ipo' }> }) {
  const id = useId();
  const c = useChamps({ offerts: sim.titres_offerts, prix: sim.prix, taux: sim.taux_souscription_pct, demande: sim.demande });
  const calc = essayer(() => calculerSouscription({ titres_offerts: c.n.offerts, prix: c.n.prix, taux_souscription_pct: c.n.taux, demande: c.n.demande }));
  return (
    <Cadre
      titre="Une offre sursouscrite : combien de titres recevriez-vous ?"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Réduction strictement proportionnelle, supposée ici pour le calcul. Les règles réelles (tranches, catégories d’investisseurs, minimum servi) sont annoncées dans la note d’information de chaque opération.',
        'L’argent non utilisé est rendu après l’opération ; il ne rapporte rien pendant qu’il est bloqué. Hors frais.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-o`} label="Titres offerts" entier value={c.v.offerts} onChange={c.set('offerts')} />
        <Champ id={`${id}-p`} label="Prix de l’offre" unite="FCFA" value={c.v.prix} onChange={c.set('prix')} />
        <Champ id={`${id}-t`} label="Taux de souscription" unite="%" value={c.v.taux} onChange={c.set('taux')} aide="Demande totale ÷ titres offerts." />
        <Champ id={`${id}-d`} label="Titres que vous demandez" entier value={c.v.demande} onChange={c.set('demande')} />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Taux de service', pct(calc.r.coefficientServicePct)],
            ['Titres reçus', nombre(calc.r.titresServis)],
            ['Montant engagé', fcfa(calc.r.montantEngage)],
            ['Montant rendu', fcfa(calc.r.montantRendu)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 13. Affectation du résultat ─────────────────────────────────────────────

function Distribution({ sim }: { sim: Extract<Simulation, { type: 'distribution' }> }) {
  const id = useId();
  const c = useChamps({ resultat: sim.resultat_net, actions: sim.actions });
  const [taux, setTaux] = useState(sim.taux_distribution_pct);
  const calc = essayer(() => calculerDistribution({ resultat_net: c.n.resultat, actions: c.n.actions, taux_distribution_pct: taux }));
  return (
    <Cadre
      titre="L’assemblée décide : distribuer ou mettre en réserve"
      consigne={sim.consigne}
      reinit={() => { c.reinit(); setTaux(sim.taux_distribution_pct); }}
      hypotheses={[
        'Le dividende versé une année dépend du résultat de l’exercice précédent et du vote de l’assemblée. Montants bruts, avant impôt.',
        'Exemple fictif, sans lien avec une société cotée.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-r`} label="Résultat net de l’exercice" unite="FCFA" value={c.v.resultat} onChange={c.set('resultat')} />
        <Champ id={`${id}-n`} label="Nombre d’actions" entier value={c.v.actions} onChange={c.set('actions')} />
      </Grille>
      <div className="lp-curseur lp-curseur--seul">
        <label htmlFor={`${id}-t`}>Part distribuée</label>
        <input id={`${id}-t`} type="range" min={0} max={120} step={5} value={taux} aria-valuetext={`${taux} % du bénéfice`} onChange={(e) => setTaux(Number(e.target.value))} />
        <output htmlFor={`${id}-t`}>{taux} %</output>
      </div>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Bénéfice par action', fcfa(calc.r.bpa)],
            ['Dividende par action', fcfa(calc.r.dpa)],
            ['Mis en réserve', fcfa(calc.r.misEnReserve)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 14. Change ──────────────────────────────────────────────────────────────

function Change({ sim }: { sim: Extract<Simulation, { type: 'change' }> }) {
  const id = useId();
  const c = useChamps({ eur: sim.montant_eur, pct: sim.frais_pct, fixe: sim.frais_fixes_eur, cours: sim.cours_action });
  const calc = essayer(() => calculerChange({ montant_eur: c.n.eur, frais_pct: c.n.pct, frais_fixes_eur: c.n.fixe, cours_action: c.n.cours }));
  return (
    <Cadre
      titre="Envoyer des euros vers son compte en FCFA"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        `Parité fixe : 1 € = ${nombre(PARITE_EUR_FCFA, 3)} FCFA. Les frais dépendent de votre banque et de celle de votre SGI : renseignez les vôtres.`,
        'Les frais sont retirés en euros avant la conversion. Hors frais de courtage sur l’achat d’actions.',
      ]}
    >
      <Grille>
        <Champ id={`${id}-e`} label="Montant envoyé" unite="€" value={c.v.eur} onChange={c.set('eur')} />
        <Champ id={`${id}-p`} label="Frais proportionnels" unite="%" value={c.v.pct} onChange={c.set('pct')} />
        <Champ id={`${id}-f`} label="Frais fixes par virement" unite="€" value={c.v.fixe} onChange={c.set('fixe')} />
        <Champ id={`${id}-c`} label="Cours d’une action (facultatif)" unite="FCFA" value={c.v.cours} onChange={c.set('cours')} aide="0 pour ne pas compter les titres." />
      </Grille>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Frais', `${nombre(calc.r.fraisEur, 2)} € (${pct(calc.r.fraisPct)})`],
            ['Reçu sur le compte', fcfa(calc.r.fcfa)],
            ...(calc.r.actions != null ? [['Titres achetables', nombre(calc.r.actions)] as [string, string]] : []),
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

// ── 15. Chandelier ──────────────────────────────────────────────────────────

function Bougie({ o, h, b, c }: { o: number; h: number; b: number; c: number }) {
  const H = 200;
  const marge = 12;
  const y = (v: number) => marge + ((h - v) / (h - b || 1)) * (H - 2 * marge);
  const hausse = c >= o;
  const haut = Math.min(y(o), y(c));
  const hauteur = Math.max(2, Math.abs(y(o) - y(c)));
  const couleur = hausse ? '#1d7a46' : '#a3401f';
  return (
    <svg viewBox={`0 0 140 ${H}`} width="140" height={H} className="lp-bougie" aria-hidden="true">
      <line x1="70" x2="70" y1={y(h)} y2={y(b)} stroke="#0f1f33" strokeWidth="2" />
      <rect x="45" y={haut} width="50" height={hauteur} fill={hausse ? '#fbf8f3' : couleur} stroke={couleur} strokeWidth="2.5" rx="2" />
      <text x="104" y={y(h) + 4} fontSize="11" fill="#5d6b7d">{nombre(h)}</text>
      <text x="104" y={y(b) + 4} fontSize="11" fill="#5d6b7d">{nombre(b)}</text>
      <text x="2" y={y(o) + 4} fontSize="11" fill="#5d6b7d">{nombre(o)}</text>
      <text x="2" y={y(c) + 4} fontSize="11" fill={couleur} fontWeight="600">{nombre(c)}</text>
    </svg>
  );
}

function Chandelier({ sim }: { sim: Extract<Simulation, { type: 'chandelier' }> }) {
  const id = useId();
  const c = useChamps({ o: sim.ouverture, h: sim.haut, b: sim.bas, c: sim.cloture });
  const calc = essayer(() => lireBougie({ ouverture: c.n.o, haut: c.n.h, bas: c.n.b, cloture: c.n.c }));
  return (
    <Cadre
      titre="Construire une bougie à partir de quatre prix"
      consigne={sim.consigne}
      reinit={c.reinit}
      hypotheses={[
        'Conventions de ce simulateur : doji si le corps fait au plus 10 % de l’amplitude ; mèche « longue » si elle mesure au moins deux fois le corps.',
        'Prix fictifs. À la BRVM, plus haut et plus bas d’une séance ne sont pas toujours publiés : beaucoup de graphiques n’y montrent que la clôture.',
      ]}
    >
      <div className="lp-bougie-atelier">
        <Grille>
          <Champ id={`${id}-o`} label="Ouverture" unite="FCFA" value={c.v.o} onChange={c.set('o')} />
          <Champ id={`${id}-h`} label="Plus haut" unite="FCFA" value={c.v.h} onChange={c.set('h')} />
          <Champ id={`${id}-b`} label="Plus bas" unite="FCFA" value={c.v.b} onChange={c.set('b')} />
          <Champ id={`${id}-c`} label="Clôture" unite="FCFA" value={c.v.c} onChange={c.set('c')} />
        </Grille>
        {calc.ok && <Bougie o={c.n.o} h={c.n.h} b={c.n.b} c={c.n.c} />}
      </div>
      <Resultat calc={calc}>
        {calc.ok && (
          <Synthese items={[
            ['Corps', fcfa(calc.r.corps)],
            ['Mèche haute', fcfa(calc.r.mecheHaute)],
            ['Mèche basse', fcfa(calc.r.mecheBasse)],
          ]} />
        )}
      </Resultat>
    </Cadre>
  );
}

export default function SimulateurLecon({ sim }: { sim: SimulationSimple }) {
  switch (sim.type) {
    case 'frais_ordre': return <FraisOrdre sim={sim} />;
    case 'rendement_total': return <RendementTotal sim={sim} />;
    case 'valeur_future': return <ValeurFuture sim={sim} />;
    case 'per': return <Per sim={sim} />;
    case 'pb_roe': return <PbRoe sim={sim} />;
    case 'banque': return <Banque sim={sim} />;
    case 'dps': return <Dps sim={sim} />;
    case 'rendement_net': return <RendementNet sim={sim} />;
    case 'obligation': return <Obligation sim={sim} />;
    case 'opcvm_frais': return <Opcvm sim={sim} />;
    case 'position': return <Position sim={sim} />;
    case 'souscription_ipo': return <Souscription sim={sim} />;
    case 'distribution': return <Distribution sim={sim} />;
    case 'change': return <Change sim={sim} />;
    case 'chandelier': return <Chandelier sim={sim} />;
    case 'croissance': return <Croissance sim={sim} />;
    case 'endettement': return <Endettement sim={sim} />;
    case 'roe_moyen': return <RoeMoyen sim={sim} />;
  }
}

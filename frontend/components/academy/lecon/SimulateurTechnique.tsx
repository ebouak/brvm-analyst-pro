'use client';

import { useEffect, useId, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Simulation } from '@/lib/academy/types';
import { SaisieInvalide } from '@/lib/academy/simulateurs';
import {
  lectureMacd,
  lectureMoyennes,
  lectureRsi,
  lectureVariation,
  type PointSerie,
} from '@/lib/academy/simTechnique';
import { dateSeanceLongue } from '@/components/CarnetOrdres';

/**
 * Indicateur technique sur les clôtures RÉELLES d'une valeur choisie parmi les
 * codes de la leçon (/api/academy/serie, cache 1 h). Les calculs et les
 * phrases viennent de lib/academy/simTechnique.ts (purs, testés) ; une
 * description, jamais une recommandation. Date de dernière séance et source
 * toujours écrites ; un historique trop court est dit, pas complété.
 */

type Sim = Extract<Simulation, { type: 'technique' }>;
type Etat = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; nom: string | null; points: PointSerie[] };

const nombre = (n: number, dec = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec }).format(n);
const pct = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(n)} %`.replace('-', '−');
const COULEUR = { cours: '#0f1f33', a: '#0b7d93', b: '#a3401f', axe: '#5d6b7d', trame: '#e6dfd3', hausse: '#1d7a46' };
const jourCourt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

const TITRES: Record<Sim['indicateur'], string> = {
  variation: 'Une même valeur, quatre horizons',
  moyennes: 'Le cours face à ses moyennes mobiles',
  rsi: 'Le RSI sur une série réelle',
  macd: 'Le MACD et son histogramme sur une série réelle',
};

function useSerie(code: string): Etat {
  const [e, setE] = useState<Etat>({ etat: 'chargement' });
  useEffect(() => {
    const ctrl = new AbortController();
    setE({ etat: 'chargement' });
    fetch(`/api/academy/serie?code=${encodeURIComponent(code)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { nom: string | null; points: PointSerie[] };
        setE({ etat: 'pret', nom: j.nom, points: j.points });
      })
      .catch((err: unknown) => { if ((err as { name?: string }).name !== 'AbortError') setE({ etat: 'erreur' }); });
    return () => ctrl.abort();
  }, [code]);
  return e;
}

function essayer<T>(f: () => T): { ok: true; r: T } | { ok: false; message: string } {
  try {
    return { ok: true, r: f() };
  } catch (e) {
    return { ok: false, message: e instanceof SaisieInvalide ? e.message : 'Calcul impossible sur cette série.' };
  }
}

function Curseur({ id, label, min, max, step = 1, value, onChange, unite = 'séances' }: {
  id: string; label: string; min: number; max: number; step?: number; value: number; onChange: (n: number) => void; unite?: string;
}) {
  return (
    <div className="lp-curseur">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value} ${unite}`} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{value} {unite}</output>
    </div>
  );
}

const axeX = { tick: { fill: COULEUR.axe, fontSize: 11 }, axisLine: { stroke: COULEUR.trame }, tickLine: false, minTickGap: 28, tickFormatter: jourCourt } as const;
const axeY = { tick: { fill: COULEUR.axe, fontSize: 11 }, axisLine: false, tickLine: false, width: 56 } as const;
const bulle = { contentStyle: { background: '#fff', border: `1px solid ${COULEUR.trame}`, borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#0f1f33' } } as const;

export default function SimulateurTechnique({ sim }: { sim: Sim }) {
  const id = useId();
  const [code, setCode] = useState(sim.codes[0]!);
  const serie = useSerie(code);
  const [courte, setCourte] = useState(sim.courte);
  const [longue, setLongue] = useState(sim.longue);
  const [periode, setPeriode] = useState(sim.periode);
  const [haut, setHaut] = useState(sim.seuil_haut);
  const [bas, setBas] = useState(sim.seuil_bas);
  const [fenetre, setFenetre] = useState(120);

  const points = serie.etat === 'pret' ? serie.points : [];
  const calc = serie.etat !== 'pret'
    ? null
    : sim.indicateur === 'variation'
      ? essayer(() => lectureVariation(points))
      : sim.indicateur === 'moyennes'
        ? essayer(() => lectureMoyennes(points, courte, Math.max(longue, courte + 1)))
        : sim.indicateur === 'rsi'
          ? essayer(() => lectureRsi(points, periode, haut, bas))
          : essayer(() => lectureMacd(points));
  const derniere = points.at(-1) ?? null;
  const reinit = () => { setCourte(sim.courte); setLongue(sim.longue); setPeriode(sim.periode); setHaut(sim.seuil_haut); setBas(sim.seuil_bas); setFenetre(120); };

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <div className="lp-figure-tete">
        <p className="lp-figure-titre">{TITRES[sim.indicateur]}</p>
        <span className="lp-badge lp-badge--reel">Données réelles</span>
      </div>
      {sim.consigne && <p className="lp-note lp-note--haut">{sim.consigne}</p>}

      <div className="lp-champ">
        <label htmlFor={`${id}-code`}>Valeur</label>
        <select id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)}>
          {sim.codes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {sim.indicateur !== 'variation' && (
        <div className="lp-curseurs lp-bloc-court">
          <Curseur id={`${id}-f`} label="Séances affichées" min={40} max={250} step={10} value={fenetre} onChange={setFenetre} />
          {sim.indicateur === 'moyennes' && (
            <>
              <Curseur id={`${id}-mc`} label="Moyenne courte" min={5} max={50} value={courte} onChange={(n) => { setCourte(n); if (longue <= n) setLongue(n + 1); }} />
              <Curseur id={`${id}-ml`} label="Moyenne longue" min={20} max={150} value={longue} onChange={(n) => { setLongue(n); if (courte >= n) setCourte(n - 1); }} />
            </>
          )}
          {sim.indicateur === 'rsi' && (
            <>
              <Curseur id={`${id}-p`} label="Période du RSI" min={5} max={30} value={periode} onChange={setPeriode} />
              <Curseur id={`${id}-h`} label="Seuil haut" min={60} max={90} step={5} value={haut} onChange={setHaut} unite="" />
              <Curseur id={`${id}-b`} label="Seuil bas" min={10} max={40} step={5} value={bas} onChange={setBas} unite="" />
            </>
          )}
        </div>
      )}

      {serie.etat === 'chargement' && <p className="lp-note" role="status">Lecture des clôtures…</p>}
      {serie.etat === 'erreur' && <p className="lp-alerte-texte" role="alert">Les cours sont indisponibles pour le moment. Réessayez plus tard.</p>}

      {calc && !calc.ok && <p className="lp-alerte-texte" role="status">{calc.message}</p>}

      {calc && calc.ok && 'lignes' in calc.r && (
        <div className="lp-table-wrap">
          <table className="lp-table">
            <caption className="sr-only">Variation du cours selon l’horizon</caption>
            <thead><tr><th scope="col">Horizon</th><th scope="col">Depuis la séance du</th><th scope="col" className="lp-num">Variation</th></tr></thead>
            <tbody>
              {calc.r.lignes.map((l) => (
                <tr key={l.libelle}>
                  <th scope="row" className="lp-ligne-tete">{l.libelle} ({l.seances} séances)</th>
                  <td>{l.depuis ? dateSeanceLongue(l.depuis) : 'Historique insuffisant'}</td>
                  <td className="lp-num">{l.variationPct == null ? '—' : pct(l.variationPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {calc && calc.ok && sim.indicateur === 'moyennes' && 'position' in calc.r && (
        <div className="lp-graphe" role="img" aria-label={`Cours et moyennes mobiles ${courte} et ${longue} séances de ${code}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={calc.r.points.slice(-fenetre)} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={COULEUR.trame} vertical={false} />
              <XAxis dataKey="date" {...axeX} />
              <YAxis {...axeY} domain={['auto', 'auto']} tickFormatter={(v: number) => nombre(v)} />
              <Tooltip {...bulle} labelFormatter={(d: string) => dateSeanceLongue(d)} formatter={(v: number, n: string) => [nombre(v, 1), n === 'cours' ? 'Cours' : n === 'courte' ? `MM ${courte}` : `MM ${longue}`]} />
              <Line dataKey="cours" stroke={COULEUR.cours} strokeWidth={1.6} dot={false} isAnimationActive={false} />
              <Line dataKey="courte" stroke={COULEUR.a} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="longue" stroke={COULEUR.b} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {sim.indicateur === 'moyennes' && calc?.ok && (
        <div className="lp-legende" aria-hidden="true">
          <span><i style={{ background: COULEUR.cours }} />Cours de clôture</span>
          <span><i style={{ background: COULEUR.a }} />Moyenne {courte} séances</span>
          <span><i style={{ background: COULEUR.b }} />Moyenne {longue} séances</span>
        </div>
      )}

      {calc && calc.ok && sim.indicateur === 'rsi' && 'zone' in calc.r && (
        <div className="lp-graphe" role="img" aria-label={`RSI ${periode} séances de ${code}, seuils ${haut} et ${bas}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={calc.r.points.slice(-fenetre)} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={COULEUR.trame} vertical={false} />
              <XAxis dataKey="date" {...axeX} />
              <YAxis {...axeY} domain={[0, 100]} ticks={[0, bas, 50, haut, 100]} />
              <ReferenceLine y={haut} stroke={COULEUR.b} strokeDasharray="4 4" />
              <ReferenceLine y={bas} stroke={COULEUR.hausse} strokeDasharray="4 4" />
              <Tooltip {...bulle} labelFormatter={(d: string) => dateSeanceLongue(d)} formatter={(v: number) => [nombre(v, 1), 'RSI']} />
              <Line dataKey="rsi" stroke={COULEUR.a} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {calc && calc.ok && sim.indicateur === 'macd' && 'etat' in calc.r && (
        <>
          <div className="lp-graphe" role="img" aria-label={`MACD 12, 26, 9 de ${code} : ligne MACD, ligne de signal et histogramme.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={calc.r.points.slice(-fenetre)} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={COULEUR.trame} vertical={false} />
                <XAxis dataKey="date" {...axeX} />
                <YAxis {...axeY} tickFormatter={(v: number) => nombre(v, 1)} />
                <ReferenceLine y={0} stroke={COULEUR.axe} />
                <Tooltip {...bulle} labelFormatter={(d: string) => dateSeanceLongue(d)} formatter={(v: number, n: string) => [nombre(v, 2), n === 'hist' ? 'Histogramme' : n === 'macd' ? 'MACD' : 'Signal']} />
                <Bar dataKey="hist" fill={COULEUR.axe} opacity={0.45} isAnimationActive={false} />
                <Line dataKey="macd" stroke={COULEUR.a} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line dataKey="signal" stroke={COULEUR.b} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="lp-legende" aria-hidden="true">
            <span><i style={{ background: COULEUR.a }} />Ligne MACD</span>
            <span><i style={{ background: COULEUR.b }} />Ligne de signal</span>
            <span><i style={{ background: COULEUR.axe }} />Histogramme</span>
          </div>
        </>
      )}

      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        {calc && calc.ok && (
          <>
            <p className="lp-verdict">{calc.r.lecture}</p>
            {calc.r.alertes.length > 0 && <ul className="lp-alertes">{calc.r.alertes.map((a) => <li key={a}>{a}</li>)}</ul>}
          </>
        )}
      </div>

      {sim.indicateur !== 'variation' && (
        <button type="button" className="lp-bouton lp-bouton--discret" onClick={reinit}>Revenir aux réglages de la leçon</button>
      )}

      <ul className="lp-hypotheses">
        {derniere && serie.etat === 'pret' && (
          <li>
            {serie.nom ?? code} ({code}) : {nombre(points.length)} clôtures, dernière séance le {dateSeanceLongue(derniere.date)}. Source : cours de clôture BRVM,
            base WestBourse ; indicateurs recalculés à l’ouverture du simulateur.
          </li>
        )}
        {serie.etat === 'pret' && points.length === 0 && <li>Aucune clôture en base pour cette valeur sur la période.</li>}
        <li>Une lecture technique décrit le passé. Ce n’est ni une prévision ni un conseil d’achat ou de vente.</li>
        <li>À la BRVM, une valeur peu échangée peut bouger sur quelques ordres : sur le court terme, le bruit domine.</li>
      </ul>
    </figure>
  );
}

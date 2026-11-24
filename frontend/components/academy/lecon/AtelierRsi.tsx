'use client';

import { useId, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Simulation } from '@/lib/academy/types';
import { SaisieInvalide } from '@/lib/academy/simulateurs';
import { rsiPasAPas } from '@/lib/academy/simTechnique';

/**
 * Atelier « le RSI pas à pas » (leçon 4 du niveau 3, 2026-11-24) : clôtures
 * FICTIVES modifiables, RSI calculé séance par séance avec le lissage de Wilder
 * (lib/academy/simTechnique.ts, égal à rsiSeries, testé). Le bouton « figer »
 * reproduit des séances sans échange : le RSI cesse alors de bouger.
 */

type Sim = Extract<Simulation, { type: 'rsi_pas_a_pas' }>;

const COULEUR = { rsi: '#0b7d93', haut: '#a3401f', bas: '#1d7a46', axe: '#5d6b7d', trame: '#e6dfd3' };
const nombre = (n: number, dec = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec }).format(n);
const signe = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(n)}`.replace('-', '−');
const lire = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));
const FIGEES = 5;

export default function AtelierRsi({ sim }: { sim: Sim }) {
  const id = useId();
  const initial = sim.clotures.map(String);
  const [v, setV] = useState(initial);
  const [periode, setPeriode] = useState(sim.periode);
  const clotures = v.map(lire);
  const maxPeriode = Math.min(14, clotures.length - 1);
  const n = Math.min(periode, maxPeriode);

  let calc: { ok: true; r: ReturnType<typeof rsiPasAPas> } | { ok: false; message: string };
  try {
    calc = { ok: true, r: rsiPasAPas(clotures, n) };
  } catch (e) {
    calc = { ok: false, message: e instanceof SaisieInvalide ? e.message : 'Calcul impossible.' };
  }
  const donnees = calc.ok ? calc.r.lignes.map((l) => ({ s: `S${l.seance}`, rsi: l.rsi == null ? null : Number(l.rsi.toFixed(1)) })) : [];
  const figer = () => setV((old) => {
    const ref = old[old.length - FIGEES - 1]!;
    return old.map((x, i) => (i >= old.length - FIGEES ? ref : x));
  });

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <div className="lp-figure-tete">
        <p className="lp-figure-titre">Le RSI calculé séance par séance</p>
        <span className="lp-badge">Simulation pédagogique</span>
      </div>
      {sim.consigne && <p className="lp-note lp-note--haut">{sim.consigne}</p>}

      <div className="lp-curseurs lp-bloc-court">
        <div className="lp-curseur">
          <label htmlFor={`${id}-n`}>RSI sur</label>
          <input id={`${id}-n`} type="range" min={2} max={maxPeriode} value={n} aria-valuetext={`${n} séances`} onChange={(e) => setPeriode(Number(e.target.value))} />
          <output htmlFor={`${id}-n`}>{n} séances</output>
        </div>
      </div>

      <div className="lp-table-wrap">
        <table className="lp-table lp-saisie-cours">
          <caption className="sr-only">Clôtures modifiables, variations, moyennes lissées et RSI à chaque séance</caption>
          <thead>
            <tr>
              <th scope="col">Séance</th>
              <th scope="col">Clôture</th>
              <th scope="col" className="lp-num">Variation</th>
              <th scope="col" className="lp-num">Hausse moyenne</th>
              <th scope="col" className="lp-num">Baisse moyenne</th>
              <th scope="col" className="lp-num">RSI</th>
            </tr>
          </thead>
          <tbody>
            {v.map((saisie, i) => {
              const l = calc.ok ? calc.r.lignes[i] : undefined;
              return (
                <tr key={i}>
                  <th scope="row">S{i + 1}</th>
                  <td>
                    <input
                      aria-label={`Clôture, séance ${i + 1}`}
                      inputMode="decimal"
                      value={saisie}
                      onChange={(e) => setV((old) => old.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                  </td>
                  <td className="lp-num">{l?.variation == null ? '—' : signe(l.variation)}</td>
                  <td className="lp-num">{l?.moyHausse == null ? '—' : nombre(l.moyHausse)}</td>
                  <td className="lp-num">{l?.moyBaisse == null ? '—' : nombre(l.moyBaisse)}</td>
                  <td className="lp-num">{l?.rsi == null ? '—' : nombre(l.rsi, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {calc.ok && (
        <>
          <div className="lp-graphe lp-graphe--court" role="img" aria-label={`RSI sur ${n} séances, seuils 70 et 30.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={donnees} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={COULEUR.trame} vertical={false} />
                <XAxis dataKey="s" tick={{ fill: COULEUR.axe, fontSize: 11 }} axisLine={{ stroke: COULEUR.trame }} tickLine={false} />
                <YAxis tick={{ fill: COULEUR.axe, fontSize: 11 }} axisLine={false} tickLine={false} width={36} domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} />
                <ReferenceLine y={70} stroke={COULEUR.haut} strokeDasharray="4 4" />
                <ReferenceLine y={30} stroke={COULEUR.bas} strokeDasharray="4 4" />
                <Tooltip formatter={(x: number) => [nombre(x, 1), 'RSI']} />
                <Line dataKey="rsi" stroke={COULEUR.rsi} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lp-legende" aria-hidden="true">
            <span><i style={{ background: COULEUR.rsi }} />RSI</span>
            <span><i style={{ background: COULEUR.haut }} />Seuil 70</span>
            <span><i style={{ background: COULEUR.bas }} />Seuil 30</span>
          </div>
        </>
      )}

      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        {calc.ok ? (
          <>
            <p className="lp-verdict">{calc.r.lecture}</p>
            {calc.r.alertes.length > 0 && <ul className="lp-alertes">{calc.r.alertes.map((a) => <li key={a}>{a}</li>)}</ul>}
          </>
        ) : (
          <p className="lp-alerte-texte">{calc.message}</p>
        )}
      </div>
      <div className="lp-actions">
        <button type="button" className="lp-bouton lp-bouton--discret" onClick={figer}>Figer le cours sur les {FIGEES} dernières séances</button>
        <button type="button" className="lp-bouton lp-bouton--discret" onClick={() => { setV(initial); setPeriode(sim.periode); }}>Revenir aux valeurs de la leçon</button>
      </div>
      <ul className="lp-hypotheses">
        <li>Clôtures fictives. Première moyenne : simple, sur les {n} premières variations ; ensuite, moyenne du jour = (moyenne de la veille × {n - 1} + séance) ÷ {n}.</li>
        <li>« Figer le cours » reproduit des séances sans échange : hausse et baisse moyennes diminuent du même facteur, le RSI ne bouge plus.</li>
        <li>Un RSI décrit le passé ; il ne prédit pas la séance suivante.</li>
      </ul>
    </figure>
  );
}

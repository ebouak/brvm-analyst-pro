'use client';

import { useId, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Simulation } from '@/lib/academy/types';
import { SaisieInvalide } from '@/lib/academy/simulateurs';
import { moyenneGlissante } from '@/lib/academy/simTechnique';

/**
 * Atelier « la moyenne qui glisse » (leçon 3 du niveau 3, 2026-11-24) :
 * clôtures FICTIVES modifiables, moyenne simple et exponentielle calculées
 * séance par séance par lib/academy/simTechnique.ts (pur, testé). Le tableau
 * montre les clôtures retenues à chaque séance : c'est le glissement lui-même.
 */

type Sim = Extract<Simulation, { type: 'moyenne_glissante' }>;

const COULEUR = { cours: '#0f1f33', simple: '#0b7d93', expo: '#a3401f', axe: '#5d6b7d', trame: '#e6dfd3' };
const nombre = (n: number, dec = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec }).format(n);
const pct = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(n)} %`.replace('-', '−');
const lire = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));

export default function AtelierMoyenne({ sim }: { sim: Sim }) {
  const id = useId();
  const initial = sim.clotures.map(String);
  const [v, setV] = useState(initial);
  const [periode, setPeriode] = useState(sim.periode);
  const clotures = v.map(lire);
  const maxPeriode = Math.min(10, clotures.length - 1);
  const n = Math.min(periode, maxPeriode);

  let calc: { ok: true; r: ReturnType<typeof moyenneGlissante> } | { ok: false; message: string };
  try {
    calc = { ok: true, r: moyenneGlissante(clotures, n) };
  } catch (e) {
    calc = { ok: false, message: e instanceof SaisieInvalide ? e.message : 'Calcul impossible.' };
  }
  const donnees = calc.ok ? calc.r.lignes.map((l) => ({ s: `S${l.seance}`, cours: l.cloture, simple: l.sma, expo: l.ema })) : [];

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <div className="lp-figure-tete">
        <p className="lp-figure-titre">La moyenne qui glisse, séance par séance</p>
        <span className="lp-badge">Simulation pédagogique</span>
      </div>
      {sim.consigne && <p className="lp-note lp-note--haut">{sim.consigne}</p>}

      <div className="lp-curseurs lp-bloc-court">
        <div className="lp-curseur">
          <label htmlFor={`${id}-n`}>Moyenne sur</label>
          <input id={`${id}-n`} type="range" min={2} max={maxPeriode} value={n} aria-valuetext={`${n} séances`} onChange={(e) => setPeriode(Number(e.target.value))} />
          <output htmlFor={`${id}-n`}>{n} séances</output>
        </div>
      </div>

      <div className="lp-table-wrap">
        <table className="lp-table lp-saisie-cours">
          <caption className="sr-only">Clôtures modifiables et moyennes calculées à chaque séance</caption>
          <thead>
            <tr>
              <th scope="col">Séance</th>
              <th scope="col">Clôture</th>
              <th scope="col">Clôtures retenues</th>
              <th scope="col" className="lp-num">Moyenne simple</th>
              <th scope="col" className="lp-num">Moyenne exponentielle</th>
              <th scope="col" className="lp-num">Écart à la simple</th>
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
                  <td>{l?.fenetre ? l.fenetre.map((x) => nombre(x)).join(' · ') : '—'}</td>
                  <td className="lp-num">{l?.sma == null ? '—' : nombre(l.sma)}</td>
                  <td className="lp-num">{l?.ema == null ? '—' : nombre(l.ema)}</td>
                  <td className="lp-num">{l?.ecartSmaPct == null ? '—' : pct(l.ecartSmaPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {calc.ok && (
        <>
          <div className="lp-graphe lp-graphe--court" role="img" aria-label={`Clôtures et moyennes simple et exponentielle sur ${n} séances.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={donnees} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={COULEUR.trame} vertical={false} />
                <XAxis dataKey="s" tick={{ fill: COULEUR.axe, fontSize: 11 }} axisLine={{ stroke: COULEUR.trame }} tickLine={false} />
                <YAxis tick={{ fill: COULEUR.axe, fontSize: 11 }} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} tickFormatter={(x: number) => nombre(x, 1)} />
                <Tooltip formatter={(x: number, nom: string) => [nombre(x), nom === 'cours' ? 'Clôture' : nom === 'simple' ? 'Moyenne simple' : 'Moyenne exponentielle']} />
                <Line dataKey="cours" stroke={COULEUR.cours} strokeWidth={1.6} dot={{ r: 2.5 }} isAnimationActive={false} />
                <Line dataKey="simple" stroke={COULEUR.simple} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="expo" stroke={COULEUR.expo} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lp-legende" aria-hidden="true">
            <span><i style={{ background: COULEUR.cours }} />Clôture</span>
            <span><i style={{ background: COULEUR.simple }} />Moyenne simple</span>
            <span><i style={{ background: COULEUR.expo }} />Moyenne exponentielle</span>
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
      <button type="button" className="lp-bouton lp-bouton--discret" onClick={() => { setV(initial); setPeriode(sim.periode); }}>Revenir aux valeurs de la leçon</button>
      <ul className="lp-hypotheses">
        <li>Clôtures fictives. Moyenne simple : somme des N dernières clôtures divisée par N. Moyenne exponentielle : elle part de la première moyenne simple, puis chaque séance pèse 2 ÷ (N + 1).</li>
        <li>Une moyenne décrit le passé ; elle ne prédit pas la séance suivante.</li>
      </ul>
    </figure>
  );
}

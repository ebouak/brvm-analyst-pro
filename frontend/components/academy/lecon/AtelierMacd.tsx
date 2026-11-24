'use client';

import { useId, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Simulation } from '@/lib/academy/types';
import { SaisieInvalide } from '@/lib/academy/simulateurs';
import { atelierMacd } from '@/lib/academy/simTechnique';

/**
 * Atelier « le MACD pas à pas » (leçon 5 du niveau 3, 2026-11-24) : clôtures
 * FICTIVES modifiables, EMA rapide/lente, ligne MACD, ligne de signal et
 * histogramme calculés séance par séance par lib/academy/simTechnique.ts.
 * Un bouton préréglé « cours figé (sans échange) » montre la convergence
 * mécanique vers zéro et le faux croisement baissier sans aucune baisse de prix.
 */

type Sim = Extract<Simulation, { type: 'atelier_macd' }>;

const COULEUR = { cours: '#0f1f33', macd: '#0b7d93', signal: '#a3401f', axe: '#5d6b7d', trame: '#e6dfd3' };
const SCENARIO_FIGE = ['100', '100', '102', '105', '109', '114', '120', '120', '120', '120', '120', '120'];

const nombre = (n: number, dec = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec }).format(n).replace('-', '−');
const signe = (n: number, dec = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec, signDisplay: 'exceptZero' }).format(n).replace('-', '−');
const lire = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));

export default function AtelierMacd({ sim }: { sim: Sim }) {
  const id = useId();
  const initial = sim.clotures.map(String);
  const [v, setV] = useState(initial);
  const clotures = v.map(lire);

  let calc: { ok: true; r: ReturnType<typeof atelierMacd> } | { ok: false; message: string };
  try {
    calc = { ok: true, r: atelierMacd(clotures, sim.rapide, sim.lente, sim.signal) };
  } catch (e) {
    calc = { ok: false, message: e instanceof SaisieInvalide ? e.message : 'Calcul impossible.' };
  }

  const donnees = calc.ok
    ? calc.r.lignes.map((l) => ({ s: `S${l.seance}`, cours: l.cloture, macd: l.macd, signal: l.signal, hist: l.hist }))
    : [];

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <div className="lp-figure-tete">
        <p className="lp-figure-titre">Le MACD pas à pas ({sim.rapide}, {sim.lente}, {sim.signal})</p>
        <span className="lp-badge">Simulation pédagogique</span>
      </div>
      {sim.consigne && <p className="lp-note lp-note--haut">{sim.consigne}</p>}

      <div className="lp-table-wrap">
        <table className="lp-table lp-saisie-cours">
          <caption className="sr-only">Clôtures modifiables et composantes du MACD calculées séance par séance</caption>
          <thead>
            <tr>
              <th scope="col">Séance</th>
              <th scope="col">Clôture</th>
              <th scope="col" className="lp-num">EMA {sim.rapide}</th>
              <th scope="col" className="lp-num">EMA {sim.lente}</th>
              <th scope="col" className="lp-num">MACD</th>
              <th scope="col" className="lp-num">Signal {sim.signal}</th>
              <th scope="col" className="lp-num">Histogramme</th>
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
                  <td className="lp-num">{l?.emaRapide == null ? '—' : nombre(l.emaRapide)}</td>
                  <td className="lp-num">{l?.emaLente == null ? '—' : nombre(l.emaLente)}</td>
                  <td className="lp-num">{l?.macd == null ? '—' : signe(l.macd)}</td>
                  <td className="lp-num">{l?.signal == null ? '—' : signe(l.signal)}</td>
                  <td className="lp-num">{l?.hist == null ? '—' : signe(l.hist)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {calc.ok && (
        <>
          <div className="lp-graphe lp-graphe--court" role="img" aria-label="Évolution des clôtures saisies.">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart syncId={`${id}-am`} data={donnees} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke={COULEUR.trame} vertical={false} />
                <XAxis dataKey="s" hide />
                <YAxis tick={{ fill: COULEUR.axe, fontSize: 11 }} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']} tickFormatter={(x: number) => nombre(x, 0)} />
                <Tooltip formatter={(x: number) => [nombre(x, 1), 'Clôture']} />
                <Line dataKey="cours" stroke={COULEUR.cours} strokeWidth={1.8} dot={{ r: 2.5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lp-graphe lp-graphe--court" role="img" aria-label={`MACD (${sim.rapide}, ${sim.lente}, ${sim.signal}) calculé sur les clôtures saisies.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart syncId={`${id}-am`} data={donnees} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={COULEUR.trame} vertical={false} />
                <XAxis dataKey="s" tick={{ fill: COULEUR.axe, fontSize: 11 }} axisLine={{ stroke: COULEUR.trame }} tickLine={false} />
                <YAxis tick={{ fill: COULEUR.axe, fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={(x: number) => nombre(x, 1)} />
                <ReferenceLine y={0} stroke={COULEUR.axe} />
                <Tooltip formatter={(x: number, nom: string) => [signe(x), nom === 'hist' ? 'Histogramme' : nom === 'macd' ? 'MACD' : 'Signal']} />
                <Bar dataKey="hist" isAnimationActive={false}>
                  {donnees.map((pt) => (
                    <Cell key={pt.s} fill={(pt.hist ?? 0) >= 0 ? COULEUR.macd : COULEUR.signal} fillOpacity={0.45} />
                  ))}
                </Bar>
                <Line dataKey="macd" stroke={COULEUR.macd} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
                <Line dataKey="signal" stroke={COULEUR.signal} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="lp-legende" aria-hidden="true">
            <span><i style={{ background: COULEUR.cours }} />Clôture</span>
            <span><i style={{ background: COULEUR.macd }} />Ligne MACD</span>
            <span><i style={{ background: COULEUR.signal }} />Ligne de signal</span>
            <span><i style={{ background: COULEUR.macd, opacity: 0.45 }} />Histogramme (+) / (−)</span>
          </div>
        </>
      )}

      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        {calc.ok ? (
          <p className="lp-verdict">{calc.r.lecture}</p>
        ) : (
          <p className="lp-alerte-texte">{calc.message}</p>
        )}
      </div>

      <div className="lp-actions">
        <button type="button" className="lp-bouton lp-bouton--discret" onClick={() => setV(SCENARIO_FIGE)}>
          Tester un cours figé (sans échange)
        </button>
        <button type="button" className="lp-bouton lp-bouton--discret" onClick={() => setV(initial)}>
          Revenir aux valeurs de la leçon
        </button>
      </div>

      <ul className="lp-hypotheses">
        <li>Clôtures fictives. Paramètres réduits ({sim.rapide}, {sim.lente}, {sim.signal}) pour suivre chaque chiffre à la main ; les mêmes formules s’appliquent en (12, 26, 9).</li>
        <li>Le MACD décrit le passé des cours ; il ne prédit pas la séance suivante.</li>
      </ul>
    </figure>
  );
}

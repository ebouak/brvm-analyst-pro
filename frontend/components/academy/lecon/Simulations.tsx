'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Simulation } from '@/lib/academy/types';
import { capitalPourObjectif, simulerReinvestissement } from '@/lib/academy/simulations';

/**
 * Simulations pédagogiques d'une leçon : calculées au rendu à partir des
 * hypothèses du contenu (lib/academy/simulations.ts), étiquetées comme telles,
 * hypothèses écrites sous le graphique, valeurs reprises dans un tableau.
 */

const fcfa = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
const nombre = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const pct = (n: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)} %`;

const COULEUR = { reinvestis: '#0b7d93', especes: '#8a96a6', axe: '#5d6b7d', trame: '#e6dfd3' };

function Entete({ titre }: { titre: string }) {
  return (
    <div className="lp-figure-tete">
      <p className="lp-figure-titre">{titre}</p>
      <span className="lp-badge">Simulation pédagogique</span>
    </div>
  );
}

function Reinvestissement({ sim }: { sim: Extract<Simulation, { type: 'reinvestissement' }> }) {
  const lignes = simulerReinvestissement(sim);
  const derniere = lignes[lignes.length - 1]!;
  const donnees = lignes.map((l) => ({ annee: `An ${l.annee}`, reinvestis: l.revenuReinvest, especes: l.revenuEspeces }));
  const rendement = (sim.dpa / sim.cours) * 100;
  const resume =
    `Simulation sur ${sim.annees} ans : la dernière année, le revenu atteint ${fcfa(derniere.revenuReinvest)} ` +
    `en réinvestissant les dividendes, contre ${fcfa(derniere.revenuEspeces)} en les conservant en espèces.`;

  return (
    <figure className="lp-figure lp-large">
      <Entete titre={`Revenu annuel de dividendes sur ${sim.annees} ans`} />
      <div className="lp-legende" aria-hidden="true">
        <span><i style={{ background: COULEUR.reinvestis }} />Dividendes réinvestis</span>
        <span><i style={{ background: COULEUR.especes }} />Dividendes conservés en espèces</span>
      </div>
      <div className="lp-graphe" role="img" aria-label={resume}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={donnees} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke={COULEUR.trame} vertical={false} />
            <XAxis dataKey="annee" tick={{ fill: COULEUR.axe, fontSize: 12 }} axisLine={{ stroke: COULEUR.trame }} tickLine={false} />
            <YAxis
              tick={{ fill: COULEUR.axe, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v: number) => `${nombre(Math.round(v / 1000))} k`}
            />
            <Tooltip
              formatter={(v: number, n: string) => [fcfa(v), n === 'reinvestis' ? 'Réinvestis' : 'En espèces']}
              contentStyle={{ background: '#fff', border: `1px solid ${COULEUR.trame}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#0f1f33' }}
            />
            <Line type="monotone" dataKey="especes" stroke={COULEUR.especes} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="reinvestis" stroke={COULEUR.reinvestis} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="lp-note">Axe vertical : revenu de dividendes de l’année, en milliers de FCFA.</p>

      <div className="lp-table-wrap lp-bloc">
        <table className="lp-table">
          <caption className="sr-only">Détail de la simulation, année par année</caption>
          <thead>
            <tr>
              <th scope="col">Année</th>
              <th scope="col" className="lp-num">Actions détenues</th>
              <th scope="col" className="lp-num">Dividende / action</th>
              <th scope="col" className="lp-num">Revenu réinvesti</th>
              <th scope="col" className="lp-num">Revenu en espèces</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.annee}>
                <th scope="row" className="lp-ligne-tete">Année {l.annee}</th>
                <td className="lp-num">{nombre(l.actionsReinvest)}</td>
                <td className="lp-num">{fcfa(l.dpa)}</td>
                <td className="lp-num">{fcfa(l.revenuReinvest)}</td>
                <td className="lp-num">{fcfa(l.revenuEspeces)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="lp-hypotheses">
        <li>
          Départ : {nombre(sim.actions)} actions, dividende de {fcfa(sim.dpa)}, cours de {fcfa(sim.cours)} (rendement de {pct(rendement)}).
        </li>
        <li>Dividende par action et cours progressent de {pct(sim.croissance_pct)} par an : le rendement reste constant.</li>
        <li>Les dividendes de l’année sont réinvestis au cours de l’année, en actions entières ; le reliquat reste en espèces.</li>
        <li>Montants bruts, sans frais de courtage ni impôt. Valeurs d’illustration : ni des données de marché, ni une prévision.</li>
      </ul>
    </figure>
  );
}

/** Sous ce seuil de largeur, l'étiquette sort de la barre (sinon blanc sur fond clair). */
const LARGEUR_ETIQUETTE_INTERNE = 45;

function Objectif({ sim }: { sim: Extract<Simulation, { type: 'objectif' }> }) {
  const lignes = capitalPourObjectif(sim.revenu_cible, sim.rendements_pct);
  const max = Math.max(...lignes.map((l) => l.capital));
  const resume = lignes.map((l) => `${fcfa(l.capital)} à ${pct(l.rendementPct)}`).join(', ');

  return (
    <figure className="lp-figure lp-large">
      <Entete titre={`Capital nécessaire pour ${fcfa(sim.revenu_cible)} de dividendes bruts par an`} />
      <div className="lp-barres" role="img" aria-label={`Capital nécessaire : ${resume}.`}>
        {lignes.map((l) => {
          const largeur = Math.max(6, (l.capital / max) * 100);
          const interne = largeur >= LARGEUR_ETIQUETTE_INTERNE;
          return (
            <div key={l.rendementPct} className="lp-barre-ligne">
              <span className="lp-barre-etiquette">à {pct(l.rendementPct)}</span>
              <div className="lp-barre-piste">
                <div className="lp-barre" style={{ width: `${largeur}%` }} />
                <span
                  className={`lp-barre-valeur${interne ? '' : ' lp-barre-valeur--dehors'}`}
                  style={interne ? undefined : { left: `calc(${largeur}% + 0.5rem)` }}
                >
                  {fcfa(l.capital)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <ul className="lp-hypotheses">
        <li>Capital = revenu visé ÷ rendement. Rendements hypothétiques, non garantis : un dividende peut baisser ou être supprimé.</li>
        <li>Montants bruts, avant impôt et frais ; le cours de l’action peut aussi baisser.</li>
      </ul>
    </figure>
  );
}

export default function SimulationLecon({ sim }: { sim: Simulation }) {
  return sim.type === 'reinvestissement' ? <Reinvestissement sim={sim} /> : <Objectif sim={sim} />;
}

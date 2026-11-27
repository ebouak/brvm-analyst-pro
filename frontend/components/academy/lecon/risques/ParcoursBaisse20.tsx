'use client';

import { useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fcfa, hausseNecessaire, nombre, pct, PERTES_ILLUSTREES } from '@/lib/academy/risques';
import type { SectionEtape } from '@/lib/academy/types';
import { DECISIONS, type ChoixBaisse } from './contenu';

const COURS_ACHAT = 5000;
const ACTIONS_EXEMPLE = 100;

export default function ParcoursBaisse20({ etapesMethode }: { etapesMethode: SectionEtape[] }) {
  const id = useId();
  const [choix, setChoix] = useState<ChoixBaisse | null>(null);
  const [verifies, setVerifies] = useState<boolean[]>(() => etapesMethode.map(() => false));
  const [perteTestPct, setPerteTestPct] = useState<number>(20);

  const decisionActive = DECISIONS.find((d) => d.cle === choix) ?? null;

  const donneesAsymetrie = PERTES_ILLUSTREES.map((perte) => ({
    perteLabel: `−${perte} %`,
    perte,
    hausse: Math.round(hausseNecessaire(perte) * 10) / 10,
  }));

  const haussePourTest = hausseNecessaire(perteTestPct);
  const coursApresBaisse = Math.round(COURS_ACHAT * (1 - perteTestPct / 100));

  function basculerEtape(idx: number) {
    setVerifies((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  }

  return (
    <div className="l7-baisse-stack">
      {/* 1. Parcours interactif de décision */}
      <div className="l7-sim-shell">
        <div className="l7-sim-inner">
          <div className="l7-sim-header">
            <div>
              <span className="l7-eyebrow">Parcours comportemental · Discipline de l’investisseur</span>
              <h3 className="l7-sim-title">Votre action perd 20 %. Quelle est votre réaction ?</h3>
            </div>
            <span className="lp-badge">Mise en situation</span>
          </div>

          <div className="l7-scenario-banner">
            <div className="l7-scenario-metric">
              <span>Prix d’achat</span>
              <strong>{fcfa(COURS_ACHAT)}</strong>
              <small>
                {ACTIONS_EXEMPLE} titres = {fcfa(COURS_ACHAT * ACTIONS_EXEMPLE)}
              </small>
            </div>
            <span className="l7-scenario-arrow" aria-hidden="true">
              →
            </span>
            <div className="l7-scenario-metric is-down">
              <span>Cours actuel (−20 %)</span>
              <strong>{fcfa(4000)}</strong>
              <small>
                Valeur affichée : {fcfa(4000 * ACTIONS_EXEMPLE)} (−{fcfa(100_000)})
              </small>
            </div>
          </div>

          <p className="l7-prompt-text">Choisissez l’attitude que vous adopteriez spontanément :</p>

          <div className="l7-decision-cards" role="radiogroup" aria-label="Votre réaction face à une baisse de 20 %">
            {DECISIONS.map((d, idx) => {
              const actif = choix === d.cle;
              return (
                <button
                  key={d.cle}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  className={`l7-decision-card l7-decision-card--${d.ton}${actif ? ' is-selected' : ''}`}
                  onClick={() => setChoix(d.cle)}
                >
                  <span className="l7-decision-num">Option {idx + 1}</span>
                  <strong className="l7-decision-title">{d.titre}</strong>
                  <span className="l7-decision-sub">{d.sous}</span>
                </button>
              );
            })}
          </div>

          {!decisionActive ? (
            <p className="l7-state-msg" role="status">
              Sélectionnez l’une des trois options ci-dessus pour découvrir ses conséquences et les éléments à examiner.
            </p>
          ) : (
            <div className={`l7-decision-feedback l7-decision-feedback--${decisionActive.ton}`} aria-live="polite">
              <div className="l7-feedback-head">
                <span className={`l7-ton-pill l7-ton-pill--${decisionActive.ton}`}>{decisionActive.verdict}</span>
                <h4>Conséquences potentielles de « {decisionActive.titre} »</h4>
              </div>
              <ul className="l7-conseq-list">
                {decisionActive.consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>

              {/* Grille d'examen systématique des 3 étapes */}
              <div className="l7-method-box">
                <p className="l7-method-kicker">
                  Les 3 vérifications indispensables avant toute décision (cochez au fil de votre lecture) :
                </p>
                <div className="l7-check-steps">
                  {etapesMethode.map((et, idx) => (
                    <label key={et.titre} className={`l7-check-step${verifies[idx] ? ' is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(verifies[idx])}
                        onChange={() => basculerEtape(idx)}
                      />
                      <div>
                        <strong>
                          Étape {idx + 1} — {et.titre}
                        </strong>
                        {et.detail && <p>{et.detail}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Graphique : hausses nécessaires pour compenser différentes pertes */}
      <div className="l7-sim-shell">
        <div className="l7-sim-inner">
          <div className="l7-sim-header">
            <div>
              <span className="l7-eyebrow">Mathématiques du capital · Asymétrie des pertes</span>
              <h3 className="l7-sim-title">Quelle hausse faut-il pour effacer une baisse ?</h3>
            </div>
            <span className="lp-badge">Calcul exact</span>
          </div>

          <p className="l7-body-note">
            Une baisse et une hausse de même pourcentage ne s’annulent pas : la hausse s’applique sur un capital réduit.
            Après <strong>−20 %</strong> (de 5 000 à 4 000 FCFA), il faut regagner 1 000 FCFA sur une base de
            4 000 FCFA, soit <strong>+25 %</strong>.
          </p>

          <div
            className="l7-chart-box"
            role="img"
            aria-label="Graphique en barres : hausse nécessaire en pourcentage pour compenser des pertes de 10 % à 50 %"
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={donneesAsymetrie} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e6dfd3" vertical={false} />
                <XAxis
                  dataKey="perteLabel"
                  tick={{ fill: '#2b3a4d', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#e6dfd3' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#5d6b7d', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v: number) => `+${v} %`}
                />
                <Tooltip
                  formatter={(v: number) => [`+${nombre(v, 1)} %`, 'Hausse requise pour revenir au point de départ']}
                  labelFormatter={(lbl: string) => `Perte subie : ${lbl}`}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e6dfd3',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="hausse" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {donneesAsymetrie.map((entry) => (
                    <Cell
                      key={entry.perte}
                      fill={entry.perte === perteTestPct ? '#b8892a' : entry.perte >= 40 ? '#a3401f' : '#0b7d93'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Curseur interactif de vérification */}
          <div className="l7-recovery-calc">
            <div className="l7-recovery-slider">
              <label htmlFor={`${id}-perte-slider`} className="l7-label">
                Tester une baisse de : <strong>−{perteTestPct} %</strong>
              </label>
              <input
                id={`${id}-perte-slider`}
                type="range"
                min={5}
                max={75}
                step={5}
                value={perteTestPct}
                onChange={(e) => setPerteTestPct(Number(e.target.value))}
              />
            </div>
            <div className="l7-recovery-readout" aria-live="polite">
              <div>
                <span>Cours après baisse</span>
                <strong>{fcfa(coursApresBaisse)}</strong>
              </div>
              <div>
                <span>Hausse nécessaire vers {fcfa(COURS_ACHAT)}</span>
                <strong className="l7-gold-text">+{pct(haussePourTest, 1)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

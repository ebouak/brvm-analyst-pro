'use client';

import { useState } from 'react';
import { calculerWpli, SOURCES_CASH } from '@/lib/articles/corisIpo';

const number = (value: number, digits = 1) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);

export default function WpliSimulator() {
  const [souscriptions, setSouscriptions] = useState(81);
  const [partVentes, setPartVentes] = useState(25);
  const [valeur20j, setValeur20j] = useState(2);
  const resultat = calculerWpli({
    souscriptionsMd: souscriptions,
    partVentes: partVentes / 100,
    valeur20jMd: valeur20j,
  });
  const sensibilite = [10, 25, 40, 60].map((part) => {
    const mesure = calculerWpli({
      souscriptionsMd: souscriptions,
      partVentes: part / 100,
      valeur20jMd: valeur20j,
    });
    return { part, mesure };
  });

  return (
    <div className="coris-wpli" id="wpli">
      <header>
        <div>
          <span>INDICATEUR PROPRIÉTAIRE · SIMULATION</span>
          <h3>WPLI — Westbourse IPO Liquidity Pressure Index</h3>
          <p>
            Estime le nombre de séances de valeur secondaire qu’il faudrait mobiliser si une part
            des souscriptions provenait de ventes d’actions existantes.
          </p>
        </div>
        <div className="coris-wpli__formula">
          <span>S × p / V<sub>20</sub></span>
          <small>Non observé · hypothèses ajustables</small>
        </div>
      </header>

      <div className="coris-wpli__body">
        <div className="coris-wpli__controls">
          <label>
            <span>Montant souscrit immobilisé <strong>{number(souscriptions, 0)} Md</strong></span>
            <input type="range" min="19" max="100" step="1" value={souscriptions} onChange={(event) => setSouscriptions(Number(event.target.value))} />
          </label>
          <label>
            <span>Part financée par ventes de titres <strong>{partVentes} %</strong></span>
            <input type="range" min="0" max="100" step="5" value={partVentes} onChange={(event) => setPartVentes(Number(event.target.value))} />
          </label>
          <label>
            <span>Valeur actions moyenne sur 20 séances <strong>{number(valeur20j, 1)} Md</strong></span>
            <input type="range" min="0.5" max="5" step="0.25" value={valeur20j} onChange={(event) => setValeur20j(Number(event.target.value))} />
          </label>
        </div>

        <div className="coris-wpli__result" aria-live="polite">
          <p>PRESSION POTENTIELLE</p>
          {resultat.statut === 'calculable' ? (
            <>
              <strong>{number(resultat.seancesEquivalentes, 1)}<span> séances</span></strong>
              <p>{number(resultat.cashVenteMd, 1)} Md potentiellement financés par des ventes secondaires.</p>
              <div className="coris-wpli__bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, resultat.seancesEquivalentes / 25 * 100)}%` }} />
              </div>
              <small>Échelle visuelle plafonnée à 25 séances.</small>
            </>
          ) : (
            <strong>Indisponible</strong>
          )}
        </div>
      </div>

      <div className="coris-cash-sources">
        {SOURCES_CASH.map((source, index) => (
          <article key={source.nom}>
            <span>0{index + 1}</span>
            <h4>{source.nom}</h4>
            <p>{source.description}</p>
            <strong>Pression {source.pression}</strong>
          </article>
        ))}
      </div>

      <div className="coris-wpli__sensitivity">
        <div>
          <span>SENSIBILITÉ</span>
          <h4>Si la part financée par ventes change…</h4>
        </div>
        <div className="coris-wpli__sensitivity-grid">
          {sensibilite.map(({ part, mesure }) => (
            <article key={part} className={part === partVentes ? 'is-current' : undefined}>
              <span>{part} % de ventes</span>
              <strong>{mesure.statut === 'calculable' ? `${number(mesure.seancesEquivalentes, 1)} séances` : '—'}</strong>
              <small>{mesure.statut === 'calculable' ? `${number(mesure.cashVenteMd, 1)} Md` : 'Indisponible'}</small>
            </article>
          ))}
        </div>
      </div>

      <p className="coris-wpli__warning">
        Le WPLI n’observe pas une vente. Il simule la pression maximale qu’une proportion hypothétique
        pourrait exercer sur une base de liquidité choisie. La part <em>p</em>, le montant réellement
        immobilisé et la valeur de référence doivent être remplacés par des données de souscription.
      </p>
    </div>
  );
}

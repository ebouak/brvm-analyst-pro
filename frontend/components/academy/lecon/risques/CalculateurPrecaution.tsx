'use client';

import { useId, useState } from 'react';
import { epargnePrecaution, fcfa } from '@/lib/academy/risques';

const EXEMPLES_MENSUELS = [150_000, 200_000, 250_000, 400_000] as const;

export default function CalculateurPrecaution() {
  const id = useId();
  const [depenses, setDepenses] = useState<string>('250 000');
  const [dejaDispo, setDejaDispo] = useState<string>('');

  const calcul = epargnePrecaution(depenses, dejaDispo);

  return (
    <div className="l7-sim-shell">
      <div className="l7-sim-inner">
        <div className="l7-sim-header">
          <div>
            <span className="l7-eyebrow">Calculateur personnel · Réserve hors portefeuille</span>
            <h3 className="l7-sim-title">Calculer votre épargne de précaution avant d’investir</h3>
          </div>
          <span className="lp-badge">Repère pédagogique</span>
        </div>

        <div className="l7-presets" aria-label="Exemples de dépenses mensuelles">
          <span className="l7-presets-label">Tester un budget mensuel :</span>
          <div className="l7-presets-list">
            {EXEMPLES_MENSUELS.map((m) => (
              <button
                key={m}
                type="button"
                className={`l7-preset-chip${depenses.replace(/\s/g, '') === String(m) ? ' is-active' : ''}`}
                onClick={() => setDepenses(new Intl.NumberFormat('fr-FR').format(m))}
              >
                {fcfa(m)} / mois
              </button>
            ))}
          </div>
        </div>

        <div className="l7-precaution-grid">
          <div className="l7-precaution-inputs">
            <div className="l7-field">
              <label htmlFor={`${id}-dep`} className="l7-label">
                Dépenses mensuelles essentielles (FCFA)
              </label>
              <span className="l7-field-hint">
                Logement, alimentation, santé, transport, scolarité, factures incompressibles.
              </span>
              <input
                id={`${id}-dep`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ex. 250 000"
                className="l7-input"
                value={depenses}
                onChange={(e) => setDepenses(e.target.value)}
              />
            </div>

            <div className="l7-field">
              <label htmlFor={`${id}-dispo`} className="l7-label">
                Réserve liquide déjà constituée (facultatif, FCFA)
              </label>
              <span className="l7-field-hint">
                Pour mesurer l’écart éventuel avant d’allouer de l’épargne à la BRVM.
              </span>
              <input
                id={`${id}-dispo`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ex. 600 000"
                className="l7-input"
                value={dejaDispo}
                onChange={(e) => setDejaDispo(e.target.value)}
              />
            </div>
          </div>

          <div className="l7-precaution-output" aria-live="polite" aria-atomic="true">
            {!calcul.ok ? (
              <div className="l7-verdict-box l7-verdict-box--warn" role="alert">
                <strong>Saisie incomplète ou invalide</strong>
                <p>{calcul.erreur}</p>
              </div>
            ) : (
              <>
                <div className="l7-reserve-cards">
                  <div className="l7-reserve-card">
                    <span>Seuil minimal (3 mois)</span>
                    <strong>{fcfa(calcul.trois)}</strong>
                    <small>Dépenses × 3</small>
                  </div>
                  <div className="l7-reserve-card l7-reserve-card--recommended">
                    <span>Repère recommandé (6 mois)</span>
                    <strong>{fcfa(calcul.six)}</strong>
                    <small>À conserver hors du portefeuille boursier</small>
                  </div>
                </div>

                {calcul.disponible != null && calcul.reste != null && (
                  <div className={`l7-reserve-status${calcul.reste === 0 ? ' is-ready' : ''}`}>
                    {calcul.reste === 0 ? (
                      <p>
                        <strong>Réserve de 6 mois atteinte ({fcfa(calcul.disponible)} disponibles) :</strong> votre
                        matelas d’urgence couvre le repère haut de la leçon. Seul le surplus à horizon long a vocation à
                        aller en bourse.
                      </p>
                    ) : (
                      <p>
                        <strong>Écart vers le repère de 6 mois : {fcfa(calcul.reste)}</strong> à constituer en épargne
                        disponible avant d’exposer votre capital aux variations des actions.
                      </p>
                    )}
                  </div>
                )}

                <p className="lp-note">
                  Ce montant de {fcfa(calcul.trois)} à {fcfa(calcul.six)} est un repère pédagogique destiné à éviter une
                  vente forcée en pleine baisse de marché, et non un conseil personnalisé.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

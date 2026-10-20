import type { Section } from '@/lib/academy/types';
import Pictogramme from './Pictogramme';

/**
 * Blocs éditoriaux d'une leçon Academy, rendus sur la surface claire `.lp`
 * (lecon.css). Aucun ne s'enferme dans une carte : la hiérarchie vient de la
 * typographie, de l'espace et des filets.
 */

/** Un retour à la ligne du contenu = un paragraphe (paragraphes courts). */
export function Texte({ contenu }: { contenu: string }) {
  const paragraphes = contenu.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="lp-texte">
      {paragraphes.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function Formules({ formules }: { formules: Section['formules'] }) {
  return (
    <div className="lp-formules">
      {formules.map((f, i) => (
        <div key={i} className="lp-formule">
          <p className="lp-formule-nom">{f.nom}</p>
          <p className="lp-formule-expr">{f.expression}</p>
          {f.exemple && <p className="lp-formule-ex">Exemple : {f.exemple}</p>}
        </div>
      ))}
    </div>
  );
}

/** Schéma du mécanisme : chaîne horizontale sur ordinateur, verticale sur mobile. */
export function Flux({ etapes, titre }: { etapes: Section['flux']; titre: string }) {
  return (
    <figure className="lp-figure lp-large">
      <ol className="lp-flux" aria-label={`Schéma : ${etapes.map((e) => e.titre).join(', puis ')}`}>
        {etapes.map((e, i) => (
          <li key={i} className="lp-flux-etape">
            <span className="lp-flux-picto">
              <Pictogramme icone={e.icone} />
            </span>
            <div>
              <p className="lp-flux-titre">{e.titre}</p>
              {e.detail && <p className="lp-flux-detail">{e.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="sr-only">{titre}</figcaption>
    </figure>
  );
}

/** Chiffres clés : une rangée séparée par des filets, pas une grille de cartes. */
export function ChiffresCles({ stats }: { stats: Section['stats'] }) {
  return (
    <dl className="lp-chiffres">
      {stats.map((s, i) => (
        <div key={i} className="lp-chiffre">
          <dt>
            {s.label}
            {s.detail && <span className="lp-chiffre-detail">{s.detail}</span>}
          </dt>
          <dd>{s.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Points({ points }: { points: Section['points'] }) {
  return (
    <ol className="lp-points">
      {points.map((p, i) => (
        <li key={i} className="lp-point">
          <div>
            <p className="lp-point-titre">{p.titre}</p>
            {p.detail && <p className="lp-point-detail">{p.detail}</p>}
            {p.verifier && (
              <p className="lp-point-verifier">
                <b>À vérifier</b> — {p.verifier}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Étapes datées. `frise` : horizontale sur ordinateur, verticale sur mobile ;
 * `liste` (rendu historique) : toujours verticale.
 */
export function Frise({ etapes, style }: { etapes: Section['etapes']; style: Section['etapes_style'] }) {
  return (
    <ol className={`lp-frise${style === 'frise' ? '' : ' lp-frise--verticale'}`}>
      {etapes.map((e, i) => (
        <li key={i} className={`lp-frise-etape${e.cle ? ' lp-frise-etape--cle' : ''}`}>
          <span className="lp-frise-point" aria-hidden="true" />
          <div>
            <p className="lp-frise-num">
              Étape {i + 1}
              {e.cle ? ' · clé' : ''}
            </p>
            <p className="lp-frise-titre">{e.titre}</p>
            {e.detail && <p className="lp-frise-detail">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Une cellule « chiffrée » (montant, pourcentage, quantité) s'aligne à droite. */
const NUMERIQUE = /^[\s+\-−×=]*\d[\d\s  .,]*\s*(%|FCFA|F|actions?|ans?)?$/i;

export function Tableau({ tableau }: { tableau: NonNullable<Section['tableau']> }) {
  const colonneNum = tableau.colonnes.map(
    (_, j) => j > 0 && tableau.lignes.every((l) => !l[j] || NUMERIQUE.test(l[j]!.trim())),
  );
  return (
    <div>
      <div className="lp-table-wrap">
        <table className="lp-table">
          <thead>
            <tr>
              {tableau.colonnes.map((c, j) => (
                <th key={j} scope="col" className={colonneNum[j] ? 'lp-num' : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableau.lignes.map((ligne, i) => (
              <tr key={i}>
                {ligne.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="lp-ligne-tete">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className={colonneNum[j] ? 'lp-num' : undefined}>
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tableau.note && <p className="lp-note">{tableau.note}</p>}
    </div>
  );
}

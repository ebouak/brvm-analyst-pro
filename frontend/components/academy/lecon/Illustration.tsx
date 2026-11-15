import {
  calculerAvantApres,
  calculerBilan,
  calculerCascade,
  calculerEcheancier,
  couperLibelle,
  fmtNombre,
  fmtValeur,
  resumeIllustration,
  SYMBOLE_OPERATION,
  texteEquivalent,
  type Illustration as IllustrationT,
} from '@/lib/academy/illustrations';
import './illustration.css';

/**
 * Schéma pédagogique d'une section de leçon (bloc `illustration`).
 *
 * Tout est dessiné en SVG à partir des données du bloc : les totaux, les flux et
 * les parts sont CALCULÉS (lib/academy/illustrations.ts), jamais saisis. Les
 * couleurs viennent des jetons de la leçon (`--lp-*`, repris par `.lp-illu`,
 * avec des valeurs de repli pour le mode diapositives). Chaque schéma porte un
 * `aria-label`, et sa version texte complète suit, masquée à l'écran.
 *
 * Le viewBox est dessiné pour ~400 px de large : à 390 px, le texte garde sa
 * taille ; sur grand écran, la largeur est plafonnée pour qu'il ne grossisse pas.
 */

const W = 400;

function Lignes({ x, y, lignes, className, anchor = 'middle', pas = 14 }: { x: number; y: number; lignes: string[]; className: string; anchor?: 'start' | 'middle' | 'end'; pas?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={className}>
      {lignes.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : pas}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function Cascade({ ill }: { ill: Extract<IllustrationT, { gabarit: 'cascade' }> }) {
  const { lignes, max } = calculerCascade(ill);
  const H = 52;
  /**
   * Bande de texte d'une ligne (texte de 12,5, ligne de base y+14 : boîte de
   * y+2 à y+18 environ, jambages compris) : aucune liaison n'y entre. La barre
   * occupe y+24 à y+38 ; la liaison s'arrête à y+H et reprend à y+H+20.
   */
  const LIAISON_HAUT = 0;
  const LIAISON_BAS = 20;
  const x = (v: number) => (v / max) * W;
  return (
    <svg viewBox={`0 0 ${W} ${lignes.length * H}`} className="lp-illu-svg" aria-hidden="true" focusable="false">
      {lignes.map((l, i) => {
        const y = i * H;
        const signe = l.nature === 'hausse' ? '+ ' : l.nature === 'baisse' ? '− ' : '';
        return (
          <g key={i}>
            <text x={0} y={y + 14} className={`illu-label${l.nature === 'arrivee' || l.nature === 'depart' ? ' illu-fort' : ''}`}>
              {l.label}
            </text>
            <text x={W} y={y + 14} textAnchor="end" className="illu-valeur">
              {signe}
              {fmtValeur(Math.abs(l.valeur), ill.unite)}
            </text>
            <rect x={x(l.de)} y={y + 24} width={Math.max(x(l.a) - x(l.de), 2)} height={14} rx={2} className={`illu-barre illu-${l.nature}`} />
            {/* Liaison vers la barre suivante, INTERROMPUE dans la bande de texte
                de la ligne suivante (y+H → y+H+20) : un trait
                ne traverse jamais un libellé ni un montant, quelle que soit sa position. */}
            {i < lignes.length - 1 && (
              <>
                <line x1={x(l.nature === 'baisse' ? l.de : l.a)} x2={x(l.nature === 'baisse' ? l.de : l.a)} y1={y + 38} y2={y + H + LIAISON_HAUT} className="illu-liaison" />
                <line x1={x(l.nature === 'baisse' ? l.de : l.a)} x2={x(l.nature === 'baisse' ? l.de : l.a)} y1={y + H + LIAISON_BAS} y2={y + H + 24} className="illu-liaison" />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Bilan({ ill }: { ill: Extract<IllustrationT, { gabarit: 'bilan' }> }) {
  const { total } = calculerBilan(ill);
  const haut = 42;
  const H = 250;
  const col = (W - 12) / 2;
  const blocs = (items: { label: string; valeur: number; nature?: string }[], x0: number, cote: 'actif' | 'passif') => {
    let y = haut;
    return items.map((it, i) => {
      const h = (it.valeur / total) * H;
      const g = (
        <g key={`${cote}${i}`}>
          <rect x={x0} y={y} width={col} height={h - 2} rx={3} className={`illu-bloc illu-bloc--${cote === 'actif' ? 'actif' : it.nature}`} />
          <text x={x0 + col / 2} y={y + h / 2 - (h >= 40 ? 3 : -4)} textAnchor="middle" className={`illu-bloc-label illu-bloc-label--${cote === 'actif' ? 'actif' : it.nature}`}>
            {it.label}
            {/* Bloc trop bas pour deux lignes : la valeur suit le libellé. */}
            {h < 40 && ` · ${fmtValeur(it.valeur, ill.unite)}`}
          </text>
          {h >= 40 && (
            <text x={x0 + col / 2} y={y + h / 2 + 13} textAnchor="middle" className={`illu-bloc-valeur illu-bloc-label--${cote === 'actif' ? 'actif' : it.nature}`}>
              {fmtValeur(it.valeur, ill.unite)}
            </text>
          )}
        </g>
      );
      y += h;
      return g;
    });
  };
  return (
    <svg viewBox={`0 0 ${W} ${haut + H}`} className="lp-illu-svg" aria-hidden="true" focusable="false">
      <text x={col / 2} y={14} textAnchor="middle" className="illu-label illu-fort">Actif</text>
      <text x={col / 2} y={30} textAnchor="middle" className="illu-petit illu-doux">ce que la société possède</text>
      <text x={col + 12 + col / 2} y={14} textAnchor="middle" className="illu-label illu-fort">Passif</text>
      <text x={col + 12 + col / 2} y={30} textAnchor="middle" className="illu-petit illu-doux">comment elle le finance</text>
      {blocs(ill.actif, 0, 'actif')}
      {blocs(ill.passif, col + 12, 'passif')}
    </svg>
  );
}

function Decomposition({ ill }: { ill: Extract<IllustrationT, { gabarit: 'decomposition' }> }) {
  const n = ill.facteurs.length;
  const op = 30;
  const larg = (W - (n - 1) * op) / n;
  const yF = 100;
  const hF = 82;
  const positifs = ill.operation === 'somme' && ill.facteurs.every((f) => f.valeur > 0);
  const total = ill.facteurs.reduce((t, f) => t + f.valeur, 0);
  const hTotal = yF + hF + (positifs ? 30 : 4);
  let xBarre = 0;
  return (
    <svg viewBox={`0 0 ${W} ${hTotal}`} className="lp-illu-svg" aria-hidden="true" focusable="false">
      <rect x={0} y={0} width={W} height={66} rx={6} className="illu-boite illu-boite--resultat" />
      <text x={W / 2} y={24} textAnchor="middle" className="illu-label illu-sur-fonce">
        {ill.resultat.label}
      </text>
      <text x={W / 2} y={52} textAnchor="middle" className="illu-grand illu-sur-fonce">
        {fmtValeur(ill.resultat.valeur, ill.resultat.unite ?? ill.unite, ill.resultat.pourcentage)}
      </text>
      <text x={W / 2} y={90} textAnchor="middle" className="illu-operateur">
        =
      </text>
      {ill.facteurs.map((f, i) => {
        const x0 = i * (larg + op);
        return (
          <g key={i}>
            <rect x={x0} y={yF} width={larg} height={hF} rx={6} className={`illu-boite illu-t${i}-clair`} />
            <Lignes x={x0 + larg / 2} y={yF + 22} lignes={couperLibelle(f.label, n === 3 ? 15 : 22)} className="illu-label" />
            <text x={x0 + larg / 2} y={yF + 66} textAnchor="middle" className="illu-moyen">
              {fmtValeur(f.valeur, f.unite ?? ill.unite, f.pourcentage)}
            </text>
            {i < n - 1 && (
              <text x={x0 + larg + op / 2} y={yF + hF / 2 + 8} textAnchor="middle" className="illu-operateur">
                {SYMBOLE_OPERATION[ill.operation]}
              </text>
            )}
          </g>
        );
      })}
      {positifs &&
        ill.facteurs.map((f, i) => {
          const w = (f.valeur / total) * W;
          const r = <rect key={`b${i}`} x={xBarre} y={yF + hF + 12} width={Math.max(w - 2, 2)} height={12} rx={2} className={`illu-t${i}`} />;
          xBarre += w;
          return r;
        })}
    </svg>
  );
}

function Echeancier({ ill }: { ill: Extract<IllustrationT, { gabarit: 'echeancier' }> }) {
  const { flux } = calculerEcheancier(ill);
  const cols = flux.length + (ill.prix_achat ? 1 : 0);
  const pas = W / cols;
  const larg = Math.min(pas * 0.62, 46);
  const haut = Math.max(...flux.map((f) => f.total));
  const bas = ill.prix_achat ?? 0;
  const zone = 190;
  const ech = zone / (haut + bas);
  const yAxe = 20 + haut * ech;
  const avecValeurs = cols <= 7;
  return (
    <svg viewBox={`0 0 ${W} ${yAxe + bas * ech + 44}`} className="lp-illu-svg" aria-hidden="true" focusable="false">
      <line x1={0} x2={W} y1={yAxe} y2={yAxe} className="illu-axe" />
      {ill.prix_achat && (
        <g>
          <rect x={pas / 2 - larg / 2} y={yAxe} width={larg} height={bas * ech} rx={2} className="illu-baisse" />
          {avecValeurs && (
            <text x={pas / 2} y={yAxe + bas * ech + 14} textAnchor="middle" className="illu-petit">
              − {fmtNombre(bas)}
            </text>
          )}
        </g>
      )}
      {flux.map((f, i) => {
        const cx = (i + (ill.prix_achat ? 1 : 0)) * pas + pas / 2;
        const hc = f.coupon * ech;
        const hk = f.capital * ech;
        return (
          <g key={i}>
            {hk > 0 && <rect x={cx - larg / 2} y={yAxe - hk} width={larg} height={hk} className="illu-t1" />}
            <rect x={cx - larg / 2} y={yAxe - hk - hc} width={larg} height={Math.max(hc, 1)} className="illu-t0" />
            {avecValeurs && (
              <text x={cx} y={yAxe - hk - hc - 5} textAnchor="middle" className="illu-petit">
                {fmtNombre(f.total)}
              </text>
            )}
            <text x={cx} y={yAxe + 15} textAnchor="middle" className="illu-petit illu-doux">
              {f.annee}
            </text>
          </g>
        );
      })}
      {ill.prix_achat && (
        <text x={pas / 2} y={yAxe - 6} textAnchor="middle" className="illu-petit illu-doux">
          Achat
        </text>
      )}
      <text x={W} y={yAxe + bas * ech + 38} textAnchor="end" className="illu-petit illu-doux">
        Année après l’achat{ill.unite ? ` · montants en ${ill.unite}` : ''}
      </text>
    </svg>
  );
}

function AvantApres({ ill }: { ill: Extract<IllustrationT, { gabarit: 'avant_apres' }> }) {
  const { colonnes, max } = calculerAvantApres(ill);
  const n = colonnes.length;
  const pas = W / n;
  const larg = Math.min(pas * 0.56, 96);
  const zone = 200;
  const yBas = 24 + zone;
  return (
    <svg viewBox={`0 0 ${W} ${yBas + (ill.part_du_premier ? 54 : 38)}`} className="lp-illu-svg" aria-hidden="true" focusable="false">
      <line x1={0} x2={W} y1={yBas} y2={yBas} className="illu-axe" />
      {colonnes.map((c, i) => {
        const cx = i * pas + pas / 2;
        let y = yBas;
        return (
          <g key={i}>
            {c.segments.map((s, k) => {
              const h = (s.valeur / max) * zone;
              y -= h;
              return (
                <g key={k}>
                  <rect x={cx - larg / 2} y={y} width={larg} height={Math.max(h - 1.5, 0)} className={`illu-t${s.teinte}`} />
                  {h >= 34 && <Lignes x={cx} y={y + h / 2 - (couperLibelle(s.label, 13).length - 1) * 6 + 4} lignes={couperLibelle(s.label, 13)} className={`illu-segment illu-segment--t${s.teinte}`} pas={12} />}
                </g>
              );
            })}
            <text x={cx} y={y - 6} textAnchor="middle" className="illu-valeur">
              {fmtValeur(c.total, ill.unite)}
            </text>
            <Lignes x={cx} y={yBas + 16} lignes={couperLibelle(c.label, n === 3 ? 16 : 24)} className="illu-label illu-fort" />
            {ill.part_du_premier && (
              <text x={cx} y={yBas + 48} textAnchor="middle" className="illu-petit illu-doux">
                {c.segments[0]!.label} : {fmtNombre(c.partPremierPct, 1)} %
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Legende({ ill }: { ill: IllustrationT }) {
  let items: string[] = [];
  if (ill.gabarit === 'avant_apres') items = calculerAvantApres(ill).legende;
  if (ill.gabarit === 'echeancier') items = ['Coupon (intérêts)', 'Capital remboursé', ...(ill.prix_achat ? ['Prix payé à l’achat'] : [])];
  if (items.length === 0) return null;
  return (
    <ul className="lp-illu-legende" aria-hidden="true">
      {items.map((l, i) => (
        <li key={l}>
          <span className={`lp-illu-pastille ${ill.gabarit === 'echeancier' && i === 2 ? 'illu-baisse' : `illu-t${i}`}`} />
          {l}
        </li>
      ))}
    </ul>
  );
}

export default function Illustration({ illustration: ill }: { illustration: IllustrationT }) {
  return (
    <figure className={`lp-illu lp-illu--${ill.gabarit}`}>
      <figcaption className="lp-illu-titre">{ill.titre}</figcaption>
      <div role="img" aria-label={resumeIllustration(ill)} className="lp-illu-dessin">
        {ill.gabarit === 'cascade' && <Cascade ill={ill} />}
        {ill.gabarit === 'bilan' && <Bilan ill={ill} />}
        {ill.gabarit === 'decomposition' && <Decomposition ill={ill} />}
        {ill.gabarit === 'echeancier' && <Echeancier ill={ill} />}
        {ill.gabarit === 'avant_apres' && <AvantApres ill={ill} />}
      </div>
      <Legende ill={ill} />
      <ul className="sr-only">
        {texteEquivalent(ill).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <p className="lp-illu-note">
        {ill.note}{' '}
        <span className="lp-illu-statut">{ill.reel ? `Chiffres publiés · ${ill.source}` : 'Exemple fictif'}</span>
      </p>
    </figure>
  );
}

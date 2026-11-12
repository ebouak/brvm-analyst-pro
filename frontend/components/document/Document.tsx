/**
 * Composants du système de document (lot 3). Rendu serveur, SVG pur : les
 * documents s'impriment à l'identique (Recharts est client-only). Styles :
 * `./document.css`, importée par chaque page qui les utilise.
 */
import type { ReactNode } from 'react';

export function Document({ children }: { children: ReactNode }) {
  return <div className="doc">{children}</div>;
}

export function PiedDePage({ societe, page, total }: { societe: string; page: number; total: number }) {
  return (
    <div className="doc-pied">
      <span>{societe} · Document d&apos;information, ne constitue pas un conseil en investissement.</span>
      <span className="doc-tabulaire">{page} / {total}</span>
    </div>
  );
}

export function Feuille({ entete, societe, page, total, children, className }: {
  entete: string; societe: string; page: number; total: number; children: ReactNode; className?: string;
}) {
  return (
    <article className={`doc-feuille${className ? ` ${className}` : ''}`}>
      <div className="doc-courant"><span>{societe}</span><span>{entete}</span></div>
      {children}
      <PiedDePage societe={societe} page={page} total={total} />
    </article>
  );
}

export interface ChiffreCouverture { libelle: string; valeur: string; note?: string | null }

export function Couverture({ entete, societe, code, logo, surtitre, constat, chiffres, total }: {
  entete: string; societe: string; code: string; logo: string | null; surtitre: string;
  constat: string | null; chiffres: ChiffreCouverture[]; total: number;
}) {
  return (
    <article className="doc-feuille doc-couverture">
      <div className="doc-courant"><span>WESTBOURSE</span><span>{entete}</span></div>
      <div className="doc-couv-logo">
        {logo ? <img src={logo} alt={`Logo ${societe}`} /> : <span aria-hidden>{code.slice(0, 2)}</span>}
      </div>
      <p className="doc-couv-surtitre">{surtitre}</p>
      <h1 className="doc-couv-nom">{societe}</h1>
      {constat && <p className="doc-couv-constat">{constat}</p>}
      <dl className="doc-grille doc-couv-chiffres">
        {chiffres.slice(0, 3).map((c) => (
          <div key={c.libelle}>
            <dt>{c.libelle}</dt>
            <dd>{c.valeur}</dd>
            {c.note && <small>{c.note}</small>}
          </div>
        ))}
      </dl>
      <PiedDePage societe={code} page={1} total={total} />
    </article>
  );
}

/** Couverture photo : image d'activité sur les deux tiers, fondue dans l'aplat nuit. */
export function CouverturePhoto({ entete, societe, code, logo, photo, surtitre, constat, chiffres, total }: {
  entete: string; societe: string; code: string; logo: string | null;
  photo: { fichier: string; credit: string } | null; surtitre: string;
  constat: string | null; chiffres: ChiffreCouverture[]; total: number;
}) {
  return (
    <article className="doc-feuille doc-couv2">
      {photo && <div className="doc-couv2-photo"><img src={photo.fichier} alt="" /></div>}
      <div className="doc-couv2-haut"><span className="doc-couv2-marque">WESTBOURSE</span><span>{entete}</span></div>
      {photo && <small className="doc-couv2-credit">{photo.credit}</small>}
      <div className="doc-couv2-corps">
        <div className="doc-couv2-ident">
          <div className="doc-couv2-logo">{logo ? <img src={logo} alt={`Logo ${societe}`} /> : <span aria-hidden>{code.slice(0, 2)}</span>}</div>
          <p className="doc-couv2-surtitre">{surtitre}</p>
        </div>
        <h1 className="doc-couv2-nom">{societe}</h1>
        {constat && <p className="doc-couv2-constat">{constat}</p>}
        <dl className="doc-grille doc-couv-chiffres">
          {chiffres.slice(0, 3).map((c) => (
            <div key={c.libelle}><dt>{c.libelle}</dt><dd>{c.valeur}</dd>{c.note && <small>{c.note}</small>}</div>
          ))}
        </dl>
        <PiedDePage societe={code} page={1} total={total} />
      </div>
    </article>
  );
}

export interface ChiffreCle { libelle: string; valeur: string | null; unite?: string; note?: string | null }

/** Page « L'essentiel » : la photo en bande verticale, une déclaration mesurée, quatre chiffres. */
export function PageEssentiel({ photo, surtitre, declaration, chiffres, societe, page, total }: {
  photo: { fichier: string; credit: string } | null; surtitre: string; declaration: string;
  chiffres: ChiffreCle[]; societe: string; page: number; total: number;
}) {
  return (
    <article className="doc-feuille doc-essentiel">
      {photo && <div className="doc-essentiel-photo"><img src={photo.fichier} alt="" /><small>{photo.credit}</small></div>}
      <div className="doc-essentiel-corps">
        <p className="doc-surtitre">{surtitre}</p>
        <p className="doc-declaration">{declaration}</p>
        <dl className="doc-chiffres-cles">
          {chiffres.map((c) => (
            <div key={c.libelle}>
              <dt>{c.libelle}</dt>
              <dd>{c.valeur ?? <span className="doc-absent">non disponible</span>}{c.valeur != null && c.unite ? <span>{c.unite}</span> : null}</dd>
              {c.note && <small>{c.note}</small>}
            </div>
          ))}
        </dl>
        <PiedDePage societe={societe} page={page} total={total} />
      </div>
    </article>
  );
}

export function BandeMesures({ items }: { items: MesureDoc[] }) {
  return <div className="doc-bande"><Mesures items={items} /></div>;
}

/**
 * Échelle de repérage : situe une valeur sur un segment (médiane des comparables,
 * plage 52 semaines). Les repères sont étiquetés directement, sans légende.
 */
export function EchelleRepere({ titre, min, max, reperes, format }: {
  titre: string; min: number; max: number;
  reperes: { valeur: number; libelle: string; accent?: boolean }[];
  format: (v: number) => string;
}) {
  if (!(max > min)) return null;
  const L = 600, H = 74, g = 8, d = 592, y = 40;
  const x = (v: number) => g + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (d - g);
  return (
    <div className="doc-echelle">
      <h3>{titre}</h3>
      <svg className="doc-graphique" style={{ marginTop: 0 }} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={titre}>
        <line x1={g} x2={d} y1={y} y2={y} stroke="var(--doc-gris)" strokeWidth={6} />
        <text x={g} y={H - 4} className="axe">{format(min)}</text>
        <text x={d} y={H - 4} textAnchor="end" className="axe">{format(max)}</text>
        {reperes.map((r) => (
          <g key={r.libelle}>
            <line x1={x(r.valeur)} x2={x(r.valeur)} y1={y - 12} y2={y + 12} stroke={r.accent ? 'var(--doc-accent)' : 'var(--doc-encre)'} strokeWidth={r.accent ? 4 : 2} />
            <text x={x(r.valeur)} y={y - 18} textAnchor={x(r.valeur) > L - 90 ? 'end' : x(r.valeur) < 90 ? 'start' : 'middle'} className={r.accent ? 'val-accent' : 'val'}>
              {r.libelle} {format(r.valeur)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function OuvertureSection({ numero, titre, sommaire, entete, societe, photo }: {
  numero: number; titre: string; sommaire: string[]; entete: string; societe: string; photo?: string | null;
}) {
  return (
    <article className="doc-feuille doc-ouverture">
      {photo && <div className="doc-ouverture-photo"><img src={photo} alt="" /></div>}
      <div className="doc-courant"><span>{societe}</span><span>{entete}</span></div>
      <div className="doc-ouv-numero" aria-hidden>{String(numero).padStart(2, '0')}</div>
      <h2 className="doc-ouv-titre">{titre}</h2>
      {sommaire.length > 0 && (
        <ul className="doc-ouv-sommaire">{sommaire.map((s) => <li key={s}>{s}</li>)}</ul>
      )}
    </article>
  );
}

export function Panneau({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="doc-panneau">
      <h2 className="doc-titre-constat">{titre}</h2>
      {children}
    </section>
  );
}

export function ChiffreGeant({ valeur, unite, legende }: { valeur: string | null; unite?: string; legende?: string | null }) {
  if (valeur == null) return <p className="doc-geant-legende doc-absent">Donnée non disponible.</p>;
  return (
    <>
      <div className="doc-geant">
        <span className="doc-geant-valeur">{valeur}</span>
        {unite && <span className="doc-geant-unite">{unite}</span>}
      </div>
      {legende && <p className="doc-geant-legende">{legende}</p>}
    </>
  );
}

export interface MesureDoc { libelle: string; valeur: string | null; note?: string | null }

export function Mesures({ items }: { items: MesureDoc[] }) {
  return (
    <dl className="doc-grille doc-mesures">
      {items.map((m) => (
        <div key={m.libelle}>
          <dt>{m.libelle}</dt>
          <dd>{m.valeur ?? <span className="doc-absent">non disponible</span>}</dd>
          {m.note && <small>{m.note}</small>}
        </div>
      ))}
    </dl>
  );
}

/**
 * Barres verticales épurées : la dernière en accent, les autres en gris, la valeur
 * écrite au-dessus de chaque barre, l'exercice dessous. Ni légende, ni quadrillage,
 * ni cadre. Une barre absente est dite « n.d. », jamais tracée à zéro.
 */
export function GraphiqueBarres({ points, format, titre, largeur = 600, hauteur = 210 }: {
  points: { libelle: string; valeur: number | null }[];
  format: (v: number) => string;
  titre: string;
  /** Repère du viewBox : un graphique en demi-colonne prend 300 × 300 pour garder des étiquettes lisibles. */
  largeur?: number;
  hauteur?: number;
}) {
  const L = largeur, H = hauteur, haut = 26, bas = 24;
  const vals = points.map((p) => p.valeur).filter((v): v is number => v != null && v > 0);
  if (vals.length === 0) return null;
  const max = Math.max(...vals);
  const pas = L / points.length;
  const larg = Math.min(64, pas * 0.56);
  const h = H - haut - bas;
  return (
    <svg className="doc-graphique" viewBox={`0 0 ${L} ${H}`} role="img" aria-label={titre}>
      {points.map((p, i) => {
        const x = i * pas + (pas - larg) / 2;
        const dernier = i === points.length - 1;
        if (p.valeur == null || p.valeur <= 0) {
          return (
            <g key={p.libelle}>
              <text x={x + larg / 2} y={H - bas - 4} textAnchor="middle" className="axe">n.d.</text>
              <text x={x + larg / 2} y={H - 6} textAnchor="middle" className="axe">{p.libelle}</text>
            </g>
          );
        }
        const bh = (p.valeur / max) * h;
        const y = haut + h - bh;
        return (
          <g key={p.libelle}>
            <rect x={x} y={y} width={larg} height={bh} fill={dernier ? 'var(--doc-accent)' : 'var(--doc-gris)'} />
            <text x={x + larg / 2} y={y - 6} textAnchor="middle" className={dernier ? 'val-accent' : 'val'}>{format(p.valeur)}</text>
            <text x={x + larg / 2} y={H - 6} textAnchor="middle" className="axe">{p.libelle}</text>
          </g>
        );
      })}
    </svg>
  );
}

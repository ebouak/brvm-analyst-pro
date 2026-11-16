'use client';
// Couche SVG des dessins, posée sur le panneau des prix du graphique.
//
// Les dessins sont ancrés en (date, prix) ; `geo` convertit à chaque rendu en
// pixels du panneau. En mode « sélection », seuls les tracés captent le
// pointeur : le reste du graphique défile et zoome normalement. En mode
// dessin, la couche capte tout le panneau.

import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Ancre } from '@/lib/graphique/geometrie';
import { mesurer, niveauxFibonacci } from '@/lib/graphique/geometrie';
import { OUTILS_DEUX_POINTS, type Dessin, type TypeDessin } from '@/lib/graphique/dessins';
import { fmtEcartSigne, fmtPctSigne, fmtPrix } from '@/lib/graphique/format';
import type { Outil } from './BarreDessin';

export interface Geo {
  largeur: number;
  hauteur: number;
  x: (t: string) => number | null;
  y: (p: number) => number | null;
  ancre: (x: number, y: number) => Ancre | null;
  /** Décale une date d'un nombre de barres (fractionnaire, arrondi). */
  decaler: (t: string, barres: number) => string;
  /** Position logique (rang de barre) d'une abscisse. */
  logique: (x: number) => number | null;
}

interface Props {
  geo: Geo;
  dessins: Dessin[];
  onChange: (d: Dessin[]) => void;
  outil: Outil;
  couleur: string;
  epaisseur: 1 | 2 | 3;
  selection: string | null;
  onSelection: (id: string | null) => void;
  couleurs: Record<string, string>;
  seances: readonly { date: string }[];
  onTexte: (a: Ancre) => void;
  onSurvol?: (a: Ancre | null) => void;
  nouvelId: () => string;
}

interface Glisse {
  id: string;
  x0: number;
  y0: number;
  l0: number;
  origine: Dessin;
}

const POLICE = 'Inter, ui-sans-serif, system-ui, sans-serif';

export default function CoucheDessins(props: Props) {
  const { geo, dessins, outil, couleurs } = props;
  const [brouillon, setBrouillon] = useState<{ type: TypeDessin; a: Ancre; b: Ancre } | null>(null);
  const glisse = useRef<Glisse | null>(null);
  const appui = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const local = (e: RPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const enDessin = outil !== 'selection';

  function valider(type: TypeDessin, a: Ancre, b?: Ancre) {
    const d: Dessin = { id: props.nouvelId(), type, a, ...(b ? { b } : {}), couleur: props.couleur, epaisseur: props.epaisseur };
    props.onChange([...dessins, d]);
    props.onSelection(d.id);
  }

  function surAppui(e: RPointerEvent<SVGSVGElement>) {
    if (!enDessin) return;
    const { x, y } = local(e);
    const a = geo.ancre(x, y);
    if (!a) return;
    e.preventDefault();
    appui.current = { x, y };
    const type = outil as TypeDessin;
    if (type === 'horizontale') return valider('horizontale', a);
    if (type === 'texte') return props.onTexte(a);
    if (!brouillon) {
      setBrouillon({ type, a, b: a });
      svgRef.current?.setPointerCapture(e.pointerId);
    } else {
      valider(brouillon.type, brouillon.a, a);
      setBrouillon(null);
    }
  }

  function surMouvement(e: RPointerEvent<SVGSVGElement>) {
    const { x, y } = local(e);
    const g = glisse.current;
    if (g) {
      const l = geo.logique(x);
      const a = geo.ancre(x, y);
      const a0 = geo.ancre(g.x0, g.y0);
      if (l == null || !a || !a0) return;
      const dl = l - g.l0;
      // Le prix se déplace en relatif : le geste reste juste en échelle logarithmique.
      const facteur = a.p / a0.p;
      const bouge = (q: Ancre): Ancre => ({ t: g.origine.type === 'horizontale' ? q.t : geo.decaler(q.t, dl), p: q.p * facteur });
      const d: Dessin = { ...g.origine, a: bouge(g.origine.a), ...(g.origine.b ? { b: bouge(g.origine.b) } : {}) };
      props.onChange(dessins.map((x2) => (x2.id === g.id ? d : x2)));
      return;
    }
    if (!enDessin) return;
    const a = geo.ancre(x, y);
    props.onSurvol?.(a);
    if (brouillon && a) setBrouillon({ ...brouillon, b: a });
  }

  function surRelache(e: RPointerEvent<SVGSVGElement>) {
    if (glisse.current) {
      glisse.current = null;
      svgRef.current?.releasePointerCapture(e.pointerId);
      return;
    }
    // Tracé « glisser-déposer » : relâché assez loin de l'appui, on valide.
    if (brouillon && appui.current) {
      const { x, y } = local(e);
      if (Math.hypot(x - appui.current.x, y - appui.current.y) > 8) {
        const b = geo.ancre(x, y);
        if (b) {
          valider(brouillon.type, brouillon.a, b);
          setBrouillon(null);
        }
      }
    }
    appui.current = null;
  }

  function surAppuiTrace(e: RPointerEvent, d: Dessin) {
    if (enDessin) return;
    e.stopPropagation();
    e.preventDefault();
    props.onSelection(d.id);
    const { x, y } = local(e);
    const l0 = geo.logique(x);
    if (l0 == null) return;
    glisse.current = { id: d.id, x0: x, y0: y, l0, origine: d };
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  const visibles = brouillon
    ? [...dessins, { id: '__brouillon', type: brouillon.type, a: brouillon.a, b: brouillon.b, couleur: props.couleur, epaisseur: props.epaisseur } as Dessin]
    : dessins;

  return (
    <svg
      ref={svgRef}
      data-couche-dessins
      xmlns="http://www.w3.org/2000/svg"
      width={geo.largeur}
      height={geo.hauteur}
      className="absolute left-0 top-0 select-none"
      style={{ pointerEvents: enDessin ? 'all' : 'none', cursor: enDessin ? 'crosshair' : 'default', touchAction: enDessin ? 'none' : 'auto' }}
      onPointerDown={surAppui}
      onPointerMove={surMouvement}
      onPointerUp={surRelache}
      onPointerLeave={() => props.onSurvol?.(null)}
      aria-hidden
    >
      {visibles.map((d) => (
        <Trace
          key={d.id}
          d={d}
          geo={geo}
          couleur={couleurs[d.couleur] ?? couleurs.accent!}
          fond={couleurs.surface!}
          hausse={couleurs.up!}
          baisse={couleurs.down!}
          selectionne={props.selection === d.id}
          interactif={!enDessin && d.id !== '__brouillon'}
          seances={props.seances}
          onAppui={(e) => surAppuiTrace(e, d)}
        />
      ))}
    </svg>
  );
}

function Etiquette({ x, y, texte, couleur, fond, ancre = 'start' }: { x: number; y: number; texte: string; couleur: string; fond: string; ancre?: 'start' | 'end' | 'middle' }) {
  const w = texte.length * 6.3 + 10;
  const x0 = ancre === 'end' ? x - w : ancre === 'middle' ? x - w / 2 : x;
  return (
    <g>
      <rect x={x0} y={y - 9} width={w} height={17} rx={3} fill={fond} fillOpacity={0.88} stroke={couleur} strokeOpacity={0.5} strokeWidth={0.75} />
      <text x={x0 + 5} y={y + 3.5} fontSize={11} fontFamily={POLICE} fill={couleur}>
        {texte}
      </text>
    </g>
  );
}

function Trace(p: {
  d: Dessin;
  geo: Geo;
  couleur: string;
  fond: string;
  hausse: string;
  baisse: string;
  selectionne: boolean;
  interactif: boolean;
  seances: readonly { date: string }[];
  onAppui: (e: RPointerEvent) => void;
}) {
  const { d, geo, couleur, fond } = p;
  const W = geo.largeur;
  const xa = geo.x(d.a.t);
  const ya = geo.y(d.a.p);
  const xb = d.b ? geo.x(d.b.t) : null;
  const yb = d.b ? geo.y(d.b.p) : null;
  if (ya == null) return null;
  if (OUTILS_DEUX_POINTS.includes(d.type) && (xa == null || xb == null || yb == null)) return null;
  const sw = d.epaisseur;
  const tirets = p.selectionne ? '5 3' : undefined;
  const hit = p.interactif
    ? { onPointerDown: p.onAppui, style: { pointerEvents: 'stroke' as const, cursor: 'move' } }
    : { style: { pointerEvents: 'none' as const } };
  const poignees =
    p.selectionne && xa != null ? (
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={xa} cy={ya} r={4} fill={fond} stroke={couleur} strokeWidth={1.5} />
        {xb != null && yb != null ? <circle cx={xb} cy={yb} r={4} fill={fond} stroke={couleur} strokeWidth={1.5} /> : null}
      </g>
    ) : null;

  switch (d.type) {
    case 'horizontale':
      return (
        <g>
          <line x1={0} x2={W} y1={ya} y2={ya} stroke={couleur} strokeWidth={sw} strokeDasharray={tirets} />
          <line x1={0} x2={W} y1={ya} y2={ya} stroke="transparent" strokeWidth={14} {...hit} />
          <Etiquette x={W - 4} y={ya} ancre="end" texte={fmtPrix(d.a.p)} couleur={couleur} fond={fond} />
        </g>
      );
    case 'tendance':
    case 'segment': {
      let x2 = xb!;
      let y2 = yb!;
      if (d.type === 'tendance' && xb !== xa) {
        // Demi-droite prolongée jusqu'au bord, dans le sens du second point.
        const pente = (yb! - ya) / (xb! - xa!);
        x2 = xb! > xa! ? W : 0;
        y2 = ya + pente * (x2 - xa!);
      }
      return (
        <g>
          <line x1={xa!} y1={ya} x2={x2} y2={y2} stroke={couleur} strokeWidth={sw} strokeDasharray={tirets} />
          <line x1={xa!} y1={ya} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} {...hit} />
          {poignees}
        </g>
      );
    }
    case 'rectangle': {
      const x = Math.min(xa!, xb!);
      const y = Math.min(ya, yb!);
      return (
        <g>
          <rect x={x} y={y} width={Math.abs(xb! - xa!)} height={Math.abs(yb! - ya)} fill={couleur} fillOpacity={0.08} stroke={couleur} strokeWidth={sw} strokeDasharray={tirets} />
          <rect x={x} y={y} width={Math.abs(xb! - xa!)} height={Math.abs(yb! - ya)} fill="transparent" stroke="transparent" strokeWidth={12} {...hit} style={{ ...hit.style, pointerEvents: p.interactif ? 'all' : 'none' }} />
          {poignees}
        </g>
      );
    }
    case 'fibonacci': {
      const niveaux = niveauxFibonacci(d.a, d.b!);
      const x0 = Math.min(xa!, xb!);
      return (
        <g>
          <line x1={xa!} y1={ya} x2={xb!} y2={yb!} stroke={couleur} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} />
          {niveaux.map((n) => {
            const y = geo.y(n.prix);
            if (y == null) return null;
            return (
              <g key={n.ratio}>
                <line x1={x0} x2={W} y1={y} y2={y} stroke={couleur} strokeWidth={sw} strokeOpacity={n.ratio === 0 || n.ratio === 1 ? 1 : 0.75} strokeDasharray={tirets} />
                <line x1={x0} x2={W} y1={y} y2={y} stroke="transparent" strokeWidth={10} {...hit} />
                <text x={x0 + 4} y={y - 3} fontSize={10.5} fontFamily={POLICE} fill={couleur}>
                  {`${n.libelle} · ${fmtPrix(n.prix)}`}
                </text>
              </g>
            );
          })}
          {poignees}
        </g>
      );
    }
    case 'texte':
      if (xa == null) return null;
      return (
        <g>
          <g {...hit} style={{ ...hit.style, pointerEvents: p.interactif ? 'all' : 'none' }}>
            <Etiquette x={xa} y={ya} texte={d.texte ?? ''} couleur={couleur} fond={fond} />
          </g>
          {p.selectionne ? <circle cx={xa} cy={ya} r={3} fill={couleur} /> : null}
        </g>
      );
    case 'mesure': {
      const m = mesurer(d.a, d.b!, p.seances);
      const x = Math.min(xa!, xb!);
      const y = Math.min(ya, yb!);
      // La mesure garde le vert / rouge du marché : c'est un écart de cours.
      const c = m.ecart >= 0 ? p.hausse : p.baisse;
      const libelle = `${fmtEcartSigne(m.ecart)} FCFA (${fmtPctSigne(m.ecartPct)}) · ${m.seances} séance${m.seances > 1 ? 's' : ''}`;
      return (
        <g>
          <rect x={x} y={y} width={Math.abs(xb! - xa!)} height={Math.abs(yb! - ya)} fill={c} fillOpacity={0.1} stroke={c} strokeWidth={1} strokeDasharray="4 3" />
          <line x1={xa!} y1={ya} x2={xb!} y2={yb!} stroke={c} strokeWidth={sw} />
          <line x1={xa!} y1={ya} x2={xb!} y2={yb!} stroke="transparent" strokeWidth={14} {...hit} />
          <Etiquette x={(xa! + xb!) / 2} y={Math.max(12, y - 12)} ancre="middle" texte={libelle} couleur={c} fond={fond} />
          {poignees}
        </g>
      );
    }
    default:
      return null;
  }
}

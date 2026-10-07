import type { ReactNode } from 'react';

/**
 * Graphiques du diagnostic — SVG PUR, rendu côté serveur.
 *
 * Même choix que le dossier valeur (components/dossier/Graphiques.tsx) :
 * Recharts est client-only et peut sortir vide à l'impression ; un SVG rendu
 * au serveur est déjà là quand le navigateur ouvre l'aperçu PDF.
 *
 * Différence : le diagnostic est une page SOMBRE qui s'imprime sur fond BLANC.
 * Les couleurs passent donc par les jetons du thème (classes fill-/stroke-),
 * et aucun texte n'est écrit en blanc — il disparaîtrait à l'impression.
 *
 * Règles : une échelle par graphique (jamais deux axes) ; une graduation ne
 * nomme qu'une valeur réellement atteinte ; un point manquant reste un trou ;
 * légende dès deux séries.
 */

export type Ton = 'accent' | 'up' | 'down' | 'warn' | 'muted';
export type Format = 'fcfa' | 'fcfa_action' | 'pct' | 'x' | 'note';

const REMPLI: Record<Ton, string> = {
  accent: 'fill-accent', up: 'fill-up', down: 'fill-down', warn: 'fill-warn', muted: 'fill-muted',
};
const TRAIT: Record<Ton, string> = {
  accent: 'stroke-accent', up: 'stroke-up', down: 'stroke-down', warn: 'stroke-warn', muted: 'stroke-muted',
};

const nf = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

export function formater(v: number, f: Format): string {
  switch (f) {
    case 'fcfa': {
      const a = Math.abs(v);
      // Pas de « T » : abréviation anglaise, ambiguë en français. 2,91 × 10¹² → « 2 910 Md ».
      if (a >= 1e9) return `${nf(v / 1e9, a >= 1e11 ? 0 : 1)} Md`;
      if (a >= 1e6) return `${nf(v / 1e6, 0)} M`;
      return nf(v);
    }
    case 'fcfa_action': return `${nf(v)} FCFA`;
    case 'pct': return `${nf(v, 1)} %`;
    case 'x': return `${nf(v, 1)}×`;
    case 'note': return nf(v);
  }
}

// ── Cadre commun ─────────────────────────────────────────────────────────────

export function Figure({ titre, lecture, source, children }: {
  titre: string;
  /** Une phrase qui dit QUOI regarder, sans conclure à la place du lecteur. */
  lecture?: string;
  source: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-4 rounded-xl border border-border/60 bg-bg/40 p-4 print:break-inside-avoid print:border-gray-300">
      <figcaption className="mb-2">
        <p className="text-sm font-semibold text-ivory print:text-black">{titre}</p>
        {lecture && <p className="text-xs text-muted mt-0.5">{lecture}</p>}
      </figcaption>
      {children}
      <p className="mt-2 text-[11px] text-faint">Source : {source}</p>
    </figure>
  );
}

function Legende({ series }: { series: { nom: string; ton: Ton }[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {series.map((s) => (
        <li key={s.nom} className="flex items-center gap-1.5">
          {/* SVG et non fond CSS : les navigateurs n'impriment pas les couleurs
              de fond par défaut, la pastille disparaissait du PDF. */}
          <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
            <rect width="10" height="10" rx="2" className={REMPLI[s.ton]} />
          </svg>
          {s.nom}
        </li>
      ))}
    </ul>
  );
}

function bornes(valeurs: number[], inclureZero = true): { min: number; max: number } {
  const min = inclureZero ? Math.min(0, ...valeurs) : Math.min(...valeurs);
  const max = inclureZero ? Math.max(0, ...valeurs) : Math.max(...valeurs);
  if (min === max) return { min: min - 1, max: max + 1 };
  const marge = (max - min) * 0.1;
  return { min: min < 0 || !inclureZero ? min - marge : 0, max: max + marge };
}

const L = 640;

// ── Barres groupées par exercice ────────────────────────────────────────────

export interface Serie {
  nom: string; ton: Ton; valeurs: (number | null)[];
  /** Barre négative en rouge (un résultat net déficitaire). Sans lui, la série
   *  garde sa couleur sous zéro : deux flux sortants restent distinguables. */
  negatifEnRouge?: boolean;
}

/** Ne garde que les exercices où au moins une série a une valeur : un axe
 *  « 2021 2022 2023 » sans barre n'apprend rien et écrase le reste. */
function exercicesRenseignes(annees: string[], series: Serie[]): { annees: string[]; series: Serie[] } {
  const garder = annees.map((_, i) => series.some((s) => s.valeurs[i] != null));
  return {
    annees: annees.filter((_, i) => garder[i]),
    series: series.map((s) => ({ ...s, valeurs: s.valeurs.filter((_, i) => garder[i]) })),
  };
}

export function Barres({ annees: tous, series: brutes, format, resume }: {
  annees: string[]; series: Serie[]; format: Format; resume: string;
}) {
  const { annees, series } = exercicesRenseignes(tous, brutes);
  const H = 230;
  const MG = { haut: 18, bas: 26, gauche: 62, droite: 8 };
  const toutes = series.flatMap((s) => s.valeurs.filter((v): v is number => v != null));
  if (toutes.length === 0) return <p className="text-xs text-faint">Aucune donnée exploitable.</p>;
  const { min, max } = bornes(toutes);
  const hU = H - MG.haut - MG.bas;
  const y = (v: number) => MG.haut + hU * (1 - (v - min) / (max - min));
  const pas = (L - MG.gauche - MG.droite) / annees.length;
  const lb = Math.min((pas * 0.7) / series.length, 26);
  const grad = [...new Set([Math.min(...toutes), 0, Math.max(...toutes)])].filter((v) => v >= min && v <= max);

  return (
    <div>
      <Legende series={series} />
      <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={resume}>
        {grad.map((g) => (
          <g key={g}>
            <line x1={MG.gauche} x2={L - MG.droite} y1={y(g)} y2={y(g)} className={g === 0 ? 'stroke-muted' : 'stroke-border'} strokeWidth={g === 0 ? 1 : 0.6} />
            <text x={MG.gauche - 6} y={y(g) + 3.5} textAnchor="end" className="fill-muted" fontSize="10.5">{formater(g, format)}</text>
          </g>
        ))}
        {annees.map((a, i) => {
          const x0 = MG.gauche + pas * i + (pas - lb * series.length - 2 * (series.length - 1)) / 2;
          return (
            <g key={a}>
              {series.map((s, j) => {
                const v = s.valeurs[i];
                if (v == null) return null;
                const yv = y(v);
                const y0 = y(0);
                const ton = v < 0 && s.negatifEnRouge ? 'down' : s.ton;
                return (
                  <g key={s.nom}>
                    <rect x={x0 + j * (lb + 2)} y={Math.min(yv, y0)} width={lb} height={Math.max(1, Math.abs(y0 - yv))} rx={2} className={REMPLI[ton]} />
                    {series.length <= 2 && (
                      <text x={x0 + j * (lb + 2) + lb / 2} y={v >= 0 ? yv - 4 : yv + 11} textAnchor="middle" className="fill-muted" fontSize="9.5">
                        {formater(v, format)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={MG.gauche + pas * i + pas / 2} y={H - 8} textAnchor="middle" className="fill-muted" fontSize="11">{a}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Courbes par exercice ────────────────────────────────────────────────────

export function Courbes({ annees: tous, series: brutes, format, reference, resume }: {
  annees: string[]; series: Serie[]; format: Format; resume: string;
  /** Ligne horizontale de référence (minimum réglementaire, seuil…). */
  reference?: { valeur: number; libelle: string };
}) {
  const { annees, series } = exercicesRenseignes(tous, brutes);
  const H = 210;
  const MG = { haut: 16, bas: 26, gauche: 52, droite: 70 };
  const toutes = series.flatMap((s) => s.valeurs.filter((v): v is number => v != null));
  if (toutes.length === 0) return <p className="text-xs text-faint">Aucune donnée exploitable.</p>;
  const { min, max } = bornes(reference ? [...toutes, reference.valeur] : toutes, false);
  const hU = H - MG.haut - MG.bas;
  const y = (v: number) => MG.haut + hU * (1 - (v - min) / (max - min));
  const pas = annees.length > 1 ? (L - MG.gauche - MG.droite) / (annees.length - 1) : 0;
  const x = (i: number) => (annees.length > 1 ? MG.gauche + pas * i : (L - MG.droite + MG.gauche) / 2);
  const grad = [...new Set([Math.min(...toutes), Math.max(...toutes)])];

  return (
    <div>
      <Legende series={series} />
      <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={resume}>
        {grad.map((g) => (
          <g key={g}>
            <line x1={MG.gauche} x2={L - MG.droite} y1={y(g)} y2={y(g)} className="stroke-border" strokeWidth={0.6} />
            <text x={MG.gauche - 6} y={y(g) + 3.5} textAnchor="end" className="fill-muted" fontSize="10.5">{formater(g, format)}</text>
          </g>
        ))}
        {reference && (
          <g>
            <line x1={MG.gauche} x2={L - MG.droite} y1={y(reference.valeur)} y2={y(reference.valeur)} className="stroke-warn" strokeWidth={1} strokeDasharray="4 3" />
            <text x={L - MG.droite + 4} y={y(reference.valeur) + 3.5} className="fill-warn" fontSize="10">{reference.libelle}</text>
          </g>
        )}
        {series.map((s) => {
          const pts = s.valeurs.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)));
          // Un trou coupe la ligne : on ne relie que des points consécutifs.
          const segments: string[] = [];
          let courant: string[] = [];
          pts.forEach((p) => {
            if (p) courant.push(`${p[0]},${p[1]}`);
            else { if (courant.length > 1) segments.push(courant.join(' ')); courant = []; }
          });
          if (courant.length > 1) segments.push(courant.join(' '));
          let iDernier = -1;
          s.valeurs.forEach((v, i) => { if (v != null) iDernier = i; });
          const dernier = iDernier >= 0 ? s.valeurs[iDernier]! : null;
          return (
            <g key={s.nom}>
              {segments.map((seg, k) => <polyline key={k} points={seg} fill="none" className={TRAIT[s.ton]} strokeWidth={2} />)}
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} className={`${REMPLI[s.ton]} stroke-bg`} strokeWidth={1} />)}
              {dernier != null && (
                <text x={x(iDernier) + 7} y={y(dernier) + 3.5} className={REMPLI[s.ton]} fontSize="10.5">{formater(dernier, format)}</text>
              )}
            </g>
          );
        })}
        {annees.map((a, i) => (
          <text key={a} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize="11">{a}</text>
        ))}
      </svg>
    </div>
  );
}

// ── Barres horizontales (notes /100, sévérités /10) ─────────────────────────

export interface LigneH { libelle: string; valeur: number | null; ton: Ton; note?: string }

export function BarresH({ lignes, max, format, resume }: { lignes: LigneH[]; max: number; format: Format; resume: string }) {
  const hLigne = 26;
  const H = lignes.length * hLigne + 8;
  const G = 280;
  const D = 104;
  const largeur = L - G - D;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={resume}>
      {lignes.map((l, i) => {
        const yc = 4 + i * hLigne + hLigne / 2;
        const w = l.valeur == null ? 0 : (Math.max(0, Math.min(l.valeur, max)) / max) * largeur;
        return (
          <g key={l.libelle}>
            <text x={G - 8} y={yc + 3.5} textAnchor="end" className="fill-muted" fontSize="11">{l.libelle}</text>
            <rect x={G} y={yc - 6} width={largeur} height={12} rx={3} className="fill-border" opacity={0.45} />
            {l.valeur != null && <rect x={G} y={yc - 6} width={Math.max(w, 2)} height={12} rx={3} className={REMPLI[l.ton]} />}
            <text x={G + largeur + 6} y={yc + 3.5} className={l.valeur == null ? 'fill-faint' : 'fill-muted'} fontSize="10.5">
              {l.valeur == null ? (l.note ?? 'n.d.') : `${formater(l.valeur, format)}${l.note ? ` ${l.note}` : ''}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Société contre médiane des pairs ────────────────────────────────────────

export interface LignePair {
  libelle: string; unite: '%' | 'x'; valeur: number; mediane: number; nbPairs: number;
  lecture: 'favorable' | 'defavorable' | 'neutre' | null;
}

export function Pairs({ lignes, resume }: { lignes: LignePair[]; resume: string }) {
  const hLigne = 34;
  const H = lignes.length * hLigne + 10;
  const G = 210;
  const D = 120;
  const largeur = L - G - D;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={resume}>
      {lignes.map((l, i) => {
        // Une échelle PAR ligne : un PER (×) et un ROE (%) ne se lisent pas sur le même axe.
        const { min, max } = bornes([l.valeur, l.mediane]);
        const x = (v: number) => G + ((v - min) / (max - min)) * largeur;
        const yc = 6 + i * hLigne + hLigne / 2;
        const ton: Ton = l.lecture === 'favorable' ? 'up' : l.lecture === 'defavorable' ? 'down' : 'accent';
        const f: Format = l.unite === '%' ? 'pct' : 'x';
        return (
          <g key={l.libelle}>
            <text x={G - 8} y={yc + 3.5} textAnchor="end" className="fill-muted" fontSize="11">{l.libelle}</text>
            <line x1={x(Math.max(min, 0))} x2={x(l.valeur)} y1={yc} y2={yc} className={TRAIT[ton]} strokeWidth={7} strokeLinecap="round" />
            <line x1={x(l.mediane)} x2={x(l.mediane)} y1={yc - 9} y2={yc + 9} className="stroke-muted" strokeWidth={2} />
            <text x={G + largeur + 8} y={yc - 1} className={REMPLI[ton]} fontSize="10.5">{formater(l.valeur, f)}</text>
            <text x={G + largeur + 8} y={yc + 11} className="fill-faint" fontSize="9.5">médiane {formater(l.mediane, f)} · {l.nbPairs} pairs</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Fourchette de valorisation (« football field ») ─────────────────────────

export interface Methode { libelle: string; bas: number; centrale: number; haut: number }

export function Fourchette({ methodes, cours, resume }: { methodes: Methode[]; cours: number | null; resume: string }) {
  const hLigne = 34;
  const H = methodes.length * hLigne + 34;
  const G = 200;
  const D = 24;
  const largeur = L - G - D;
  const toutes = methodes.flatMap((m) => [m.bas, m.haut]).concat(cours != null ? [cours] : []);
  const { min, max } = bornes(toutes, false);
  const x = (v: number) => G + ((v - min) / (max - min)) * largeur;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={resume}>
      {methodes.map((m, i) => {
        const yc = 8 + i * hLigne + hLigne / 2;
        const ton: Ton = cours == null ? 'accent' : m.centrale >= cours ? 'up' : 'down';
        return (
          <g key={m.libelle}>
            <text x={G - 8} y={yc + 3.5} textAnchor="end" className="fill-muted" fontSize="11">{m.libelle}</text>
            {m.haut > m.bas
              ? <rect x={x(m.bas)} y={yc - 7} width={Math.max(2, x(m.haut) - x(m.bas))} height={14} rx={3} className={REMPLI[ton]} opacity={0.35} />
              : null}
            <circle cx={x(m.centrale)} cy={yc} r={5} className={`${REMPLI[ton]} stroke-bg`} strokeWidth={1.5} />
            <text x={x(m.centrale)} y={yc - 10} textAnchor="middle" className="fill-muted" fontSize="10">{formater(m.centrale, 'fcfa_action')}</text>
          </g>
        );
      })}
      {cours != null && (
        <g>
          <line x1={x(cours)} x2={x(cours)} y1={6} y2={H - 22} className="stroke-muted" strokeWidth={1.4} strokeDasharray="5 3" />
          <text x={x(cours)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize="10.5">cours {formater(cours, 'fcfa_action')}</text>
        </g>
      )}
    </svg>
  );
}

// ── Jauge de solvabilité ────────────────────────────────────────────────────

export function Jauge({ valeur, minimum, absence, resume }: {
  valeur: number | null; minimum: number; absence: string | null; resume: string;
}) {
  const H = 64;
  const G = 16;
  const largeur = L - 2 * G;
  const max = Math.max(25, (valeur ?? 0) * 1.15);
  const x = (v: number) => G + (v / max) * largeur;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={resume}>
      <rect x={G} y={22} width={largeur} height={12} rx={6} className="fill-border" opacity={0.5} />
      <rect x={G} y={22} width={x(minimum) - G} height={12} rx={6} className="fill-down" opacity={0.25} />
      <line x1={x(minimum)} x2={x(minimum)} y1={14} y2={42} className="stroke-warn" strokeWidth={2} />
      <text x={x(minimum)} y={56} textAnchor="middle" className="fill-warn" fontSize="10.5">minimum UEMOA {formater(minimum, 'pct')}</text>
      {valeur != null ? (
        <g>
          <circle cx={x(valeur)} cy={28} r={8} className={`${valeur >= minimum ? 'fill-up' : 'fill-down'} stroke-bg`} strokeWidth={2} />
          <text x={x(valeur)} y={11} textAnchor="middle" className="fill-muted" fontSize="11">{formater(valeur, 'pct')}</text>
        </g>
      ) : (
        <text x={x(minimum) + 12} y={12} textAnchor="start" className="fill-faint" fontSize="11">{absence ?? 'non trouvé dans les documents consultés'}</text>
      )}
    </svg>
  );
}

// ── Cours sur 12 mois ───────────────────────────────────────────────────────

export function CourbeCours({ points, resume }: { points: { date: string; cours: number }[]; resume: string }) {
  if (points.length < 2) return <p className="text-xs text-faint">Historique de cours insuffisant.</p>;
  const H = 200;
  const MG = { haut: 14, bas: 24, gauche: 62, droite: 70 };
  const vals = points.map((p) => p.cours);
  const bas = Math.min(...vals);
  const haut = Math.max(...vals);
  const { min, max } = bornes(vals, false);
  const y = (v: number) => MG.haut + (H - MG.haut - MG.bas) * (1 - (v - min) / (max - min));
  const x = (i: number) => MG.gauche + (i / (points.length - 1)) * (L - MG.gauche - MG.droite);
  const dernier = points[points.length - 1]!;
  const mois = (d: string) => new Date(d).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label={resume}>
      {[bas, haut].map((g) => (
        <g key={g}>
          <line x1={MG.gauche} x2={L - MG.droite} y1={y(g)} y2={y(g)} className="stroke-border" strokeWidth={0.6} strokeDasharray="3 3" />
          <text x={MG.gauche - 6} y={y(g) + 3.5} textAnchor="end" className="fill-muted" fontSize="10.5">{formater(g, 'note')}</text>
        </g>
      ))}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.cours)}`).join(' ')} fill="none" className="stroke-accent" strokeWidth={1.8} />
      <circle cx={x(points.length - 1)} cy={y(dernier.cours)} r={3.5} className="fill-accent" />
      <text x={x(points.length - 1) + 7} y={y(dernier.cours) + 3.5} className="fill-accent" fontSize="10.5">{formater(dernier.cours, 'note')}</text>
      <text x={MG.gauche} y={H - 6} className="fill-muted" fontSize="10.5">{mois(points[0]!.date)}</text>
      <text x={L - MG.droite} y={H - 6} textAnchor="end" className="fill-muted" fontSize="10.5">{mois(dernier.date)}</text>
    </svg>
  );
}

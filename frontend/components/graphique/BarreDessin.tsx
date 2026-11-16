'use client';
// Barre des outils de dessin du graphique avancé (présentation pure).

import { Eraser, Minus, MousePointer2, Rows3, Ruler, Slash, Square, Trash2, TrendingUp, Type, type LucideIcon } from 'lucide-react';
import { COULEURS_DESSIN, LIBELLES_OUTILS, type TypeDessin } from '@/lib/graphique/dessins';

export type Outil = 'selection' | TypeDessin;

export const OUTILS: { cle: Outil; libelle: string; icone: LucideIcon; raccourci: string }[] = [
  { cle: 'selection', libelle: 'Sélectionner et déplacer', icone: MousePointer2, raccourci: 'V' },
  { cle: 'horizontale', libelle: LIBELLES_OUTILS.horizontale, icone: Minus, raccourci: 'H' },
  { cle: 'tendance', libelle: LIBELLES_OUTILS.tendance, icone: TrendingUp, raccourci: 'T' },
  { cle: 'segment', libelle: LIBELLES_OUTILS.segment, icone: Slash, raccourci: 'S' },
  { cle: 'rectangle', libelle: LIBELLES_OUTILS.rectangle, icone: Square, raccourci: 'R' },
  { cle: 'fibonacci', libelle: LIBELLES_OUTILS.fibonacci, icone: Rows3, raccourci: 'F' },
  { cle: 'texte', libelle: LIBELLES_OUTILS.texte, icone: Type, raccourci: 'A' },
  { cle: 'mesure', libelle: LIBELLES_OUTILS.mesure, icone: Ruler, raccourci: 'M' },
];

const CSS_COULEUR: Record<string, string> = {
  accent: 'rgb(var(--color-accent))',
  warn: 'rgb(var(--color-warn))',
  up: 'rgb(var(--color-up))',
  down: 'rgb(var(--color-down))',
  ivory: 'rgb(var(--color-ivory))',
};

const bouton =
  'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border px-2 text-xs transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

export interface BarreDessinProps {
  outil: Outil;
  onOutil: (o: Outil) => void;
  couleur: string;
  onCouleur: (c: string) => void;
  epaisseur: 1 | 2 | 3;
  onEpaisseur: (e: 1 | 2 | 3) => void;
  aSelection: boolean;
  onSupprimer: () => void;
  nbDessins: number;
  onToutEffacer: () => void;
  desactive?: boolean;
  raisonDesactive?: string;
}

export default function BarreDessin(p: BarreDessinProps) {
  return (
    <div role="toolbar" aria-label="Outils de dessin" className="flex flex-wrap items-center gap-1.5">
      {OUTILS.map((o) => {
        const actif = p.outil === o.cle;
        const Icone = o.icone;
        return (
          <button
            key={o.cle}
            type="button"
            aria-pressed={actif}
            aria-label={`${o.libelle} (${o.raccourci})`}
            title={p.desactive ? p.raisonDesactive : `${o.libelle} (${o.raccourci})`}
            disabled={p.desactive}
            onClick={() => p.onOutil(o.cle)}
            className={`${bouton} ${actif ? 'border-accent bg-accent/10 text-accent-ink' : 'border-border text-muted hover:border-accent hover:text-ivory'}`}
          >
            <Icone size={16} strokeWidth={1.75} aria-hidden />
          </button>
        );
      })}
      <span className="mx-1 h-6 w-px bg-border" aria-hidden />
      <fieldset className="flex items-center gap-1" disabled={p.desactive}>
        <legend className="sr-only">Couleur du tracé</legend>
        {COULEURS_DESSIN.map((c) => (
          <button
            key={c.valeur}
            type="button"
            aria-pressed={p.couleur === c.valeur}
            aria-label={`Couleur ${c.libelle}`}
            title={`Couleur ${c.libelle}`}
            onClick={() => p.onCouleur(c.valeur)}
            className={`grid h-9 w-7 place-items-center rounded-md border ${p.couleur === c.valeur ? 'border-accent' : 'border-transparent hover:border-border'}`}
          >
            <span className="block h-3.5 w-3.5 rounded-full" style={{ background: CSS_COULEUR[c.valeur] }} aria-hidden />
          </button>
        ))}
      </fieldset>
      <label className="flex items-center gap-1 text-xs text-muted">
        <span className="sr-only sm:not-sr-only">Épaisseur</span>
        <select
          value={p.epaisseur}
          disabled={p.desactive}
          onChange={(e) => p.onEpaisseur(Number(e.target.value) as 1 | 2 | 3)}
          className="h-9 rounded-md border border-border bg-surface px-1.5 text-xs text-ivory"
          aria-label="Épaisseur du trait"
        >
          <option value={1}>Fin</option>
          <option value={2}>Moyen</option>
          <option value={3}>Épais</option>
        </select>
      </label>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={p.onSupprimer}
        disabled={!p.aSelection || p.desactive}
        aria-label="Supprimer le dessin sélectionné (Suppr)"
        title="Supprimer le dessin sélectionné (Suppr)"
        className={`${bouton} border-border text-muted hover:border-down hover:text-down`}
      >
        <Trash2 size={16} strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        onClick={p.onToutEffacer}
        disabled={p.nbDessins === 0 || p.desactive}
        aria-label={`Effacer tous les dessins (${p.nbDessins})`}
        title="Effacer tous les dessins"
        className={`${bouton} border-border text-muted hover:border-down hover:text-down`}
      >
        <Eraser size={16} strokeWidth={1.75} aria-hidden />
        <span className="tabular">{p.nbDessins}</span>
      </button>
    </div>
  );
}

export { CSS_COULEUR };

'use client';

import { useRef, useState } from 'react';
import { LayoutGroup, motion, useInView, useReducedMotion } from 'framer-motion';
import { baremeComplet, type CoutSGIResult } from '@/lib/sgi-frais/calculateur';
import { largeurBarre } from '@/lib/sgi-frais/presentation';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import { CONFIANCE_LABEL, lienDecision, type SgiFrais } from '@/lib/sgi-frais/types';
import { ChiffreAnime } from './ChiffreAnime';

const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Classement lisible partout, mobile compris : rang, nom, coût et une barre
 * proportionnelle. Remplace le graphique (libellés illisibles en thème clair)
 * et le tableau dont la colonne « Total » sortait de l'écran sur mobile.
 * Quand un paramètre change, les lignes glissent vers leur nouveau rang.
 */
export function ClassementCout({
  resultats,
  sgiParNom,
  directoryParNom,
  limite = 10,
}: {
  /** Déjà classés (barèmes complets d'abord, coût croissant). */
  resultats: CoutSGIResult[];
  sgiParNom: Map<string, SgiFrais>;
  directoryParNom: Map<string, Sgi>;
  limite?: number;
}) {
  const [tout, setTout] = useState(false);
  const reduire = useReducedMotion();
  const ref = useRef<HTMLOListElement>(null);
  const vu = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });

  const visibles = tout ? resultats : resultats.slice(0, limite);
  // Échelle commune à toute la liste : une barre ne change pas de sens selon
  // qu'on affiche 10 ou 37 SGI.
  const max = Math.max(0, ...resultats.map((r) => r.total));

  return (
    <div className="rounded-panel border border-border bg-surface p-4 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted">Classement par coût total sur la période</p>
        <span className="font-mono text-[11px] text-faint">{resultats.length} SGI</span>
      </div>

      <LayoutGroup>
        <ol ref={ref} className="space-y-1.5">
          {visibles.map((r, i) => {
            const frais = sgiParNom.get(r.sgiNom);
            const dir = directoryParNom.get(r.sgiNom);
            const complet = baremeComplet(r);
            const premier = i === 0 && complet;
            const decision = lienDecision(frais);
            return (
              <motion.li
                key={r.sgiNom}
                layout={reduire ? false : 'position'}
                transition={{ duration: 0.35, ease: EASE }}
                className={`rounded-xl px-3 py-2.5 ${premier ? 'bg-up/[0.07] ring-1 ring-up/25' : 'hover:bg-elevated/60'} transition-colors`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`tabular mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
                      premier ? 'bg-up text-bg' : 'bg-elevated text-muted'
                    }`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium leading-snug text-ivory">
                        <span className="sr-only">Rang {i + 1} : </span>
                        {r.sgiNom}
                      </p>
                      <ChiffreAnime
                        valeur={r.total}
                        format={fmtFcfa}
                        className={`tabular flex-none whitespace-nowrap text-sm font-semibold ${premier ? 'text-up' : 'text-ivory'}`}
                      />
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border/60" aria-hidden>
                      {/* Largeur réelle dès le rendu serveur (rien de caché sans
                          JavaScript) ; la pousse d'entrée est une classe CSS
                          posée à l'apparition, coupée si moins d'animations. */}
                      <motion.div
                        className={`h-full origin-left rounded-full ${premier ? 'bg-up' : complet ? 'bg-accent/70' : 'bg-faint/60'} ${vu ? 'barre-pousse' : ''}`}
                        style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                        initial={false}
                        animate={{ width: `${largeurBarre(r.total, max)}%` }}
                        transition={{ duration: 0.5, ease: EASE }}
                      />
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-faint">
                      {dir && <span>{PAYS[dir.pays].nom}</span>}
                      {frais && <span>· {CONFIANCE_LABEL[frais.confiance]}</span>}
                      {!complet && <span className="text-warn">· barème incomplet, coût sous-estimé</span>}
                      {decision && (
                        <a href={decision} target="_blank" rel="noopener" className="text-accent hover:underline">
                          · Décision (PDF) ↗
                        </a>
                      )}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>

      {resultats.length > limite && (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          aria-expanded={tout}
          className="mt-3 w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-accent transition-colors hover:border-accent/40 hover:bg-accent/[0.05] active:scale-[0.99]"
        >
          {tout ? 'Réduire au top 10' : `Afficher les ${resultats.length} SGI`}
        </button>
      )}
    </div>
  );
}

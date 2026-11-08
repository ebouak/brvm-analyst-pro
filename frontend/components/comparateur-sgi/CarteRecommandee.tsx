'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { CoutSGIResult } from '@/lib/sgi-frais/calculateur';
import type { SgiFrais, ConfianceNiveau } from '@/lib/sgi-frais/types';
import { CONFIANCE_LABEL, CONFIANCE_BADGE_CLASS, lienDecision } from '@/lib/sgi-frais/types';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import { decomposerCout, type SegmentCout } from '@/lib/sgi-frais/presentation';
import { ChiffreAnime } from './ChiffreAnime';

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const fmtPct = (n: number) => `${n.toFixed(2).replace('.', ',')} %`;
const EASE = [0.16, 1, 0.3, 1] as const;

/** Couleur de chaque poste : la même dans la barre et dans la légende. */
const COULEUR: Record<SegmentCout['cle'], string> = {
  courtage: 'bg-accent',
  reglementaire: 'bg-accent/40',
  garde: 'bg-warn/80',
  tenue: 'bg-muted/60',
  virement: 'bg-faint/60',
};

function formatDuree(ans: number): string {
  if (ans < 1) return `${Math.round(ans * 12)} mois`;
  return ans === 1 ? '1 an' : `${ans} ans`;
}

/**
 * Carte "moins chère" — porte TOUJOURS son badge de confiance (jamais un
 * chiffre présenté comme un fait acquis sans son niveau de fiabilité), et
 * décompose son coût poste par poste : un total seul ne dit pas d'où il vient.
 */
export function CarteRecommandee({
  resultat,
  sgi,
  directory,
  montant,
  dureeAns,
  seuilPct,
}: {
  resultat: CoutSGIResult;
  sgi: SgiFrais;
  directory: Sgi | null;
  montant: number;
  dureeAns: number;
  seuilPct: number | null;
}) {
  const confiance: ConfianceNiveau = sgi.confiance;
  const decision = lienDecision(sgi);
  const lien = directory?.ficheBRVM ?? directory?.siteWeb ?? null;
  const paysNom = directory ? PAYS[directory.pays].nom : null;
  // « Non déterminé » n'apprend rien à l'investisseur : on ne l'affiche pas.
  const type = directory && directory.type !== 'Non déterminé' ? directory.type : null;
  const segments = decomposerCout(resultat);

  return (
    <div className="rounded-panel border border-up/25 bg-gradient-to-br from-up/10 to-transparent p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="mb-2 inline-block rounded-full bg-up px-2.5 py-0.5 text-xs font-bold text-bg">
            La moins chère pour votre scénario
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={resultat.sgiNom}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <p className="font-display text-xl font-semibold text-ivory md:text-2xl">{resultat.sgiNom}</p>
              {(paysNom || type) && (
                <p className="mt-0.5 text-xs text-muted">{[paysNom, type].filter(Boolean).join(' · ')}</p>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CONFIANCE_BADGE_CLASS[confiance]}`}>
              {CONFIANCE_LABEL[confiance]}
            </span>
            {decision && (
              <a href={decision} target="_blank" rel="noopener" className="text-[11px] text-accent hover:underline">
                Décision officielle (PDF) ↗
              </a>
            )}
          </div>
        </div>
        <div className="text-left sm:text-right" aria-live="polite">
          <ChiffreAnime valeur={resultat.total} format={fmt} className="tabular block font-display text-3xl font-bold text-up" />
          <p className="mt-0.5 text-xs text-muted">
            {montant > 0 ? `${fmtPct(resultat.pctCapital)} de votre capital · ${formatDuree(dureeAns)}` : ''}
          </p>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] text-muted">D&apos;où vient ce coût</p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-border/60" aria-hidden>
            {segments.map((s) => (
              <motion.span
                key={s.cle}
                className={`h-full ${COULEUR[s.cle]}`}
                initial={false}
                animate={{ width: `${s.part}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            ))}
          </div>
          <ul className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2">
            {segments.map((s) => (
              <li key={s.cle} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className={`h-2 w-2 flex-none rounded-full ${COULEUR[s.cle]}`} aria-hidden />
                  {s.label}
                </span>
                <span className="tabular whitespace-nowrap text-ivory">{fmt(s.montant)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        {seuilPct != null ? (
          <p className="text-[11px] text-muted">
            Hausse nécessaire pour couvrir un aller-retour :{' '}
            <span className="tabular font-semibold text-ivory">+{fmtPct(seuilPct)}</span>
          </p>
        ) : (
          <span />
        )}
        {lien && (
          <a
            href={lien}
            target="_blank"
            rel="nofollow noopener"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-up/40 px-4 text-xs font-semibold text-up transition-colors hover:bg-up/10 active:scale-[0.98]"
          >
            Voir la fiche <span aria-hidden>→</span>
          </a>
        )}
      </div>
    </div>
  );
}

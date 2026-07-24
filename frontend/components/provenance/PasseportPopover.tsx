'use client';

import { useState } from 'react';
import type { Passeport } from '@/lib/provenance/passport';

/**
 * Pastille « Preuves » + panneau de provenance. Gratuit pour tous : les chiffres
 * restent premium, leur preuve est ouverte.
 *
 * `non_trace` n'est PAS masqué : dire qu'on ne sait pas est une information,
 * pas un échec à cacher.
 */

const ETIQUETTE: Record<Passeport['confiance'], { texte: string; classe: string }> = {
  verifie:   { texte: 'Vérifié',   classe: 'border-up/40 bg-up/10 text-up' },
  extrait:   { texte: 'Extrait',   classe: 'border-border text-muted' },
  non_trace: { texte: 'Non tracé', classe: 'border-warn/40 bg-warn/10 text-warn' },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function PasseportPopover({ passeport, titre }: { passeport: Passeport; titre: string }) {
  const [ouvert, setOuvert] = useState(false);
  const et = ETIQUETTE[passeport.confiance];

  return (
    <span className="relative inline-block">
      <button
        type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        aria-label={`Provenance de ${titre}`}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition hover:opacity-80 ${et.classe}`}
      >
        ⓘ {et.texte}
      </button>

      {ouvert && (
        <div
          role="dialog" aria-label={`Provenance de ${titre}`}
          className="absolute z-30 mt-2 w-80 rounded-xl border border-border bg-elevated p-4 text-xs shadow-modal"
        >
          <p className="font-semibold text-white">{titre}</p>

          {passeport.document ? (
            <p className="mt-2 text-muted">
              Source :{' '}
              {passeport.document.url ? (
                <a href={passeport.document.url} target="_blank" rel="noopener noreferrer"
                   className="text-accent underline underline-offset-2">
                  {passeport.document.libelle}
                </a>
              ) : (
                <span className="text-white/80">{passeport.document.libelle}</span>
              )}
              {fmtDate(passeport.document.datePublication) && (
                <>, publié le {fmtDate(passeport.document.datePublication)}</>
              )}
            </p>
          ) : (
            <p className="mt-2 text-muted">
              Source non tracée : ces chiffres sont antérieurs à la mise en place du suivi de provenance.
            </p>
          )}

          {passeport.extraitLe && (
            <p className="mt-1.5 text-muted">
              Extrait le {fmtDate(passeport.extraitLe)}
              {passeport.extracteur === 'manuel'
                ? ' par saisie manuelle.'
                : ' par analyse automatique du document.'}
            </p>
          )}

          {passeport.conversion && (
            <p className="mt-1.5 text-warn">
              ⓘ Société publiant en {passeport.conversion.devise} — montants convertis en FCFA au taux moyen
              d’exercice de {passeport.conversion.taux.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}.
            </p>
          )}

          <button type="button" onClick={() => setOuvert(false)}
            className="mt-3 text-[10px] text-faint hover:text-white">
            Fermer
          </button>
        </div>
      )}
    </span>
  );
}

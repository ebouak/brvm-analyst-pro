'use client';

import { useEffect, useState } from 'react';

/**
 * Bouton « Mon récap en image » de /portefeuille (gratuit, spec 2026-10-24).
 * L'image est produite à la demande par /api/recap/image (session requise,
 * jamais mise en cache) ; rien n'est stocké. Partage natif du téléphone quand
 * le navigateur le permet, sinon téléchargement.
 */
type Etat = { t: 'ferme' } | { t: 'chargement' } | { t: 'pret'; url: string; fichier: File } | { t: 'erreur'; message: string };

export default function RecapBouton() {
  const [etat, setEtat] = useState<Etat>({ t: 'ferme' });

  // Libère l'image de la mémoire quand la fenêtre se ferme.
  useEffect(() => () => { if (etat.t === 'pret') URL.revokeObjectURL(etat.url); }, [etat]);

  async function ouvrir() {
    setEtat({ t: 'chargement' });
    try {
      const r = await fetch('/api/recap/image', { cache: 'no-store' });
      if (!r.ok) {
        const msg = r.status === 404
          ? 'Votre portefeuille est vide : ajoutez une position pour obtenir votre récap.'
          : 'Récap indisponible pour le moment. Réessayez dans un instant.';
        setEtat({ t: 'erreur', message: msg });
        return;
      }
      const blob = await r.blob();
      const fichier = new File([blob], `westbourse-recap-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
      setEtat({ t: 'pret', url: URL.createObjectURL(blob), fichier });
    } catch {
      setEtat({ t: 'erreur', message: 'Récap indisponible : vérifiez votre connexion.' });
    }
  }

  async function partager(fichier: File) {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [fichier] })) {
      await nav.share({ files: [fichier], title: 'Mon portefeuille WESTBOURSE' }).catch(() => {});
    }
  }

  const peutPartager =
    etat.t === 'pret' &&
    typeof navigator !== 'undefined' &&
    !!(navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare?.({ files: [etat.fichier] });

  return (
    <>
      <button
        type="button"
        onClick={() => void ouvrir()}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition-all hover:border-accent/60 hover:bg-accent/20"
      >
        Mon récap en image
      </button>

      {etat.t !== 'ferme' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Récap de mon portefeuille"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEtat({ t: 'ferme' })}
        >
          <div className="flex max-h-full w-full max-w-md flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            {etat.t === 'chargement' && <div className="h-[60vh] animate-pulse rounded-2xl border border-border bg-surface" />}
            {etat.t === 'erreur' && <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">{etat.message}</p>}
            {etat.t === 'pret' && (
              // eslint-disable-next-line @next/next/no-img-element -- image privée générée à la volée, hors optimiseur
              <img src={etat.url} alt="Récap de votre portefeuille : valeur, plus-value, séance du jour, répartition et détachements à venir" className="max-h-[75vh] w-full rounded-2xl object-contain" />
            )}
            <div className="flex flex-wrap justify-center gap-3">
              {etat.t === 'pret' && peutPartager && (
                <button type="button" onClick={() => void partager(etat.fichier)} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b]">
                  Partager
                </button>
              )}
              {etat.t === 'pret' && (
                <a href={etat.url} download={etat.fichier.name} className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-ivory">
                  Télécharger
                </a>
              )}
              <button type="button" onClick={() => setEtat({ t: 'ferme' })} className="rounded-full px-5 py-2 text-sm text-muted underline underline-offset-2">
                Fermer
              </button>
            </div>
            <p className="text-center text-[11px] text-faint">
              Image générée à la demande, conservée nulle part. Information de marché, pas un conseil en investissement.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

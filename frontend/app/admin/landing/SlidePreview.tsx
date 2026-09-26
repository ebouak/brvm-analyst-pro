'use client';

import { useEffect, useState } from 'react';

/**
 * Aperçu d'un visuel de diapositive, AVANT enregistrement.
 *
 * POURQUOI. Les deux emplacements ont des formes très différentes — bandeau
 * 1600×300 (16:3) et carrousel 900×672 (~4:3) — et le rendu rognait sans le
 * dire. Une affiche large posée dans le carrousel y perdait ses bords : en
 * production, le titre d'une annonce BGFI arrivait amputé
 * (« ...pel Public à l'Épargne »). Rien, dans le formulaire, ne permettait de
 * le voir avant publication.
 *
 * Les deux cadres sont montrés même si un seul emplacement est choisi : une
 * diapositive peut être redirigée plus tard, et connaître les deux rendus
 * coûte un coup d'œil.
 *
 * Tout est local au navigateur (`URL.createObjectURL`) : rien n'est téléversé
 * tant que le formulaire n'est pas soumis.
 */

export type Cadrage = 'cover' | 'contain';

/** Les proportions réelles des deux cadres, reprises des composants publics
 *  (`Billboard.tsx` : 1600×300 · `HeroCarousel.tsx` : 900×672). */
const CADRES = [
  { cle: 'billboard', titre: 'Bandeau', largeur: 1600, hauteur: 300 },
  { cle: 'hero', titre: 'Carrousel du hero', largeur: 900, hauteur: 672 },
] as const;

/** En deçà, l'image sera étirée par le navigateur et paraîtra floue. */
const MARGE_NETTETE = 0.75;

export function SlidePreview() {
  const [url, setUrl] = useState<string | null>(null);
  const [cadrage, setCadrage] = useState<Cadrage>('cover');
  const [dims, setDims] = useState<{ l: number; h: number } | null>(null);
  const [nom, setNom] = useState<string | null>(null);

  // Un objet URL non révoqué retient le fichier en mémoire tant que l'onglet
  // vit ; on le libère à chaque remplacement et au démontage.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function choisir(fichier: File | null) {
    setUrl((precedent) => {
      if (precedent) URL.revokeObjectURL(precedent);
      return fichier ? URL.createObjectURL(fichier) : null;
    });
    setNom(fichier?.name ?? null);
    setDims(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-muted">
          Image *
          <input
            name="image"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => choisir(e.currentTarget.files?.[0] ?? null)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
          />
        </label>
        <label className="text-xs text-muted">
          Cadrage
          {/* `cover` est le défaut historique : le changer rétroactivement
              déformerait les annonces en cours de diffusion. */}
          <select
            name="image_fit"
            value={cadrage}
            onChange={(e) => setCadrage(e.currentTarget.value as Cadrage)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
          >
            <option value="cover">Remplir le cadre (rogne les bords)</option>
            <option value="contain">Image entière (bandes autour)</option>
          </select>
        </label>
      </div>

      {!url ? (
        <p className="rounded-card border border-dashed border-border bg-bg p-4 text-xs text-faint">
          Choisissez une image : son rendu apparaîtra ici, dans les deux cadres réels, avant enregistrement.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {CADRES.map((c) => {
              const trop = dims
                ? dims.l < c.largeur * MARGE_NETTETE || dims.h < c.hauteur * MARGE_NETTETE
                : false;
              return (
                <figure key={c.cle} className="m-0">
                  <div
                    className="overflow-hidden rounded-card border border-border bg-sunken"
                    style={{ aspectRatio: `${c.largeur} / ${c.hauteur}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Aperçu du visuel dans le cadre ${c.titre.toLowerCase()}`}
                      className="h-full w-full"
                      style={{ objectFit: cadrage }}
                      onLoad={(e) => setDims({ l: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    />
                  </div>
                  <figcaption className="mt-1 text-[11px] leading-relaxed text-faint">
                    {c.titre} · {c.largeur} × {c.hauteur}
                    {trop && (
                      <span className="text-warn"> · image plus petite que le cadre, elle sera étirée</span>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <p className="text-[11px] text-faint">
            {nom}
            {dims && ` · ${dims.l} × ${dims.h} px`}
            {cadrage === 'cover' && ' · les bords hors cadre ne seront pas affichés'}
          </p>
        </div>
      )}
    </div>
  );
}

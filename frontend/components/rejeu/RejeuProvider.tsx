'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { construireRejeu, directionsEntre, type ImageSeance, type Releve } from '@/lib/realtime/rejeu';
import type { FlashDirection } from '@/lib/realtime/mergeActions';

/** Durée d'affichage d'un relevé pendant la lecture (≈ 20 s pour une séance). */
export const PAS_REJEU_MS = 650;

type Statut = 'inactif' | 'chargement' | 'pret' | 'erreur';

export interface Rejeu {
  dateMarche: string | null;
  statut: Statut;
  erreur: string | null;
  images: ImageSeance[];
  index: number;
  lecture: boolean;
  /** Vrai du lancement jusqu'à « Quitter » : les pages montrent l'image courante. */
  actif: boolean;
  image: ImageSeance | null;
  /** Sens de chaque cours qui a changé depuis l'image précédente (flash). */
  directions: Record<string, FlashDirection>;
  demarrer: () => void;
  pause: () => void;
  reprendre: () => void;
  aller: (i: number) => void;
  quitter: () => void;
}

const Ctx = createContext<Rejeu | null>(null);

/** Rejeu en cours sur la page, ou null hors d'un RejeuProvider. */
export const useRejeu = () => useContext(Ctx);

/**
 * Rejeu d'une séance à partir des VRAIS relevés (brvm_intraday_snapshots,
 * lecture publique). Les relevés ne sont chargés qu'au premier clic : aucune
 * requête pour qui ne s'en sert pas. Tout composant qui lit les cours par
 * `useCoursSeance` à l'intérieur de ce fournisseur rejoue automatiquement.
 */
export function RejeuProvider({ dateMarche, codes, children }: {
  dateMarche: string | null;
  /** Limite le chargement à ces valeurs (sinon toute la cote). */
  codes?: string[];
  children: ReactNode;
}) {
  const [statut, setStatut] = useState<Statut>('inactif');
  const [erreur, setErreur] = useState<string | null>(null);
  const [images, setImages] = useState<ImageSeance[]>([]);
  const [index, setIndex] = useState(0);
  const [lecture, setLecture] = useState(false);
  const [actif, setActif] = useState(false);

  const demarrer = useCallback(async () => {
    if (!dateMarche) return;
    if (images.length >= 2) {
      setIndex(0); setActif(true); setLecture(true);
      return;
    }
    setStatut('chargement');
    setErreur(null);
    try {
      const sb = createClient();
      // Plus de 1 000 lignes par séance (48 valeurs × ~30 relevés) : PostgREST
      // tronque en silence au-delà, d'où la pagination obligatoire.
      const lignes = await fetchAllRows<Releve>((from, to) => {
        let q = sb
          .from('brvm_intraday_snapshots')
          .select('code, captured_at, close, volume')
          .eq('date_marche', dateMarche)
          .order('captured_at', { ascending: true })
          .order('id', { ascending: true });
        if (codes && codes.length > 0) q = q.in('code', codes);
        return q.range(from, to);
      });
      const imgs = construireRejeu(lignes);
      if (imgs.length < 2) {
        setStatut('erreur');
        setErreur('Pas assez de relevés pour rejouer cette séance.');
        return;
      }
      setImages(imgs);
      setStatut('pret');
      setIndex(0); setActif(true); setLecture(true);
    } catch {
      setStatut('erreur');
      setErreur('Les relevés de la séance n’ont pas pu être chargés. Réessayez dans un instant.');
    }
  }, [dateMarche, codes, images.length]);

  // Avance d'un relevé à chaque pas, jusqu'au dernier.
  useEffect(() => {
    if (!lecture || images.length < 2) return;
    const t = setInterval(() => setIndex((i) => Math.min(i + 1, images.length - 1)), PAS_REJEU_MS);
    return () => clearInterval(t);
  }, [lecture, images.length]);
  useEffect(() => {
    if (lecture && index >= images.length - 1) setLecture(false);
  }, [lecture, index, images.length]);

  const pause = useCallback(() => setLecture(false), []);
  const reprendre = useCallback(() => {
    setIndex((i) => (i >= images.length - 1 ? 0 : i));
    setLecture(true);
  }, [images.length]);
  const aller = useCallback((i: number) => {
    setLecture(false);
    setIndex(Math.max(0, Math.min(i, images.length - 1)));
  }, [images.length]);
  const quitter = useCallback(() => {
    setLecture(false); setActif(false); setIndex(0);
  }, []);

  const image = actif ? images[index] ?? null : null;
  const precedente = actif && index > 0 ? images[index - 1] ?? null : null;
  const directions = useMemo(() => (image ? directionsEntre(precedente, image) : {}), [image, precedente]);

  const valeur = useMemo<Rejeu>(() => ({
    dateMarche, statut, erreur, images, index, lecture, actif, image, directions,
    demarrer, pause, reprendre, aller, quitter,
  }), [dateMarche, statut, erreur, images, index, lecture, actif, image, directions, demarrer, pause, reprendre, aller, quitter]);

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

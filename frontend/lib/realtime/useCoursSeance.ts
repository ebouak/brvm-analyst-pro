'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { estEnSeance } from '@/lib/freshness';
import { useRealtimeActions } from './useRealtimeActions';
import { recomposer, estEnDirect, valeursChangees } from './recomposer';
import { lignesAuMoment, veillesDe } from './rejeu';
import { dernierReleveDe, echangesDuMarche, largeurDuMarche } from './releve';
import { publierReleve } from './useReleve';
import { useRejeu } from '@/components/rejeu/RejeuProvider';
import type { FlashDirection, RealtimeActionRow } from './mergeActions';

/**
 * Cours en direct pour les pages de l'application (hors landing).
 *
 * - N'écoute QUE pendant la séance (`estEnSeance`), et sur la date du JOUR,
 *   pas sur celle rendue par le serveur : avant le premier relevé (9 h 00 →
 *   ~9 h 15), un onglet ouvert depuis la veille ou un jour férié, la page
 *   montre la séance précédente — écouter cette date-là ne recevrait jamais
 *   rien (revue Fable du 2026-11-22).
 * - `enDirect` n'est vrai que si les cours affichés sont ceux du jour, ou dès
 *   qu'un cours du jour est réellement arrivé (`estEnDirect`).
 * - Ne touche jamais aux champs serveur des lignes (voir `recomposer`).
 * - Sans `dateMarche` (page statique, /apercu), aucun abonnement.
 * - Dans un RejeuProvider en cours de lecture, les lignes sont celles du
 *   relevé rejoué (`lignesAuMoment`). `enRejeu` le signale ; `enDirect` est
 *   alors faux.
 *
 * `base` doit être une référence stable (useMemo côté appelant), sinon
 * `useRealtimeActions` se resynchronise à chaque rendu.
 */
export function useCoursSeance<T extends RealtimeActionRow & { cours_precedent?: number | null }>(
  base: T[],
  dateMarche: string | null,
): {
  rows: T[];
  flashes: Record<string, FlashDirection>;
  /** Vrai pendant la séance, quand les cours affichés sont ceux du jour (et hors rejeu). */
  enDirect: boolean;
  /** Vrai pendant un rejeu de séance. */
  enRejeu: boolean;
  /** Instant du dernier cours réellement reçu (ou du relevé rejoué). */
  derniereMaj: Date | null;
} {
  // Faux / nul au premier rendu (serveur compris) : pas d'écart d'hydratation.
  const [enSeance, setEnSeance] = useState(false);
  const [jour, setJour] = useState<string | null>(null);
  useEffect(() => {
    const maj = () => {
      const maintenant = new Date();
      setEnSeance(estEnSeance(maintenant));
      setJour(maintenant.toISOString().slice(0, 10));
    };
    maj();
    const t = setInterval(maj, 60_000);
    return () => clearInterval(t);
  }, []);

  const ecoute = enSeance && dateMarche != null ? jour : null;
  const { rows: recus, flashes } = useRealtimeActions(base, ecoute);
  const rows = useMemo(() => recomposer(base, recus), [base, recus]);

  // Seul un VRAI changement de valeur compte comme mise à jour : une relecture
  // identique (retour d'onglet) ou vide (avant le premier relevé) ne date rien.
  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
  const affichees = useRef(rows);
  useEffect(() => {
    if (valeursChangees(affichees.current, rows)) setDerniereMaj(new Date());
    affichees.current = rows;
  }, [rows]);

  const enDirect = estEnDirect({ enSeance, dateMarche, jour, majRecue: derniereMaj != null });

  // Rejeu de séance : l'image courante remplace les cours, rien d'autre.
  const rejeu = useRejeu();

  // Heure du dernier RELEVÉ et état des échanges du marché, partagés avec la
  // pastille de fraîcheur et « En direct » (useReleve). Un relevé sans
  // changement de cours reste un relevé : on lit `updated_at`, posé à chaque
  // collecte. Jamais pendant un rejeu, jamais hors séance.
  const releveIso = useMemo(
    () => dernierReleveDe(recus as unknown as { updated_at?: string | null }[])?.toISOString() ?? null,
    [recus],
  );
  const echanges = useMemo(() => echangesDuMarche(rows), [rows]);
  const largeur = useMemo(() => largeurDuMarche(rows), [rows]);
  const rejeuActif = !!rejeu?.actif;
  useEffect(() => {
    if (rejeuActif || !enSeance || jour == null) return;
    // Un relevé d'un autre jour (lignes de la veille avant le premier relevé) ne dit rien d'aujourd'hui.
    const r = releveIso && releveIso.slice(0, 10) === jour ? new Date(releveIso) : null;
    publierReleve(r, r ? echanges : null, r ? largeur : null);
  }, [releveIso, echanges, largeur, rejeuActif, enSeance, jour]);
  const veilles = useMemo(() => veillesDe(base), [base]);
  const image = rejeu?.actif ? rejeu.image : null;
  const rowsRejeu = useMemo(() => (image ? lignesAuMoment(base, image, veilles) : null), [image, base, veilles]);

  if (rowsRejeu && image && rejeu) {
    return { rows: rowsRejeu, flashes: rejeu.directions, enDirect: false, enRejeu: true, derniereMaj: new Date(image.t) };
  }
  return { rows, flashes, enDirect, enRejeu: false, derniereMaj };
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { estEnSeance } from '@/lib/freshness';
import { createClient } from '@/lib/supabase/client';
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

  // Cours FRAIS au montage, pendant la séance : le rendu serveur peut venir
  // d'un cache (tableau de bord : unstable_cache 60 s, servi périmé à la
  // première visite). Sans cette relecture, le bandeau a affiché le Composite
  // et la largeur du relevé de 13:30 à côté de « Relevé de 13:45 » (constaté
  // le 2026-11-23). Pas d'éclair : un rattrapage n'est pas un mouvement.
  const [frais, setFrais] = useState<(RealtimeActionRow & { updated_at?: string | null })[] | null>(null);
  const nbBase = base.length;
  const codesBase = useRef(base.map((b) => b.code));
  useEffect(() => { codesBase.current = base.map((b) => b.code); }, [base]);
  useEffect(() => {
    if (!ecoute) return;
    let annule = false;
    void (async () => {
      let q = createClient()
        .from('brvm_actions_daily')
        .select('code, cours_jour, variation_pct, volume, valeur_echangee, nb_transactions, updated_at')
        .eq('date_marche', ecoute);
      // Une fiche ou un portefeuille : leurs seuls codes ; la cote : tout le jour.
      if (nbBase > 0 && nbBase < 20) q = q.in('code', codesBase.current);
      const { data } = await q;
      if (!annule && data && data.length > 0) setFrais(data as (RealtimeActionRow & { updated_at?: string | null })[]);
    })();
    return () => { annule = true; };
  }, [ecoute, nbBase]);
  const baseEffective = useMemo(() => (frais ? recomposer(base, frais) : base), [base, frais]);

  const { rows: recus, flashes } = useRealtimeActions(baseEffective, ecoute);
  const rows = useMemo(() => recomposer(baseEffective, recus), [baseEffective, recus]);

  // Seul un VRAI changement de valeur compte comme mise à jour : une relecture
  // identique (retour d'onglet) ou vide (avant le premier relevé) ne date rien,
  // pas plus que le rattrapage des cours frais au montage.
  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
  const affichees = useRef(rows);
  const baseVue = useRef(baseEffective);
  useEffect(() => {
    const rattrapage = baseVue.current !== baseEffective;
    baseVue.current = baseEffective;
    if (!rattrapage && valeursChangees(affichees.current, rows)) setDerniereMaj(new Date());
    affichees.current = rows;
  }, [rows, baseEffective]);

  const enDirect = estEnDirect({ enSeance, dateMarche, jour, majRecue: derniereMaj != null });

  // Rejeu de séance : l'image courante remplace les cours, rien d'autre.
  const rejeu = useRejeu();

  // Heure du dernier RELEVÉ et état des échanges du marché, partagés avec la
  // pastille de fraîcheur et « En direct » (useReleve). Un relevé sans
  // changement de cours reste un relevé : on lit `updated_at`, posé à chaque
  // collecte. Jamais pendant un rejeu, jamais hors séance.
  const releveIso = useMemo(
    () => dernierReleveDe([
      ...(recus as unknown as { updated_at?: string | null }[]),
      ...(frais ?? []),
    ])?.toISOString() ?? null,
    [recus, frais],
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

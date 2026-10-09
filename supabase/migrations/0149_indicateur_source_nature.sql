-- 0149 — Nature de la source d'une observation prudentielle.
--
-- La règle de sélection (scraper/src/prudentiel/selection.ts) choisit la
-- valeur affichée sur le site d'après le statut, le périmètre, le comparateur
-- et le motif. Rien n'y distinguait un document de la banque d'un article de
-- presse : importer tel quel le recoupement RichBourse/Sika du 2026-10-08
-- aurait fait de NSIA « 13,15 % » (chiffre rapporté par Sika, absent du
-- communiqué officiel) la solvabilité 2025 affichée sur la fiche de NSBC.
--
--   emetteur          document lu chez la banque elle-même
--   reprise_emetteur  document de la banque relayé par une plateforme
--                     (rapport d'activité SAFCA ou SGBC hébergé par RichBourse)
--   secondaire        article ou analyse (presse, plateforme) : corroboration
--                     ou piste, JAMAIS valeur retenue
--
-- Les 67 observations présentes au 2026-10-09 viennent toutes des sites des
-- émetteurs (bank-of-africa.net, institutionnel.societegenerale.ci, sib.ci,
-- burkina.coris.bank, orabank.net, biic-bank.com) : le défaut « emetteur »
-- est exact pour l'existant.
--
-- Non destructive : ajout de colonnes seulement. Données de marché, aucune
-- donnée personnelle. Les policies de 0147 (lecture publique, écriture
-- service_role) couvrent les nouvelles colonnes.

alter table public.indicateur_source
  add column if not exists nature_source text not null default 'emetteur'
    check (nature_source in ('emetteur', 'reprise_emetteur', 'secondaire')),
  add column if not exists source_relais text,
  add column if not exists provisoire boolean not null default false;

comment on column public.indicateur_source.nature_source is
  'emetteur = document de la banque ; reprise_emetteur = document de la banque relayé par une plateforme ; secondaire = article ou analyse. Seuls les deux premiers peuvent devenir la valeur retenue.';
comment on column public.indicateur_source.source_relais is
  'Plateforme qui relaie le document (richbourse, sikafinance) ; NULL pour un document lu chez l''émetteur.';
comment on column public.indicateur_source.provisoire is
  'Chiffre déclaré provisoire par l''émetteur (ex. « sous réserve de la fin de la mission des commissaires aux comptes »).';

-- PostgREST doit voir les nouvelles colonnes sans attendre.
notify pgrst, 'reload schema';

-- 0189 — Barèmes SGI par tranche de montant (2026-11-04)
--
-- Le calculateur appliquait la borne haute d'un barème même quand la décision
-- fixe le taux selon le montant, montant que l'utilisateur saisit : IFI
-- facture 0,2 % sous 100 M FCFA par ordre, elle était comptée à 0,75 %.
-- La borne haute reste la règle quand le taux est réellement inconnu.
--
-- Forme : [{"jusqua": <FCFA ou null pour la dernière tranche>, "pct": <taux>}],
-- `pct` s'applique au montant entier de la tranche (pas un barème marginal).
-- Garde : même période que `droits_garde_frequence`. Tranches reprises des
-- notes déjà relevées dans les décisions homologuées.

begin;

alter table public.sgi_frais
  add column if not exists courtage_paliers jsonb,
  add column if not exists garde_paliers jsonb;

alter table public.sgi_frais drop constraint if exists sgi_frais_paliers_forme;
alter table public.sgi_frais add constraint sgi_frais_paliers_forme check (
  (courtage_paliers is null or jsonb_typeof(courtage_paliers) = 'array')
  and (garde_paliers is null or jsonb_typeof(garde_paliers) = 'array')
);

comment on column public.sgi_frais.courtage_paliers is
  'Courtage par tranche du montant de l''ordre : [{jusqua, pct}], jusqua null = dernière tranche. Absent : min/max.';
comment on column public.sgi_frais.garde_paliers is
  'Garde par tranche de la valeur du portefeuille, période = droits_garde_frequence. Absent : min/max.';

-- Courtage — IFI (PAMF-UMOA/2024/346)
update public.sgi_frais set
  courtage_paliers = '[{"jusqua":100000000,"pct":0.2},{"jusqua":500000000,"pct":0.75},{"jusqua":null,"pct":0.5}]',
  notes = replace(notes, '(palier non modélisé : borne haute retenue)', '(paliers modélisés, migration 0189)'),
  updated_at = now()
where sgi_nom = 'Images Finances Internationales';

-- Garde annuelle — BOA (PAMF-UMOA/2024/011)
update public.sgi_frais set
  garde_paliers = '[{"jusqua":10000000,"pct":0.27},{"jusqua":null,"pct":0.22}]',
  tenue_compte_montant = 0, tenue_compte_frequence = 'annuel',
  notes = notes || ' Aucune ligne de tenue de compte dans la décision (0 retenu, vérifié le 2026-11-04).',
  updated_at = now()
where sgi_nom = 'BOA Capital Securities';

-- Garde annuelle — Hudson & Cie (PAMF-UMOA/2023/002)
update public.sgi_frais set
  garde_paliers = '[{"jusqua":500000000,"pct":0.33},{"jusqua":1000000000,"pct":0.27},{"jusqua":null,"pct":0.24}]',
  updated_at = now()
where sgi_nom = 'Hudson & Cie';

-- Garde trimestrielle — Société Générale Capital Securities WA (PAMF-UMOA/2023/112)
update public.sgi_frais set
  garde_paliers = '[{"jusqua":10000000,"pct":0.125},{"jusqua":null,"pct":0.065}]',
  updated_at = now()
where sgi_nom = 'Société Générale Capital Securities West Africa';

-- Garde annuelle — AfricaBourse (PCR/SG/DA/2021/158)
update public.sgi_frais set
  garde_paliers = '[{"jusqua":10000000,"pct":0.35},{"jusqua":100000000,"pct":0.30},{"jusqua":null,"pct":0.25}]',
  updated_at = now()
where sgi_nom = 'AfricaBourse';

-- Garde trimestrielle — BSIC Capital (PAMF-UMOA/2024/163) ; le palier « titres
-- non cotés » ne concerne pas un portefeuille d'actions cotées.
update public.sgi_frais set
  garde_paliers = '[{"jusqua":10000000,"pct":0.125},{"jusqua":null,"pct":0.08}]',
  updated_at = now()
where sgi_nom = 'BSIC Capital SA';

-- Garde annuelle — MAC African (PAMF-UMOA/2024/210)
update public.sgi_frais set
  garde_paliers = '[{"jusqua":3000000000,"pct":0.5},{"jusqua":10000000000,"pct":0.35},{"jusqua":null,"pct":0.25}]',
  updated_at = now()
where sgi_nom = 'MAC African SGI';

-- GEK Capital (PAMF-UMOA/2025/036) : la décision ne prévoit aucune tenue de compte.
update public.sgi_frais set
  tenue_compte_montant = 0, tenue_compte_frequence = 'annuel',
  notes = notes || ' Aucune ligne de tenue de compte dans la décision (0 retenu, vérifié le 2026-11-04).',
  updated_at = now()
where sgi_nom = 'GEK Capital';

commit;

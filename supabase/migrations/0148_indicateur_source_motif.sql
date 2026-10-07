-- 0148 — Motif de rapprochement et précision publiée des observations.
--
-- `statut` dit SI une valeur est utilisable ; `motif` dit POURQUOI. Une
-- contradiction entre documents (source_conflict) n'est pas le même problème
-- qu'un tableau illisible ou qu'une valeur estimée.
--
-- `texte_original` garde la valeur telle qu'imprimée (« 16 % », « 16,0 % » et
-- « 16,00 % » ne portent pas la même précision) ; `decimales` en est déduite et
-- sert à comparer deux observations à la précision la MOINS fine des deux.

alter table public.indicateur_source
  add column if not exists texte_original text,
  add column if not exists decimales smallint check (decimales between 0 and 6),
  add column if not exists motif text check (motif in (
    'rounding_compatible',      -- concorde avec une autre observation, à l'arrondi près
    'source_conflict',          -- contradiction entre observations précises
    'estime',                   -- valeur publiée comme estimation
    'approximation',            -- « environ », « aux alentours de »
    'illisible',                -- tableau non lisible ou colonnes non attribuables
    'definition_incompatible',  -- définition ou dénominateur différent
    'controle_en_cours'         -- observation conservée, contrôle documentaire ouvert
  ));

comment on column public.indicateur_source.motif is
  'Pourquoi une observation est retenue avec réserve ou écartée. source_conflict = deux valeurs précises incompatibles même à l''arrondi ; rounding_compatible = concorde à la précision la moins fine.';
comment on column public.indicateur_source.texte_original is
  'Valeur telle qu''imprimée dans le document, avant toute conversion.';

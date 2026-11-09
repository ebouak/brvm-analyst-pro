-- 0202 — Profil des sociétés : historique daté et identité.
-- Historique : texte réécrit à partir de faits datés (création, rachats, fusions),
-- sans chiffre financier ancien ni classement. Identité : raison sociale, ISIN,
-- date d'introduction, capital (retenu seulement si le nominal déduit de notre
-- nombre d'actions est entier et plausible), siège sans courriel ni téléphone,
-- fractionnements. Aucune donnée personnelle ajoutée.
alter table public.societes_profils
  add column if not exists historique text,
  add column if not exists identite jsonb;

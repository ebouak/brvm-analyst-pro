-- ============================================================================
-- 0067_realtime_replica_identity.sql
-- Correctif temps réel (0066) : le filtre Realtime `date_marche=eq.<jour>` ne
-- fonctionnait PAS sur les UPDATE. La PK de ces tables est un `id` surrogate,
-- donc le replica identity par défaut ne contient que `id` — Supabase Realtime
-- ne peut alors pas évaluer un filtre sur `date_marche` pour un UPDATE, et
-- n'émet aucun événement. Or le cron fait des UPSERT : après le 1er INSERT
-- d'une séance, tous les rafraîchissements 15 min sont des UPDATE → filtrés →
-- aucun flash côté client.
--
-- REPLICA IDENTITY FULL met la ligne complète (toutes colonnes) dans le WAL,
-- ce qui permet à Realtime de matcher le filtre sur n'importe quelle colonne.
-- Surcoût WAL négligeable ici (tables à faible volume d'écriture : ~50 lignes
-- par séance, écrites toutes les 15 min).
-- ============================================================================

alter table public.brvm_actions_daily replica identity full;
alter table public.brvm_indices_daily replica identity full;

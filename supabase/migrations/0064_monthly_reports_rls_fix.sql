-- ============================================================================
-- 0064_monthly_reports_rls_fix.sql
-- Correctif sécurité (audit 2026-07-02) : les policies INSERT/UPDATE de
-- monthly_reports étaient ouvertes au rôle public (with_check=true) — donc
-- n'importe qui muni de la clé anon (publique par nature, présente dans le
-- bundle JS) pouvait injecter ou modifier le contenu des rapports mensuels
-- affichés en premium.
--
-- Le seul chemin d'écriture légitime est le scraper (runMonthlyReports) en
-- service_role, qui BYPASS la RLS : ces policies ne servaient à rien sauf à
-- offrir une surface d'attaque. On les supprime ; la lecture publique/premium
-- existante n'est pas touchée.
-- ============================================================================

drop policy if exists "Backend can insert monthly_reports" on public.monthly_reports;
drop policy if exists "Backend can update monthly_reports" on public.monthly_reports;

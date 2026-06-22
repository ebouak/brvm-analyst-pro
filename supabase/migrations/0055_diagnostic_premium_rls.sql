-- ============================================================================
-- 0055_diagnostic_premium_rls.sql — Corrige une FUITE de contenu premium.
-- diagnostic_reports (rapports IA sell-side) était en lecture PUBLIQUE
-- (using true) → n'importe qui avec la clé anon, et la page publique
-- /societes/[code], pouvaient lire le markdown complet réservé aux abonnés.
-- On réserve désormais la lecture aux utilisateurs PREMIUM (+ service_role).
-- ============================================================================

-- Retire la lecture publique.
drop policy if exists "lecture publique diagnostic_reports" on public.diagnostic_reports;

-- Lecture réservée aux abonnés premium (et au service_role côté serveur).
drop policy if exists "lecture premium diagnostic_reports" on public.diagnostic_reports;
create policy "lecture premium diagnostic_reports"
  on public.diagnostic_reports for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_premium = true
    )
  );

-- (La policy d'écriture service_role existante est conservée.)

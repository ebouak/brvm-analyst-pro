-- ══════════════════════════════════════════════════════════════════════════════
-- 0271_academy_relances.sql
-- Lot #6 — Journal d'envoi des relances de progression Academy (J+5)
-- Accès strictement serveur (service_role) : anti-doublon et cooldown 14 jours.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.academy_reminder_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_slug       text NOT NULL,
  next_lesson_idx   integer NOT NULL CHECK (next_lesson_idx >= 0),
  remaining_lessons integer NOT NULL CHECK (remaining_lessons >= 1),
  mode              text NOT NULL CHECK (mode IN ('simulation', 'actif')),
  statut            text NOT NULL CHECK (statut IN ('simulation', 'envoye', 'echec')),
  resend_id         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_reminder_logs_user_date
  ON public.academy_reminder_logs (user_id, created_at DESC);

ALTER TABLE public.academy_reminder_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.academy_reminder_logs FROM public, anon, authenticated;

COMMIT;

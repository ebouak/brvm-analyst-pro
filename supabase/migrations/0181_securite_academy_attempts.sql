-- Audit sécurité (Cloudflare) : « Users can insert a forged passed exam attempt ».
--
-- La policy « exam_attempts owner insert » (0112) laissait tout compte connecté
-- écrire une ligne { passed: true } dans academy_exam_attempts via PostgREST, puis
-- appeler /api/academy/certificate pour obtenir un certificat public sans avoir
-- passé l'examen. Un passage ne doit naître que de la correction serveur.
--
-- Correctif : plus aucune écriture authenticated/anon. La route
-- /api/academy/exam/[niveau]/submit insère désormais via service_role (user_id
-- pris dans la session) ; la lecture owner (select) est conservée.
-- Idempotent.

drop policy if exists "exam_attempts owner insert" on public.academy_exam_attempts;
revoke insert, update, delete on public.academy_exam_attempts from public, anon, authenticated;

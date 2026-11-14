-- 0226 — Instruments plus négociables passés en inactifs (2026-11-14).
--
-- 1. SVOC (MOVIS CI) : dernière cotation le 2019-05-10 à 2 395 FCFA. Absente de
--    la cote de brvm.org ; Sika Finance n'a aucune donnée après 2019 (sa
--    « valorisation » de 2 001 MFCFA = 835 625 titres × 2 395 FCFA, le cours de
--    2019). Elle restait dans la carte de chaleur, la valorisation et les
--    secteurs avec un cours vieux de sept ans. Sa fiche reste consultable.
--    NB : SEMC n'est PAS concernée — suspendue (« SP » au Bulletin officiel),
--    pas radiée ; sa fiche l'affiche déjà.
--
-- 2. Obligations échues : maturité (max de brvm_obligations_daily) strictement
--    passée — 55 titres au 2026-11-14, échus entre 2016 et 2025. brvm.org les
--    liste encore (dernier coupon 2015-2018) ; le collecteur les ignore
--    désormais (exclureEchues). Une maturité inconnue n'est pas touchée.
--
-- Réversible (actif = true). Aucune donnée personnelle.

update public.brvm_instruments
   set actif = false, updated_at = now()
 where code = 'SVOC' and type = 'action' and actif;

update public.brvm_instruments i
   set actif = false, updated_at = now()
  from (select code, max(maturite) as mat
          from public.brvm_obligations_daily
         group by code) d
 where d.code = i.code
   and i.type = 'obligation'
   and i.actif
   and d.mat is not null
   and d.mat < current_date;

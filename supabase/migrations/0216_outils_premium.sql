-- 0216 — Six outils réservés au plan Premium (demande de l'exploitant, 2026-11-13).
--
-- Screener (et son onglet intraday), Scanner technique, Signaux, Saisonnalité,
-- Combined Alpha, Backtest. Le niveau vit en base et reste réglable dans
-- /admin/features : cette migration ne fait que poser la valeur demandée.
--
-- Effets à connaître :
--   * `signaux` garde aussi le signal affiché sur la fiche action (même drapeau) ;
--   * Saisonnalité garde son aperçu gratuit (un titre, le mois en cours) ;
--   * Scanner technique et Combined Alpha n'avaient AUCUN verrou : deux codes
--     nouveaux, lus par leurs pages.
-- Aucune donnée personnelle. RLS de feature_flags inchangée (0091).

update public.feature_flags
   set acces = 'premium', updated_at = now()
 where code in ('screener', 'screener_intraday', 'signaux', 'saisonnalite', 'backtest')
   and acces = 'free';

insert into public.feature_flags (code, label, acces, description) values
  ('scanner_technique', 'Scanner technique', 'premium', 'Page /scanner : filtres RSI, MACD, moyennes mobiles.'),
  ('combined_alpha', 'Combined Alpha', 'premium', 'Page /analyse/combined-alpha : classement quantitatif.')
on conflict (code) do nothing;

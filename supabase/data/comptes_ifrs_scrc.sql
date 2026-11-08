-- Comptes IFRS de SUCRIVOIRE (SCRC), exercices 2025 et 2024.
--
-- Source : « Etats financiers - Exercice 2025 - SUCRIVOIRE CI (Annule et
-- remplace le précédent) », BDFIN, 18/05/2026 — c'est la version IFRS
-- corrigée de celle du 30/04/2026 (reclassement entre emprunt long terme et
-- court terme, sans effet sur le total ni sur le résultat).
-- Le PDF est en MILLIERS de FCFA : chaque montant est multiplié par 1 000.
--
-- Lignes du PDF (pdftotext -table), 2025 | 2024, en milliers :
--   Chiffre d'affaires                       80 568 589 | 87 219 127
--   Résultat net                            - 7 953 932 |  2 473 760
--   Capitaux propres                         17 243 172 | 24 984 680
--   Total actif                             156 426 278 | 133 450 356
--   Emprunt long terme                       39 360 457 | 24 112 181
--   Passifs locatifs                          6 561 160 |  5 527 844
--   Concours bancaires                       11 018 292 | 15 409 329
--   Emprunt part court terme                 27 798 090 |  6 196 370
--   Passif de location à court terme            135 089 |    500 424
--   => dette financière                      84 873 088 | 51 746 148
--
-- Parts du groupe : NULL. Comptes sociaux, sans intérêts minoritaires : le PDF
-- ne présente aucune « part du groupe », on ne la recopie pas.
--
-- Sika Finance (https://www.sikafinance.com/marches/societe/SCRC.ci, consulté
-- le 2026-11-08, millions de FCFA) publie le référentiel SYSCOHADA :
--   2025 : CA 80 569, RN -6 132 ; 2024 : CA 87 219, RN 2 591.
-- Le CA est commun aux deux référentiels (comparable) ; le résultat net ne
-- l'est pas. Écart = IFRS − Sika, en FCFA.

insert into public.comptes_ifrs (
  code, exercice, chiffre_affaires, resultat_net, resultat_net_part_groupe,
  capitaux_propres, capitaux_propres_part_groupe, total_actif, dette_financiere,
  source_url, source_titre, verifie_le, comparaison_sika
) values
(
  'SCRC', 2025, 80568589000, -7953932000, null,
  17243172000, null, 156426278000, 84873088000,
  'https://bfin.brvm.org/0/Communiques_emetteurs/20260518%20-%20Etats%20financiers%20-%20Exercice%202025%20-%20SUCRIVOIRE%20CI%20(Annule%20et%20remplace%20le%20pr%C3%A9c%C3%A9dent).pdf',
  'Etats financiers IFRS - Exercice 2025 - SUCRIVOIRE CI (Annule et remplace le précédent), 18/05/2026',
  '2026-11-08',
  '{
    "source_url": "https://www.sikafinance.com/marches/societe/SCRC.ci",
    "consulte_le": "2026-11-08",
    "referentiel_sika": "SYSCOHADA",
    "unite_sika": "millions de FCFA",
    "note": "Sika Finance publie les comptes SYSCOHADA : le chiffre d''affaires est comparable, le résultat net ne l''est pas.",
    "postes": [
      {"poste": "chiffre_affaires", "sika": 80569000000, "ifrs": 80568589000, "ecart": -411000, "comparable": true},
      {"poste": "resultat_net", "sika": -6132000000, "ifrs": -7953932000, "ecart": -1821932000, "comparable": false}
    ]
  }'::jsonb
),
(
  'SCRC', 2024, 87219127000, 2473760000, null,
  24984680000, null, 133450356000, 51746148000,
  'https://bfin.brvm.org/0/Communiques_emetteurs/20260518%20-%20Etats%20financiers%20-%20Exercice%202025%20-%20SUCRIVOIRE%20CI%20(Annule%20et%20remplace%20le%20pr%C3%A9c%C3%A9dent).pdf',
  'Etats financiers IFRS - Exercice 2025 - SUCRIVOIRE CI (Annule et remplace le précédent), 18/05/2026 — colonne 31-déc-24',
  '2026-11-08',
  '{
    "source_url": "https://www.sikafinance.com/marches/societe/SCRC.ci",
    "consulte_le": "2026-11-08",
    "referentiel_sika": "SYSCOHADA",
    "unite_sika": "millions de FCFA",
    "note": "Sika Finance publie les comptes SYSCOHADA : le chiffre d''affaires est comparable, le résultat net ne l''est pas.",
    "postes": [
      {"poste": "chiffre_affaires", "sika": 87219000000, "ifrs": 87219127000, "ecart": 127000, "comparable": true},
      {"poste": "resultat_net", "sika": 2591000000, "ifrs": 2473760000, "ecart": -117240000, "comparable": false}
    ]
  }'::jsonb
)
on conflict (code, exercice) do update set
  chiffre_affaires = excluded.chiffre_affaires,
  resultat_net = excluded.resultat_net,
  resultat_net_part_groupe = excluded.resultat_net_part_groupe,
  capitaux_propres = excluded.capitaux_propres,
  capitaux_propres_part_groupe = excluded.capitaux_propres_part_groupe,
  total_actif = excluded.total_actif,
  dette_financiere = excluded.dette_financiere,
  source_url = excluded.source_url,
  source_titre = excluded.source_titre,
  verifie_le = excluded.verifie_le,
  comparaison_sika = excluded.comparaison_sika;

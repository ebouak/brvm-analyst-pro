-- 0106 — Contenu initial de la 1re page citable : rendement du dividende.
--
-- Page de type 'data' : le TABLEAU est généré en direct (dividend_yield) ; ce qui
-- suit est le CALQUE ÉDITABLE (réponse, intro, méthode, sources, FAQ) posé
-- par-dessus. Modifiable ensuite depuis l'admin.
--
-- `on conflict do nothing` : ne réécrit pas un contenu déjà édité par un admin.

insert into public.citable_pages
  (slug, kind, data_source, title, question, short_answer,
   intro_md, methodology_md, sources, faq,
   author, author_role, published, published_at)
values (
  'rendement-dividende',
  'data',
  'dividend_yield',
  'Actions BRVM à fort rendement du dividende',
  'Quelles actions de la BRVM offrent le meilleur rendement du dividende ?',
  'Les actions BRVM au meilleur rendement du dividende sont majoritairement des valeurs bancaires (groupe Bank of Africa) et SONATEL, avec des rendements bruts compris entre 5 % et 7 % sur le dernier exercice confirmé. Le classement ci-dessous est recalculé au dernier cours de clôture ; le rendement effectif dépend des décisions d''assemblée générale et de l''évolution du cours.',
  E'Le **rendement du dividende** mesure le revenu qu''une action verse chaque année, rapporté à son prix. C''est l''indicateur clé pour un investisseur qui cherche un **revenu régulier** plutôt qu''une plus-value.\n\nSur la BRVM, il est particulièrement élevé — souvent 5 à 8 % — ce qui en fait un marché attractif pour les stratégies de rendement. Le tableau ci-dessous classe les actions par rendement brut décroissant, à partir du **dernier dividende d''exercice confirmé** et du **dernier cours de clôture**.',
  E'**Rendement brut = dividende brut par action de l''exercice le plus récent confirmé ÷ dernier cours de clôture.**\n\n- Seuls les dividendes d''**exercice identifié** sont retenus : un dividende annoncé mais non rattaché à un exercice est écarté (on ne mélange pas annoncé et versé).\n- Le rendement est **brut**, avant l''impôt IRVM, qui varie de 3 % à 12,5 % selon le pays de l''investisseur (voir notre calculateur fiscal).\n- Une action dont le cours ou le dividende manque est **exclue** du classement — jamais un rendement estimé.\n- Le classement est **recalculé à chaque séance** : la date des cours utilisés est indiquée sous le tableau.',
  '[
    {"label": "BRVM — cours officiels des actions", "url": "https://www.brvm.org/fr/cours-actions/0"},
    {"label": "Communiqués de mise en paiement des dividendes (émetteurs, via BRVM)", "url": "https://www.brvm.org/fr/actualites"},
    {"label": "WESTBOURSE — calculateur fiscal IRVM par pays", "url": "https://www.westbourse.com/fiscalite"}
  ]'::jsonb,
  '[
    {"q": "Le rendement affiché est-il net d''impôt ?", "a": "Non, il est brut. L''impôt sur les dividendes d''actions cotées (IRVM) va de 3 % au Togo à 12,5 % au Burkina Faso. Utilisez notre calculateur fiscal pour obtenir le net selon votre pays."},
    {"q": "Un rendement élevé est-il toujours une bonne affaire ?", "a": "Pas nécessairement. Un rendement élevé peut venir d''un cours qui a chuté, ou d''un dividende exceptionnel non reconductible. Croisez toujours le rendement avec la solidité des fondamentaux et la régularité du dividende."},
    {"q": "À quelle fréquence ce classement est-il mis à jour ?", "a": "À chaque séance : le rendement est recalculé sur le dernier cours de clôture disponible. La date exacte des cours est indiquée sous le tableau."},
    {"q": "Le dividende retenu est-il celui de l''an prochain ?", "a": "Non. Nous retenons le dernier dividende d''un exercice confirmé, réellement mis en paiement. Un dividende futur dépend de l''assemblée générale et n''est pas garanti."}
  ]'::jsonb,
  'La rédaction WESTBOURSE',
  'Analyse de marché BRVM',
  true,
  now()
)
on conflict (slug) do nothing;

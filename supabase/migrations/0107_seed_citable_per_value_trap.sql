-- 0107 — Page citable « Les pièges du PER à la BRVM ».
--
-- Page de type 'data' : le TABLEAU (PER × verdict value trap des 48 actions) est
-- généré en direct (data_source = 'per_value_trap', recalculé à chaque séance).
-- Ce qui suit est le CALQUE ÉDITABLE posé par-dessus, modifiable depuis l'admin.
--
-- `on conflict do nothing` : ne réécrit pas un contenu déjà édité par un admin.

-- 1) Étendre la contrainte data_source pour autoriser la nouvelle source live.
alter table public.citable_pages
  drop constraint if exists citable_pages_data_source_check;
alter table public.citable_pages
  add constraint citable_pages_data_source_check
  check (data_source in ('dividend_yield', 'sgi_cout', 'budget', 'per_value_trap'));

-- 2) Poser le contenu.
insert into public.citable_pages
  (slug, kind, data_source, title, question, short_answer,
   intro_md, commentary_md, methodology_md, sources, faq,
   author, author_role, published, published_at)
values (
  'pieges-du-per',
  'data',
  'per_value_trap',
  'Value traps du PER à la BRVM : quelles actions bon marché sont des pièges ?',
  'Comment repérer un value trap (piège de valeur) lié au PER sur la BRVM ?',
  'Un PER bas ne signale une bonne affaire que si le bénéfice tient. Sur la BRVM, deux pièges dominent : la « décote piège » (PER modéré mais résultat net en déclin, souvent masqué par un dividende généreux — cas PALM Côte d''Ivoire, Onatel Burkina), et le « bénéfice effondré » (PER à trois chiffres, gonflé mécaniquement par un résultat proche de zéro — BOA Niger, Bernabé, Filtisac). À l''inverse, les vraies décotes associent un PER bas à des bénéfices en croissance : Sonatel, Ecobank, SAPH. Le tableau ci-dessous classe les 48 actions et recalcule le verdict à chaque séance.',
  E'Le **PER (price-earnings ratio)** rapporte le cours d''une action à son bénéfice par action. Un PER de 8 se lit « le marché paie 8 fois les bénéfices annuels ». Intuitivement, un PER bas = action bon marché. **C''est faux la moitié du temps.**\n\nUn PER n''a de sens que rapporté à la **trajectoire des bénéfices**. Si le résultat net décline, le « E » du ratio va baisser : le PER remontera mécaniquement, et l''action qui semblait décotée ne l''était pas. C''est le **value trap** — le piège de valeur.',
  E'## Les deux archétypes de piège sur la BRVM\n\n**1. La décote piège.** PER modéré (souvent 8 à 14) qui attire l''œil, mais résultat net en baisse depuis plusieurs exercices. Le danger est aggravé quand un **dividende élevé** entretient l''illusion de solidité alors que la capacité bénéficiaire s''érode.\n\n**2. Le bénéfice effondré.** PER à deux ou trois chiffres, non pas parce que l''action est chère, mais parce que le bénéfice s''est effondré vers zéro. Le PER est ici un artefact : le dénominateur a fondu. Le piège vise l''investisseur qui s''ancre sur les **bénéfices ou dividendes passés**.\n\n## Le contre-exemple : la vraie décote\n\nUn PER bas **avec** des bénéfices stables ou croissants est une décote potentiellement réelle. C''est là qu''est la valeur — pas dans les PER optiquement bas des sociétés en déclin.',
  E'**Méthode.** Pour chaque action : PER = dernier cours de clôture ÷ bénéfice par action du dernier exercice publié (aligné sur les fiches sociétés Sika Finance). On croise ce PER avec la **trajectoire du résultat net** sur les exercices disponibles (croissance annualisée, variation de la dernière année, nombre d''années de baisse consécutives).\n\n**Verdicts.**\n- *Décote piège* : PER < 14 **et** bénéfices en déclin.\n- *Bénéfice effondré* : PER > 40 **et** bénéfices en déclin (PER gonflé par un résultat quasi nul).\n- *Perte* : résultat net négatif → PER non calculable.\n- *Décote réelle* : PER < 10 **et** bénéfices non déclinants.\n- *Cher* : PER > 25 (la croissance future doit le justifier).\n\nUn exercice manquant n''est jamais traité comme un zéro. Le classement est **recalculé à chaque séance**.',
  '[
    {"label": "BRVM — cours officiels des actions", "url": "https://www.brvm.org/fr/cours-actions/0"},
    {"label": "Sika Finance — fiches financières des sociétés cotées", "url": "https://www.sikafinance.com/marches/cotations_BRVM"},
    {"label": "WESTBOURSE — analyse fondamentale par société", "url": "https://www.westbourse.com/societes"}
  ]'::jsonb,
  '[
    {"q": "Un PER bas est-il toujours une bonne affaire ?", "a": "Non. Un PER bas n''est une décote que si le bénéfice tient. S''il décline, le PER remontera mécaniquement : l''action n''était pas réellement bon marché. C''est le value trap."},
    {"q": "Pourquoi certaines actions affichent-elles un PER de plusieurs centaines ?", "a": "Parce que leur bénéfice s''est effondré vers zéro. Le PER, qui divise le cours par ce bénéfice minuscule, explose. Ce n''est pas une valorisation de croissance mais le signe d''une capacité bénéficiaire détruite."},
    {"q": "Comment distinguer une vraie décote d''un piège ?", "a": "En regardant la trajectoire du résultat net. PER bas + bénéfices en hausse = décote potentiellement réelle. PER bas + bénéfices en baisse = piège. Notre tableau fait ce croisement automatiquement."},
    {"q": "Un dividende élevé protège-t-il du value trap ?", "a": "Au contraire, il peut le masquer. Un dividende généreux sur une société dont les bénéfices déclinent finit par devenir insoutenable (payout supérieur à 100 %) et sera coupé. Le rendement attire, mais la valeur s''érode."},
    {"q": "À quelle fréquence ce classement est-il recalculé ?", "a": "À chaque séance : le PER est recalculé sur le dernier cours de clôture, croisé avec les derniers résultats nets publiés."}
  ]'::jsonb,
  'La rédaction WESTBOURSE',
  'Analyse fondamentale BRVM',
  true,
  now()
)
on conflict (slug) do nothing;

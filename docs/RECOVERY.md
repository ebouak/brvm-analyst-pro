# Procédure de reprise (§12.10)

Objectif : récupérer une ou plusieurs séances manquées ou erronées sans
dupliquer de données. L'upsert idempotent sur `(code, date_marche)` garantit
qu'une relance écrase proprement.

## 1. Diagnostiquer

```sql
-- Quelles dates ont un run réussi ?
select date_marche, status, nb_actions, message_erreur
from scrape_runs
order by date_marche desc;

-- Jours ouvrés sans données actions (trous à combler)
-- (adapter la borne de départ)
with jours as (
  select generate_series(date '2025-01-01', current_date, interval '1 day')::date d
)
select j.d
from jours j
left join (select distinct date_marche from brvm_actions_daily) a on a.date_marche = j.d
where a.date_marche is null
  and extract(dow from j.d) between 1 and 5   -- lun→ven
order by j.d;
```

## 2. Rejouer une date

```bash
cd scraper
npm run scrape:date -- 2025-05-20
```

ou via GitHub Actions : déclencher `workflow_dispatch` en renseignant l'input
`date`.

## 3. Rejouer une plage de dates

```bash
cd scraper
for d in 2025-05-19 2025-05-20 2025-05-21; do
  npm run scrape:date -- "$d" || echo "ÉCHEC $d"
  sleep 5   # politesse envers le serveur BDFIN
done
```

## 4. Cas particuliers

| Symptôme | Cause probable | Action |
|---|---|---|
| `AuthError` à la connexion | Identifiants ou `LOGIN_FIELDS` mal calibrés | Vérifier secrets ; recalibrer (SCRAPER.md §4) |
| `nb_actions = 0` mais status success | Sélecteur tableau obsolète | Recalibrer `*_SELECTORS` ; mettre à jour la fixture de test |
| `hash_source` identique à J-1 | Séance non encore publiée | Replanifier plus tard ; ne pas forcer |
| Variations > seuil en warning | Donnée extrême réelle ou parsing erroné | Inspecter `scrape_runs.message_erreur` + page source |
| Source totalement injoignable | BDFIN down / IP bloquée | Lancer en `--mock` pour ne pas bloquer le frontend ; envisager un proxy (SCRAPER.md §5) |

## 5. Vérifier après reprise

```sql
select date_marche, count(*) as nb_actions
from brvm_actions_daily
where date_marche = '2025-05-20'
group by date_marche;

select public.refresh_market_views();  -- rafraîchir les vues
```

## 6. Bonnes pratiques

- Toujours lancer une reprise avec `LOG_LEVEL=debug` la première fois.
- Utiliser `DRY_RUN=true` pour valider les comptages avant d'écrire.
- Espacer les requêtes (`sleep`) lors d'un backfill massif pour ne pas
  surcharger BDFIN.
- Après recalibrage du markup, ajouter/mettre à jour une fixture dans
  `tests/fixtures/` et un test associé.

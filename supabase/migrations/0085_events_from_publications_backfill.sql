-- ============================================================================
-- 0085_events_from_publications_backfill.sql
-- Dérive market_events depuis la table publications (source interne réelle,
-- 4700+ communiqués/états financiers/avis de convocation déjà ingérés).
--
-- Contexte : la page « Événements de marché » n'affichait que 3 seeds alors que
-- des milliers de publications réelles existaient. Ce backfill rend la page
-- exhaustive. L'ingestion CONTINUE est assurée par la commande scraper `events`
-- (voir scraper/src/events/fromPublications.ts) — même formule dedupe_hash, donc
-- ré-exécutions idempotentes.
--
-- Idempotent : ON CONFLICT (dedupe_hash) DO NOTHING. Sans effet sur une base
-- fraîche où publications est encore vide (le cron `events` remplira ensuite).
-- ============================================================================

insert into public.market_events (
  event_date, event_datetime, source, source_url, source_type, title, summary,
  event_type, issuer_name, instrument_code, sector, country_code,
  importance_level, sentiment, tags, dedupe_hash
)
select
  p.date_publication,
  null,
  coalesce(p.source, 'BDFIN'),
  p.source_url,
  'publication',
  p.libelle,
  null,
  case
    when p.libelle ~* '(dividende|coupon|distribution)' then 'dividende'
    when p.type_publication in ('rapport','etats_financiers','états-financiers-annuels')
         or p.libelle ~* '(r[ée]sultat|etats financiers|états financiers|comptes|chiffre d.affaires|b[ée]n[ée]fice)' then 'resultats'
    when p.type_publication = 'ag' or p.libelle ~* '(assembl[ée]e|convocation|\bago\b|\bage\b)' then 'assemblee'
    when p.libelle ~* '(admission|introduction|premi[èe]re cotation|cotation nouvelle)' then 'admission'
    when p.libelle ~* '(suspension|radiation|reprise de cotation)' then 'suspension'
    else 'autre'
  end,
  null,
  p.code,
  i.secteur,
  i.pays,
  case
    when p.libelle ~* '(dividende|coupon)' then 3
    when p.type_publication in ('rapport','etats_financiers','états-financiers-annuels') then 3
    when p.type_publication = 'ag' then 2
    else 1
  end,
  case
    when p.libelle ~* '(hausse|progression|record|croissance|b[ée]n[ée]fice|dividende)' then 'positive'
    when p.libelle ~* '(baisse|perte|recul|suspension|sanction|d[ée]ficit|avertissement)' then 'negative'
    else 'neutral'
  end,
  null,
  encode(digest('publication|'||p.date_publication::text||'|'||p.libelle||'|'||coalesce(p.source_url,''),'sha256'),'hex')
from public.publications p
join public.brvm_instruments i on i.code = p.code
on conflict (dedupe_hash) do nothing;

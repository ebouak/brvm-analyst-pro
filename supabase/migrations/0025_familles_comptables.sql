-- 0025 : familles comptables + lignes spécifiques par secteur
-- Famille comptable : banque (réf. BCEAO), assurance (réf. CIMA), general (SYSCOHADA).
-- Le socle commun (revenu_total = CA/PNB/primes, resultat_net, total_actifs, capitaux
-- propres, trésorerie) reste canonique. Les lignes propres vont dans lignes_specifiques.

alter table public.brvm_instruments
  add column if not exists famille_comptable text not null default 'general'
    check (famille_comptable in ('banque','assurance','general'));

alter table public.income_statements add column if not exists lignes_specifiques jsonb;
alter table public.balance_sheets   add column if not exists lignes_specifiques jsonb;

-- Banques (15)
update public.brvm_instruments set famille_comptable='banque'
  where code in ('BICB','BICC','BOAB','BOABF','BOAC','BOAM','BOAN','BOAS',
                 'CBIBF','ECOC','ETIT','NSBC','ORGT','SGBC','SIBC');

-- Secteur BRVM fin (toutes actions). Banques -> Finance.
update public.brvm_instruments set secteur='Finance'
  where famille_comptable='banque';

update public.brvm_instruments set secteur = m.sect from (values
  ('ABJC','Services'),('BNBC','Distribution'),('CABC','Industrie'),
  ('CFAC','Distribution'),('CIEC','Services publics'),('FTSC','Industrie'),
  ('LNBB','Services'),('NEIC','Services'),('NTLC','Agro-industrie'),
  ('ONTBF','Télécommunications'),('ORAC','Télécommunications'),('PALC','Agro-industrie'),
  ('PRSC','Distribution'),('SAFC','Finance'),('SCRC','Agro-industrie'),
  ('SDCC','Services publics'),('SDSC','Transport'),('SEMC','Industrie'),
  ('SHEC','Distribution'),('SICC','Agro-industrie'),('SIVC','Industrie'),
  ('SMBC','Industrie'),
  ('SLBC','Agro-industrie'),('SNTS','Télécommunications'),('SOGC','Agro-industrie'),
  ('SPHC','Agro-industrie'),('STAC','Industrie'),('STBC','Industrie'),
  ('SVOC','Services'),('TTLC','Distribution'),('TTLS','Distribution'),
  ('UNLC','Distribution'),('UNXC','Industrie')
) as m(code, sect) where brvm_instruments.code = m.code;

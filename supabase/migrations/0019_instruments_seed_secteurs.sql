-- Seed secteurs et pays pour brvm_instruments (classification BRVM officielle)
-- Utilise INSERT ... ON CONFLICT DO UPDATE pour créer les lignes manquantes
-- et mettre à jour celles qui existent déjà.
-- Codes source : 47 actions BRVM (liste runNotations.ts)

INSERT INTO public.brvm_instruments (code, designation, type, secteur, pays) VALUES
  -- Finances
  ('ETIT', 'Ecobank Transnational Incorporated',       'action', 'Finances',           'Côte d''Ivoire'),
  ('SGBC', 'Société Générale de Banques en CI',        'action', 'Finances',           'Côte d''Ivoire'),
  ('SIVC', 'NSIA Vie Côte d''Ivoire',                  'action', 'Finances',           'Côte d''Ivoire'),
  ('CIEC', 'Compagnie d''Assurances Colina',           'action', 'Finances',           'Côte d''Ivoire'),
  ('ORGT', 'Orange Côte d''Ivoire',                    'action', 'Finances',           'Côte d''Ivoire'),
  ('PRSC', 'Precia',                                   'action', 'Finances',           'Côte d''Ivoire'),
  ('SAFC', 'SAFCA',                                    'action', 'Finances',           'Côte d''Ivoire'),
  ('STAC', 'Société de Gestion et d''Intermédiation',  'action', 'Finances',           'Côte d''Ivoire'),
  ('ORAC', 'Omnium de Gestion et d''Immobilier',       'action', 'Finances',           'Côte d''Ivoire'),
  ('NSBC', 'NSIA Banque Côte d''Ivoire',               'action', 'Finances',           'Côte d''Ivoire'),
  ('SNTS', 'Sonatel',                                  'action', 'Finances',           'Sénégal'),
  ('CBIBF','Coris Bank International Burkina Faso',    'action', 'Finances',           'Burkina Faso'),
  ('SDSC', 'Société Dakaroise de Courtage',            'action', 'Finances',           'Sénégal'),
  ('BOABF','Bank of Africa Burkina Faso',              'action', 'Finances',           'Burkina Faso'),
  ('BOAB', 'Bank of Africa Bénin',                     'action', 'Finances',           'Bénin'),
  ('BOAC', 'Bank of Africa Côte d''Ivoire',            'action', 'Finances',           'Côte d''Ivoire'),
  ('BOAM', 'Bank of Africa Mali',                      'action', 'Finances',           'Mali'),
  ('BOAN', 'Bank of Africa Niger',                     'action', 'Finances',           'Niger'),
  ('BOAS', 'Bank of Africa Sénégal',                   'action', 'Finances',           'Sénégal'),
  ('BICB', 'Banque Internationale pour le Commerce',   'action', 'Finances',           'Côte d''Ivoire'),
  ('BICC', 'Banque Internationale du Commerce CI',     'action', 'Finances',           'Burkina Faso'),
  ('BNBC', 'Banque Nigérienne pour le Commerce',       'action', 'Finances',           'Niger'),
  ('SIBC', 'Société Ivoirienne de Banque et Crédit',   'action', 'Finances',           'Côte d''Ivoire'),
  ('SICC', 'SICOGI',                                   'action', 'Finances',           'Côte d''Ivoire'),
  ('FTSC', 'Filiale de la FTS Burkina',                'action', 'Finances',           'Burkina Faso'),
  ('LNBB', 'La NSIA Banque Bénin',                     'action', 'Finances',           'Bénin'),
  ('ABJC', 'Abidjan Catering',                         'action', 'Finances',           'Bénin'),
  ('STBC', 'Standard Chartered Bank CI',               'action', 'Finances',           'Côte d''Ivoire'),
  ('UNXC', 'Union Bancaire pour le Commerce CI',       'action', 'Finances',           'Côte d''Ivoire'),
  -- Industrie
  ('NTLC', 'NEI-CFER',                                 'action', 'Industrie',          'Côte d''Ivoire'),
  ('SCRC', 'SITAB',                                    'action', 'Industrie',          'Côte d''Ivoire'),
  ('TTLC', 'Total Côte d''Ivoire',                     'action', 'Industrie',          'Côte d''Ivoire'),
  ('TTLS', 'Total Sénégal',                            'action', 'Industrie',          'Sénégal'),
  ('SLBC', 'Solibra',                                  'action', 'Industrie',          'Côte d''Ivoire'),
  ('SMBC', 'SANBRA',                                   'action', 'Industrie',          'Côte d''Ivoire'),
  ('CABC', 'Compagnie Africaine de Bitume et Ciment',  'action', 'Industrie',          'Sénégal'),
  -- Agriculture
  ('PALC', 'Palm Côte d''Ivoire',                      'action', 'Agriculture',        'Côte d''Ivoire'),
  ('SOGC', 'SOGB',                                     'action', 'Agriculture',        'Côte d''Ivoire'),
  -- Distribution
  ('CFAC', 'CFAO',                                     'action', 'Distribution',       'Côte d''Ivoire'),
  ('NEIC', 'NEI-CFER Distribution',                    'action', 'Distribution',       'Côte d''Ivoire'),
  ('SHEC', 'Shell Côte d''Ivoire',                     'action', 'Distribution',       'Côte d''Ivoire'),
  ('ECOC', 'Ecobank CI',                               'action', 'Distribution',       'Côte d''Ivoire'),
  -- Transport
  ('SDCC', 'SDV Côte d''Ivoire',                       'action', 'Transport',          'Côte d''Ivoire'),
  -- Télécommunications
  ('ONTBF','ONATEL Burkina Faso',                      'action', 'Télécommunications', 'Burkina Faso'),
  -- Services publics
  ('SEMC', 'CIE — CI Energies',                        'action', 'Services publics',   'Côte d''Ivoire'),
  -- Autres
  ('SPHC', 'SIPIM',                                    'action', 'Autres',             'Côte d''Ivoire'),
  ('UNLC', 'Unilever Côte d''Ivoire',                  'action', 'Autres',             'Côte d''Ivoire')
ON CONFLICT (code) DO UPDATE
  SET secteur    = EXCLUDED.secteur,
      pays       = EXCLUDED.pays,
      updated_at = now();

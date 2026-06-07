-- Seed secteurs et pays pour brvm_instruments (classification BRVM officielle)
-- Codes source: ABJC BICB BICC BNBC BOAB BOABF BOAC BOAM BOAN BOAS
--               CABC CBIBF CFAC CIEC ECOC ETIT FTSC LNBB NEIC
--               NSBC NTLC ONTBF ORAC ORGT PALC PRSC SAFC SCRC
--               SDCC SDSC SEMC SGBC SHEC SIBC SICC SIVC SLBC
--               SMBC SNTS SOGC SPHC STAC STBC TTLC TTLS UNLC UNXC

-- Finances
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'ETIT';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'SGBC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'SIVC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'CIEC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'ORGT';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'PRSC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'SAFC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'STAC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'ORAC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'NSBC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Sénégal'         WHERE code = 'SNTS';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Sénégal'         WHERE code = 'CBIBF';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Sénégal'         WHERE code = 'SDSC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Sénégal'         WHERE code = 'BOABF';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Bénin'           WHERE code = 'BOAB';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'BOAC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Mali'            WHERE code = 'BOAM';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Niger'           WHERE code = 'BOAN';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Sénégal'         WHERE code = 'BOAS';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'BICB';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Burkina Faso'    WHERE code = 'BICC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Niger'           WHERE code = 'BNBC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'SIBC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'SICC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Burkina Faso'    WHERE code = 'FTSC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'LNBB';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Bénin'           WHERE code = 'ABJC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'STBC';
UPDATE brvm_instruments SET secteur = 'Finances', pays = 'Côte d''Ivoire'  WHERE code = 'UNXC';

-- Industrie
UPDATE brvm_instruments SET secteur = 'Industrie', pays = 'Côte d''Ivoire' WHERE code = 'NTLC';
UPDATE brvm_instruments SET secteur = 'Industrie', pays = 'Côte d''Ivoire' WHERE code = 'SCRC';
UPDATE brvm_instruments SET secteur = 'Industrie', pays = 'Côte d''Ivoire' WHERE code = 'TTLC';
UPDATE brvm_instruments SET secteur = 'Industrie', pays = 'Côte d''Ivoire' WHERE code = 'TTLS';
UPDATE brvm_instruments SET secteur = 'Industrie', pays = 'Côte d''Ivoire' WHERE code = 'SLBC';
UPDATE brvm_instruments SET secteur = 'Industrie', pays = 'Côte d''Ivoire' WHERE code = 'SMBC';
UPDATE brvm_instruments SET secteur = 'Sénégal',   pays = 'Sénégal'        WHERE code = 'CABC';

-- Agriculture
UPDATE brvm_instruments SET secteur = 'Agriculture', pays = 'Côte d''Ivoire' WHERE code = 'PALC';
UPDATE brvm_instruments SET secteur = 'Agriculture', pays = 'Côte d''Ivoire' WHERE code = 'SOGC';

-- Distribution
UPDATE brvm_instruments SET secteur = 'Distribution', pays = 'Côte d''Ivoire' WHERE code = 'CFAC';
UPDATE brvm_instruments SET secteur = 'Distribution', pays = 'Côte d''Ivoire' WHERE code = 'NEIC';
UPDATE brvm_instruments SET secteur = 'Distribution', pays = 'Côte d''Ivoire' WHERE code = 'SHEC';
UPDATE brvm_instruments SET secteur = 'Distribution', pays = 'Côte d''Ivoire' WHERE code = 'ECOC';

-- Transport
UPDATE brvm_instruments SET secteur = 'Transport', pays = 'Côte d''Ivoire' WHERE code = 'SDCC';

-- Télécommunications
UPDATE brvm_instruments SET secteur = 'Télécommunications', pays = 'Burkina Faso' WHERE code = 'ONTBF';

-- Services publics
UPDATE brvm_instruments SET secteur = 'Services publics', pays = 'Côte d''Ivoire' WHERE code = 'SEMC';

-- Autres / Holding
UPDATE brvm_instruments SET secteur = 'Autres', pays = 'Côte d''Ivoire' WHERE code = 'SPHC';
UPDATE brvm_instruments SET secteur = 'Autres', pays = 'Côte d''Ivoire' WHERE code = 'UNLC';

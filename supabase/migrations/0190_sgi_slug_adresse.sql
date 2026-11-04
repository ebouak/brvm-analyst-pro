-- 0190 — Identifiant stable et adresse officielle des SGI (2026-11-04)
--
-- Les SGI étaient identifiées par leur NOM, qui sert aussi de clé de jointure
-- avec sgi_frais : un renommage (SOGEBOURSE → Société Générale Capital
-- Securities West Africa, 0188) cassait toute adresse fondée dessus. La fiche
-- individuelle /comparateur-sgi/annuaire/[slug] exige une adresse qui ne
-- change pas : `slug`, fixé ici une fois pour toutes (un renommage futur ne
-- le touche pas).
--
-- `adresse` : adresse et boîte postale publiées par l'annuaire officiel
-- brvm.org (/fr/intervenants/sgi/tous, relevé du 2026-11-04). Coordonnée
-- professionnelle publique, aucune donnée personnelle. NULL pour les trois
-- SGI pas encore listées par la BRVM (Kerales, Mansa, One Africa Markets) :
-- jamais déduite d'une autre source.

begin;

alter table public.sgi_directory
  add column if not exists slug text,
  add column if not exists adresse text;

update public.sgi_directory set slug = 'abco-bourse', adresse = 'Résidence Moumtazz, Avenue Cheikh Anta Diop, Mermoz - Face 2ème Porte, DAKAR - SENEGAL — BP 6956 Dakar – Etoile' where nom = 'ABCO Bourse';
update public.sgi_directory set slug = 'africabourse', adresse = 'Avenue Steinmetz en face de DHL ex- Air Gabon 01 — BP 6002 COTONOU BENIN' where nom = 'AfricaBourse';
update public.sgi_directory set slug = 'agi', adresse = 'Av. Jean Paul II, Carré 1269 Immeuble de l’Africaine des Assurances Face à la Direction de l’Emigration Immigration 01 — BP 8668 RP Cotonou' where nom = 'AFRICAINE DE GESTION ET D''INTERMEDIATION (AGI)';
update public.sgi_directory set slug = 'atlantique-finance', adresse = '15, Av. Joseph Anoma, Abidjan-Plateau, 10ème étage — BP 04 BP 1036 Abidjan 04' where nom = 'Atlantique Finance';
update public.sgi_directory set slug = 'attijari-securities-west-africa', adresse = 'Rue Gourgas - Tour Immeuble Alpha 2000 3ème étage — BP 1300 ABIDJAN' where nom = 'Attijari Securities West Africa';
update public.sgi_directory set slug = 'bici-bourse', adresse = '1er étage de l''agence BICICI_AGHIEN, Cocody ll Plateau, Boulevard Latrille, Carrefour Duncan 01 BP 1298 Abidjan' where nom = 'BICI Bourse';
update public.sgi_directory set slug = 'biic-financial-services', adresse = 'Boulevard St Michel — BP 7700 COTONOU 01' where nom = 'BIIC Financial Services (BFS)';
update public.sgi_directory set slug = 'bni-finances', adresse = 'Plateau, Avenue Delafosse prolongée, Immeuble Belle Rive, au 14ème étage — BP 670 ABIDJAN 01' where nom = 'BNI Finances';
update public.sgi_directory set slug = 'boa-capital-securities', adresse = 'Plateau - Boulevard de la République, Avenue Crozet, Immeuble XL au 2ème étage. — BP 01 BP 4854 Abidjan 01' where nom = 'BOA Capital Securities';
update public.sgi_directory set slug = 'bridge-securities', adresse = 'Immeuble THE ONE, Cocody 33, Rue de la Cannebière — BP 01 BP 13002 Abidjan 01' where nom = 'Bridge Securities';
update public.sgi_directory set slug = 'bsic-capital-sa', adresse = 'Avenue Noguès, Immeuble Broadway Center 3ème étage Plateau — BP 01 BP 7032 Abidjan 01 Côte d''Ivoire' where nom = 'BSIC Capital SA';
update public.sgi_directory set slug = 'cgf-bourse', adresse = 'Km 6, Av Cheick Anta Diop, Immeuble El Hadji Serigne Bassirou Mbacké' where nom = 'CGF Bourse';
update public.sgi_directory set slug = 'cifa-bourse', adresse = 'Immeuble SANLAM 3ième étage, Boulevard du 22 Octobre 1946, Quartier du Fleuve, Bamako/Mali' where nom = 'Compagnie d''Ingénierie Financière et d''Assistance en Bourse';
update public.sgi_directory set slug = 'coris-bourse', adresse = 'Burkina Faso Avenue Loudun Rue 05 – Secteur 04, Parcelle 08, Lot 04, Section 020 — BP 6585 Ouagadougou 01' where nom = 'Coris Bourse';
update public.sgi_directory set slug = 'edc-investment-corporation', adresse = 'Avenue Houdaille, 2ème étage Immeuble Ecobank, 01 — BP 4107 Abidjan 01' where nom = 'EDC Investment Corporation';
update public.sgi_directory set slug = 'everest-finance', adresse = 'Immeuble Platinum - 4ème étage, 18 Bd de la république — BP 11659' where nom = 'Everest Finance';
update public.sgi_directory set slug = 'fgi', adresse = 'Point E, Immeuble EPI, 1er étage, Boulevard du Sud x Rue 1 — BP 25672 Dakar, Sénégal' where nom = 'Finance Gestion et Intermédiation (FGI)';
update public.sgi_directory set slug = 'gek-capital', adresse = 'Abidjan, Cocody, Riviera Golf, Cité Riviera Beach, Villa Emeraude — BP 17 BP 41 Abidjan 17' where nom = 'GEK Capital';
update public.sgi_directory set slug = 'global-capital', adresse = 'Bamako ACl 2000 Rue 239 Parcelle 2355 1er étage — BP E3407' where nom = 'Global Capital';
update public.sgi_directory set slug = 'hudson-cie', adresse = '24 Boulevard Clozel, Avenue Lamblin, Immeuble Le 24, 4e étage, 18 BP 2294 Abidjan 18 COTE D''IVOIRE' where nom = 'Hudson & Cie';
update public.sgi_directory set slug = 'image-finances-internationales', adresse = 'Ouaga 2000, coté Est de la mosquée KANAZOE — BP 05 BV 30130 Ouagadougou 05 - BF' where nom = 'Images Finances Internationales';
update public.sgi_directory set slug = 'impaxis-securities', adresse = 'Sacré Cœur 3 Extension VDN n° 10 077 — BP 45545 DAKAR Sénégal' where nom = 'Impaxis Securities';
update public.sgi_directory set slug = 'invictus-capital-finance', adresse = 'Immeuble El Hadji Rey TALL AMAR Lot N°46, 21 Av. Lamine Gueye x Dodds, 12ème étage — BP 15 498 Dakar, Sénégal' where nom = 'Invictus Capital & Finance';
update public.sgi_directory set slug = 'kerales-finance', adresse = null where nom = 'KERALES FINANCE';
update public.sgi_directory set slug = 'mac-african-sgi', adresse = 'COCODY Riviera M’BADON à 300 mètres de l’Ambassade de Chine' where nom = 'MAC African SGI';
update public.sgi_directory set slug = 'mansa-capital', adresse = null where nom = 'MANSA CAPITAL';
update public.sgi_directory set slug = 'matha-securities', adresse = 'mmeuble TROPIQUE 3 – 3ème étage Boulevard de la République – Plateau 01 BP 10762 Abidjan 01 – Côte d’Ivoire' where nom = 'Matha Securities';
update public.sgi_directory set slug = 'nsia-finance', adresse = '8 et 10, Avenue Joseph Anoma, Tour BIAO 14ème étage — BP 18 BP 2294 Abidjan 18' where nom = 'NSIA Finance';
update public.sgi_directory set slug = 'one-africa-markets', adresse = null where nom = 'ONE AFRICA MARKETS (OAM CI)';
update public.sgi_directory set slug = 'oragroup-securities', adresse = 'COCODY MERMOZ, RUE JEANNE GERVAIS, LOT 7B ET 8 — BP 08 BPM 701 ABIDJAN 08' where nom = 'Oragroup Securities';
update public.sgi_directory set slug = 'phoenix-capital-management', adresse = 'Cocody Riviera 4 Golf Face à ''annexe de l''Ambassade des USA — BP 01 BP 12686 Abidjan 01' where nom = 'Phoenix Capital Management';
update public.sgi_directory set slug = 'sbif', adresse = 'Avenue John Kennedy, 01 — BP 53 94 Ouagadougou 01' where nom = 'SBIF';
update public.sgi_directory set slug = 'sgi-benin', adresse = 'Carré 211 Saint Michel Immeuble SGI-BENIN — BP 01 BP 4546 Cotonou' where nom = 'SGI Bénin';
update public.sgi_directory set slug = 'sgi-mali', adresse = 'lmmeuble Ali Baba (ABKll) 2ème Etage, Bureau 209-210' where nom = 'SGI Mali';
update public.sgi_directory set slug = 'sgi-niger', adresse = '258 B Rue du Grand Hôtel — BP 10812 Niamey' where nom = 'SGI Niger';
update public.sgi_directory set slug = 'sgi-togo', adresse = 'PLACE VAN VOLLENHOVEN, UTB Centrale 3ème Etage — BP 2312 LOME' where nom = 'SGI Togo';
update public.sgi_directory set slug = 'sirius-capital', adresse = 'ABIDJAN – PLATEAU – CÔTE D’IVOIRE, Rue Jesse Owens Sis Immeuble Sciam — BP 12916 Abidjan 01' where nom = 'Sirius Capital';
update public.sgi_directory set slug = 'sa2if', adresse = 'Ouaga Kossyam 10010 Ouaga 2000, Extension sud non loin de Salitas — BP 459 Ouaga' where nom = 'SOCIÉTÉ AFRICAINE D''INGÉNIERIE ET D''INTERMÉDIATION FINANCIÈRE (SA2IF)';
update public.sgi_directory set slug = 'societe-generale-capital-securities', adresse = 'Bd Hassan II, Immeuble Ivoire Trade Center - Cocody - Abidjan — BP 1355 ABIDJAN 01 T' where nom = 'Société Générale Capital Securities West Africa';
update public.sgi_directory set slug = 'united-capital-for-africa', adresse = 'Av. proche, rue en face de l’eglise Saint Michel allant vers Caboma, immeuble Comète lot 202 parcelle « d », Cotonou – BENIN — BP 001 BP 8690 RP' where nom = 'UNITED CAPITAL FOR AFRICA';

-- Toutes les lignes doivent en avoir un : sinon la migration échoue entière.
alter table public.sgi_directory alter column slug set not null;
create unique index if not exists sgi_directory_slug_key on public.sgi_directory (slug);
alter table public.sgi_directory drop constraint if exists sgi_directory_slug_forme;
alter table public.sgi_directory add constraint sgi_directory_slug_forme check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

comment on column public.sgi_directory.slug is
  'Identifiant stable de la SGI dans les URL (/comparateur-sgi/annuaire/<slug>). Ne change pas quand le nom change.';
comment on column public.sgi_directory.adresse is
  'Adresse et BP publiées par l''annuaire officiel brvm.org. NULL si la BRVM ne la publie pas.';

commit;

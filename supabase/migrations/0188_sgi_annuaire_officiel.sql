begin;

-- 0188 — Annuaire et barèmes des SGI alignés sur les sources officielles (2026-11-04)
--
-- Données seules, aucune structure hors la contrainte `source`. Sources :
--   * annuaire officiel brvm.org (/fr/intervenants/sgi/tous, 10 pages) : site,
--     téléphone, e-mail et logo de 37 SGI ;
--   * décisions d'homologation AMF-UMOA / CREPMF publiées en PDF sur brvm.org,
--     relues une à une (scans) — repérées grâce à famaya.app, dont aucun
--     chiffre n'est repris tel quel.
--
-- Défauts corrigés :
--   * 28 SGI avaient pour « site officiel » la page Facebook de RichBourse
--     (lien de pied de page pris par le scraper — corrigé dans
--     scraper/src/scrapers/sgiRichbourse.ts) ;
--   * 3 SGI avaient un paragraphe éditorial dans le champ téléphone ;
--   * BOA Capital Securities pointait vers bmcecapital.com ;
--   * « Africaine de Bourse » : absente de l'annuaire BRVM et d'aucune décision
--     d'homologation, et sa fiche portait le site d'Attijari (sib.ci) — retirée ;
--   * aucune ligne « homologuée » ne liait sa décision : toutes renvoyaient à
--     une liste RichBourse/SikaFinance. Le PDF officiel est désormais la source.

alter table public.sgi_directory drop constraint if exists sgi_directory_source_check;
alter table public.sgi_directory add constraint sgi_directory_source_check
  check (source in ('manuel', 'richbourse', 'brvm'));

-- ── Annuaire : coordonnées et logos officiels (brvm.org) ─────────────────────
update public.sgi_directory set site_web = 'https://www.coris-bourse.com', telephone = '(00226) 25 33 14 85', email = 'corisbourse@coris-bourse.com', logo = '/sgi/coris-bourse.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Coris Bourse';
update public.sgi_directory set site_web = 'https://www.image-finance.com', telephone = '+226 25 66 78 78 / +226 04 00 00 46', email = 'contact@image-finance.com', logo = '/sgi/images-finances-internationales.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Images Finances Internationales';
update public.sgi_directory set site_web = 'https://www.sbifbourse.bf/', telephone = '(226) 25 33 04 91/92', email = 'sbif@fasonet.bf', logo = '/sgi/sbif.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'SBIF';
update public.sgi_directory set site_web = 'https://sa2if.com/', telephone = '(226) 75 20 01 01 / 64 36 99 99', email = 'sa2if@sa2if.com', logo = '/sgi/societe-africaine-d-ingenierie-et-d-intermediation-financiere.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'SOCIÉTÉ AFRICAINE D''INGÉNIERIE ET D''INTERMÉDIATION FINANCIÈRE (SA2IF)';
update public.sgi_directory set site_web = 'https://www.africabourse.com', telephone = '(229) 21 31 88 35/36', email = 'africabourse@africabourse.com', logo = '/sgi/africabourse.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'AfricaBourse';
update public.sgi_directory set site_web = 'https://www.sgi-agi.com', telephone = '+229 21318733', email = 'contact@sgi-agi.com', logo = '/sgi/africaine-de-gestion-et-d-intermediation.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'AFRICAINE DE GESTION ET D''INTERMEDIATION (AGI)';
update public.sgi_directory set site_web = 'https://www.biic-financialservices.com/', telephone = '(229) 21 32 48 75/76', email = 'sgibfs@biic-financialservices.com', logo = '/sgi/biic-financial-services.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'BIIC Financial Services (BFS)';
update public.sgi_directory set site_web = 'https://www.sgibenin.com', telephone = '(229)21 31 15 41/71', email = 'sgibenin@sgibenin.com', logo = '/sgi/sgi-benin.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'SGI Bénin';
update public.sgi_directory set site_web = 'https://www.ucasgi.com', telephone = '(229) 21 31 00 21 / 61 18 18 00', email = 'uca@ucasgi.com', logo = '/sgi/united-capital-for-africa.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'UNITED CAPITAL FOR AFRICA';
update public.sgi_directory set site_web = 'https://www.atlantiquefinance.net/', telephone = '27 20 31 21 21 / 27 20 31 21 23', email = 'atlantiquefinance@banqueatlantique.net', logo = '/sgi/atlantique-finance.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Atlantique Finance';
update public.sgi_directory set site_web = 'https://www.sib.ci', telephone = '(225) 27 20 21 98 26 / 32', email = 'aswa@sib.ci', logo = '/sgi/attijari-securities-west-africa.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Attijari Securities West Africa';
update public.sgi_directory set site_web = 'https://www.bicibourse.ci', telephone = '(225) 27 20 20 16 68', email = 'bicibourse@africa.bnpparibas.com', logo = '/sgi/bici-bourse.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'BICI Bourse';
update public.sgi_directory set site_web = 'https://www.bni.ci/groupe-bni/bni-finances', telephone = '(225) 27 20 31 07 77', email = 'bnifinances@bni.ci', logo = '/sgi/bni-finances.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'BNI Finances';
update public.sgi_directory set site_web = 'https://www.boacapital.com', telephone = '(225) 27 20 30 21 22', email = 'info@boacapital.com', logo = '/sgi/boa-capital-securities.jpeg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'BOA Capital Securities';
update public.sgi_directory set site_web = 'https://www.bridge-securities.com', telephone = '(225) 05 85 74 98 98 / 05 74 80 80 31', email = 'info@bridge-securities.com', logo = '/sgi/bridge-securities.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Bridge Securities';
update public.sgi_directory set site_web = 'https://bsiccapital.com/', telephone = '+225 27 20 31 71 11', email = 'bsic.capital@bsicbank.com', logo = '/sgi/bsic-capital-sa.jpeg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'BSIC Capital SA';
update public.sgi_directory set site_web = 'https://www.ecobank.com', telephone = '(225) 27 20 21 10 44', email = 'eic@ecobank.com', logo = '/sgi/edc-investment-corporation.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'EDC Investment Corporation';
update public.sgi_directory set site_web = 'https://www.gekcapital.com', telephone = '+225 27 22 22 43 60', email = 'info@gekcapital.com', logo = '/sgi/gek-capital.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'GEK Capital';
update public.sgi_directory set site_web = 'http://www.hudson-cie.com', telephone = '(225) 27 20 31 55 00', email = 'info@hudson-cie.com', logo = '/sgi/hudson-cie.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Hudson & Cie';
update public.sgi_directory set site_web = null, telephone = null, email = null, verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'KERALES FINANCE';
update public.sgi_directory set site_web = 'https://www.macafricansgi.com', telephone = '(225) 07 68 311 125 / 27 22 46 28 92', email = 'macafrican@macafrican.com', logo = '/sgi/mac-african-sgi.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'MAC African SGI';
update public.sgi_directory set site_web = 'https://mansabank.com/', telephone = null, email = null, verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'MANSA CAPITAL';
update public.sgi_directory set site_web = 'https://mathasecurities.com/', telephone = '+ 225 27 20 24 30 30', email = null, logo = '/sgi/matha-securities.jpeg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Matha Securities';
update public.sgi_directory set site_web = 'https://www.nsiafinance.com/', telephone = '27 20 20 06 53', email = 'nsiafinance@nsiafinance.com', logo = '/sgi/nsia-finance.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'NSIA Finance';
update public.sgi_directory set site_web = 'https://www.oamarkets.com/', telephone = null, email = null, verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'ONE AFRICA MARKETS (OAM CI)';
update public.sgi_directory set site_web = 'https://www.oragroupsecurities.net', telephone = '(00225) 07 88 77 15 69', email = 'contactOGS@orabank.net', logo = '/sgi/oragroup-securities.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Oragroup Securities';
update public.sgi_directory set site_web = 'https://phoenixafricaholding.com/pcm/', telephone = '27 22 59 85 80', email = 'cms@phoenixafrica.com', logo = '/sgi/phoenix-capital-management.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Phoenix Capital Management';
update public.sgi_directory set site_web = 'https://www.sirius.ci', telephone = '(225) 27 20 24 24 65', email = 'contact@sirius.ci', logo = '/sgi/sirius-capital.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Sirius Capital';
update public.sgi_directory set nom = 'Société Générale Capital Securities West Africa', site_web = 'https://societegenerale.africa/fr/des-services-sur-mesure/une-expertise-marches-financiers/gestion-intermediation/', telephone = '(225) 27 20 20 12 65', email = 'filiale.sogebourse@socgen.com', logo = '/sgi/societe-generale-capital-securities-west-africa.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'SOGEBOURSE';
update public.sgi_directory set site_web = 'https://www.cifabourse.com', telephone = '00223 20 23 50 20', email = 'info@cifabourse.com', logo = '/sgi/compagnie-d-ingenierie-financiere-et-d-assistance-en-bourse.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Compagnie d''Ingénierie Financière et d''Assistance en Bourse';
update public.sgi_directory set site_web = 'https://www.sgiglobalcapital.com', telephone = '+ 223 44 90 59 74 / 44 90 59 75', email = 'contact@sgiglobalcapital.com', logo = '/sgi/global-capital.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Global Capital';
update public.sgi_directory set site_web = 'https://www.sgi-mali.com/', telephone = '(223) 20 29 41 19', email = 'SGI@SGImali.com', logo = '/sgi/sgi-mali.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'SGI Mali';
update public.sgi_directory set site_web = 'https://www.sginiger.com', telephone = '(227) 20 73 78 18', email = 'sginiger@sginiger.com', logo = '/sgi/sgi-niger.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'SGI Niger';
update public.sgi_directory set site_web = 'https://www.abcobourse.com', telephone = '(+221) 33 822 68 00', email = 'contact@abcobourse.com', logo = '/sgi/abco-bourse.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'ABCO Bourse';
update public.sgi_directory set site_web = 'https://www.cgfbourse.com', telephone = '(221) 33 864 97 97', email = 'cgfbourse@cgfbourse.com', logo = '/sgi/cgf-bourse.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'CGF Bourse';
update public.sgi_directory set site_web = 'https://www.everestfin.com', telephone = '(221) 33 82 28 700', email = 'all@everestfin.com', logo = '/sgi/everest-finance.png', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Everest Finance';
update public.sgi_directory set site_web = 'https://www.fgi-bourse.com', telephone = '(+221) 33 867 60 42 / (221) 78 152 05 05', email = 'contact@fgi-bourse.com', logo = '/sgi/finance-gestion-et-intermediation.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Finance Gestion et Intermédiation (FGI)';
update public.sgi_directory set site_web = 'https://www.impaxis-securities.com', telephone = '(221) 33 869 31 40/47', email = 'Impaxis.securities@impaxis-securities.com', logo = '/sgi/impaxis-securities.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Impaxis Securities';
update public.sgi_directory set site_web = 'https://www.invictuscapfin.com', telephone = '(221) 33 864 58 58 / (221) 33 820 02 25', email = 'contact@invictuscapfin.com', logo = '/sgi/invictus-capital-finance.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'Invictus Capital & Finance';
update public.sgi_directory set site_web = 'https://www.sgitogo.tg/', telephone = '(228) 22 22 31 45', email = 'sgiI-togo@ids.tg', logo = '/sgi/sgi-togo.jpg', source = 'brvm', verifie_le = date '2026-11-04', updated_at = now()
  where nom = 'SGI Togo';

-- ── SGI retirée (absente de l'annuaire BRVM et de toute décision) ──────────────
delete from public.sgi_frais where sgi_nom = 'Africaine de Bourse';
delete from public.sgi_directory where nom = 'Africaine de Bourse';

-- ── Lien vers la décision officielle déjà citée (numéro identique, ou contenu
--    confronté au PDF pour BIIC, Impaxis et Mansa) ──────────────────────────────
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpcr-sg-da-2021-158-homologation_des_tarifs_de_la_sgi_africabourse.pdf', source_label = 'Décision PCR/SG/DA/2021/158 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'AfricaBourse';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/20171013-decision_crepmf_ndeg_pcrda2017115-_homologation_des_tarifs_de_la_sgi_africaine_de_gestion_et_dintermediation_agi.pdf', source_label = 'Décision PCR/DA/2017/115 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'AFRICAINE DE GESTION ET D''INTERMEDIATION (AGI)';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_172_-_2025_-_homologation_des_tarifs_de_la_sgi_attijari_securities_west_africa.pdf', source_label = 'Décision PAMF-UMOA/2025/172 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Attijari Securities West Africa';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndeg326_sgi_bici_bourse_homologation_des_tarifs_de_la_sgi_bici_bourse.pdf', source_label = 'Décision PAMF-UMOA/2024/326 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'BICI Bourse';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_024-2024_-_homologation_des_tarifs_de_la_sgi_bfs.pdf', source_label = 'Décision PAMF-UMOA/2024/024 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'BIIC Financial Services (BFS)';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_091_-_2025_-_homologation_des_tarifs_de_la_sgi_bni_finances.pdf', source_label = 'Décision PAMF-UMOA/2025/091 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'BNI Finances';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_011-2024_-_homologation_des_tarifs_de_la_sgi_boa_capital_securities_0.pdf', source_label = 'Décision PAMF-UMOA/2024/011 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'BOA Capital Securities';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_163-2024_-_homologation_des_tarifs_de_la_sgi_bsic_capital.pdf', source_label = 'Décision PAMF-UMOA/2024/163 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'BSIC Capital SA';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpcr-sg-da-2021-243_-_homologation_des_tarifs_de_la_sgi_cifa_bourse.pdf', source_label = 'Décision PCR/SG/DA/2021/243 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Compagnie d''Ingénierie Financière et d''Assistance en Bourse';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_pcr_da_2018_052_coris_bourse_homologation_tarifs.pdf', source_label = 'Décision PCR/DA/2018/052 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Coris Bourse';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_124_-_2025_-_homologation_des_tarifs_de_la_sgi_fgi.pdf', source_label = 'Décision PAMF-UMOA/2025/124 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Finance Gestion et Intermédiation (FGI)';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_036_-_2025_-_homologation_des_tarifs_de_la_sgi_gek_capital.pdf', source_label = 'Décision PAMF-UMOA/2025/036 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'GEK Capital';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_023_-_2026_-_homologation_des_tarifs_de_la_sgi_impaxis_securities.pdf', source_label = 'Décision PAMF-UMOA/2026/023 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Impaxis Securities';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/20190925_-_decision_ndeg_pcr-da-2019-201_homologation_des_tarifs_de_la_sgi_invictus_capital_finance.pdf', source_label = 'Décision PCR/DA/2019/201 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Invictus Capital & Finance';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_024_-_2026_-_homologation_des_tarifs_de_la_sgi_kerales_finances.pdf', source_label = 'Décision PAMF-UMOA/2026/024 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'KERALES FINANCE';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa-2024-210_-_homologation_des_tarifs_de_la_sgi_mac-african-sgi.pdf', source_label = 'Décision PAMF-UMOA/2024/210 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'MAC African SGI';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_108_-_2026_-_homologation_des_tarifs_de_la_sgi_mansa_capital.pdf', source_label = 'Décision PAMF-UMOA/2026/108 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'MANSA CAPITAL';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/20220525_-_decision_ndegpcr-sg-da-2022-081_-_homologation_des_tarifs_de_la_sgi_matha_securities.pdf', source_label = 'Décision PCR/SG/DA/2022/081 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Matha Securities';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa-149-2026_-_homologation_des_tarifs_de_la_sgi_nsia_capital.pdf', source_label = 'Décision PAMF-UMOA/2026/149 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'NSIA Finance';
update public.sgi_frais set source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_286_-_2025_-_homologation_des_tarifs_de_la_sgi_sirius_capital.pdf', source_label = 'Décision P-AMF-UMOA/2025/286 (homologation des tarifs, PDF brvm.org)', updated_at = now() where sgi_nom = 'Sirius Capital';

-- ── Barèmes relus dans la décision officielle (2026-11-04) ───────────────────
-- Convention inchangée : borne haute retenue quand un palier ou une fourchette
-- n'est pas modélisé ; taux de garde exprimés par période de prélèvement.

-- Hudson & Cie — PAMF-UMOA/2023/002 du 16/01/2023 (était : agrégé SikaFinance)
update public.sgi_frais set
  confiance = 'homologue_crepmf',
  courtage_pct_min = 0.5, courtage_pct_max = 1.0, minimum_perception = null,
  droits_garde_pct_min = 0.24, droits_garde_pct_max = 0.33, droits_garde_frequence = 'annuel', droits_garde_minimum = null,
  tenue_compte_montant = 0, tenue_compte_frequence = 'annuel',
  gestion_sous_mandat_pct_min = 1.5, gestion_sous_mandat_pct_max = 2.0,
  source_url = 'https://www.brvm.org/sites/default/files/20230118_-_decision_ndegpamf-umoa_-2023_-002_-_homologation_des_tarifs_de_la_sgi_hudson_cie.pdf',
  source_label = 'Décision PAMF-UMOA/2023/002 du 16/01/2023 (homologation des tarifs, PDF brvm.org)',
  verifie_le = date '2026-11-04', updated_at = now(),
  notes = 'Courtage [0,5-1,8 %] : max 1 % pour les clients de la zone UEMOA, 1,8 % hors UEMOA ; dossier [0,3-0,8 %] ; conservation 0,33 % (≤ 500 M FCFA), 0,27 % (500 M-1 Md), 0,24 % (> 1 Md), périodicité non précisée dans la décision (annuelle retenue) ; tenue de compte néant ; mandat [1,5-2 %] ; transfert 20 000 FCFA/ligne. Dépôt minimum : hors décision.'
where sgi_nom = 'Hudson & Cie';

-- Phoenix Capital Management — PAMF-UMOA/2025/264 du 22/07/2025 (abroge PCR/SG/DA/2022/045)
update public.sgi_frais set
  confiance = 'homologue_crepmf',
  courtage_pct_min = null, courtage_pct_max = 1.0, minimum_perception = null,
  droits_garde_pct_min = null, droits_garde_pct_max = 0.4, droits_garde_frequence = 'annuel', droits_garde_minimum = 1500,
  tenue_compte_montant = 2500, tenue_compte_frequence = 'annuel',
  gestion_sous_mandat_pct_min = null, gestion_sous_mandat_pct_max = 2.0,
  source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_264_-_2025_-_homologation_des_tarifs_de_la_sgi_phoenix_capital_management_pcm.pdf',
  source_label = 'Décision PAMF-UMOA/2025/264 du 22/07/2025 (homologation des tarifs, PDF brvm.org)',
  verifie_le = date '2026-11-04', updated_at = now(),
  notes = 'Courtage 1 % HT ; acheté/vendu [0,3-0,75 %] HT ; dossier 0,81 % HT ; conservation 0,4 % HT, minimum 1 500 F HT (périodicité non précisée dans la décision : annuelle retenue) ; tenue 2 500 HT/an (PP), 5 000 HT/an (PM) ; mandat 2 % HT ; transfert 17 500 HT (PP) / 30 000 HT (PM) ; clôture 15 000 HT (PP) ; bourse en ligne 2 500 HT/trimestre. Dépôt minimum : hors décision.'
where sgi_nom = 'Phoenix Capital Management';

-- SGI Niger — PAMF-UMOA/2025/345 du 19/12/2025 (abroge 2012-047)
update public.sgi_frais set
  confiance = 'homologue_crepmf',
  courtage_pct_min = null, courtage_pct_max = 1.0, minimum_perception = null,
  droits_garde_pct_min = null, droits_garde_pct_max = 0.25, droits_garde_frequence = 'annuel', droits_garde_minimum = null,
  tenue_compte_montant = 1500, tenue_compte_frequence = 'trimestriel',
  gestion_sous_mandat_pct_min = null, gestion_sous_mandat_pct_max = 1.0,
  source_url = 'https://www.brvm.org/sites/default/files/decision_n345_sgi-niger_homologation_des_tarifs.pdf',
  source_label = 'Décision PAMF-UMOA/2025/345 du 19/12/2025 (homologation des tarifs, PDF brvm.org)',
  verifie_le = date '2026-11-04', updated_at = now(),
  notes = 'Courtage max 1 % ; acheté/vendu max 1 % ; dossier max 0,8 % ; conservation max 0,25 %/an ; tenue 1 500 FCFA/trimestre ; mandat max 1 % ; transfert 5 000 FCFA ; bourse en ligne 2 000 FCFA/trimestre ; ouverture 10 000 (PP) / 20 000 (PM) ; clôture 15 000 FCFA.'
where sgi_nom = 'SGI Niger';

-- SGI Togo — P-AMF-UMOA/2025/289 du 05/09/2025 (abroge 2012-017)
update public.sgi_frais set
  confiance = 'homologue_crepmf',
  courtage_pct_min = null, courtage_pct_max = 1.0, minimum_perception = null,
  droits_garde_pct_min = null, droits_garde_pct_max = 0.095, droits_garde_frequence = 'trimestriel', droits_garde_minimum = null,
  tenue_compte_montant = 2000, tenue_compte_frequence = 'annuel',
  gestion_sous_mandat_pct_min = null, gestion_sous_mandat_pct_max = 0.8,
  source_url = 'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa-2025-289_-_homologation_des_tarifs_de_la_sgi_togo.pdf',
  source_label = 'Décision P-AMF-UMOA/2025/289 du 05/09/2025 (homologation des tarifs, PDF brvm.org)',
  verifie_le = date '2026-11-04', updated_at = now(),
  notes = 'Courtage max 1 % HT ; dossier max 0,81 % HT ; acheté/vendu max 1 % HT ; conservation 0,095 % HT/trimestre (0,38 %/an) ; tenue 2 000 HT/an (PP), 3 500 HT/an (PM) ; mandat 0,2 % HT/trimestre (0,8 %/an) ; transfert 10 000 HT ; ouverture 10 000 HT ; bourse en ligne gratuite.'
where sgi_nom = 'SGI Togo';

-- CGF Bourse — PCR/DA/2018/061 du 20/02/2018 : chiffres inchangés, source rectifiée
update public.sgi_frais set
  source_url = 'https://www.brvm.org/sites/default/files/decision_pcr_da_2018_061_cgf_bourse_homologation_tarifs_2018_002.pdf',
  source_label = 'Décision PCR/DA/2018/061 du 20/02/2018 (homologation des tarifs, PDF brvm.org)',
  verifie_le = date '2026-11-04', updated_at = now()
where sgi_nom = 'CGF Bourse';

-- SA2IF — PAMF-UMOA/2026/302 du 04/09/2026 (remplace la 009/2023)
update public.sgi_frais set
  confiance = 'homologue_crepmf',
  courtage_pct_min = null, courtage_pct_max = 1.0, minimum_perception = null,
  droits_garde_pct_min = null, droits_garde_pct_max = 0.125, droits_garde_frequence = 'trimestriel', droits_garde_minimum = null,
  tenue_compte_montant = 2000, tenue_compte_frequence = 'trimestriel',
  gestion_sous_mandat_pct_min = null, gestion_sous_mandat_pct_max = 2.0,
  source_url = 'https://www.brvm.org/sites/default/files/20260914_-_decision_pamf-umoa-2026-302_-_homologation_des_tarifs_de_la_sgi_sa2if.pdf',
  source_label = 'Décision PAMF-UMOA/2026/302 du 04/09/2026 (homologation des tarifs, PDF brvm.org)',
  verifie_le = date '2026-11-04', updated_at = now(),
  notes = 'Courtage max 1 % HT ; acheté/vendu max 1 % HT ; dossier max 0,81 % HT ; conservation max 0,125 % HT/trimestre ; tenue 2 000 FCFA/trimestre ; mandat max 0,5 %/trimestre (2 %/an) ; transfert 15 000 FCFA/ligne ; ouverture gratuite ; clôture 15 000 FCFA ; bourse en ligne gratuite.'
where sgi_nom = 'SOCIÉTÉ AFRICAINE D''INGÉNIERIE ET D''INTERMÉDIATION FINANCIÈRE (SA2IF)';

-- SOGEBOURSE devient Société Générale Capital Securities West Africa —
-- PAMF-UMOA/2023/112. L'ancienne ligne venait d'une grille antérieure.
update public.sgi_frais set
  sgi_nom = 'Société Générale Capital Securities West Africa',
  confiance = 'homologue_crepmf',
  courtage_pct_min = null, courtage_pct_max = 0.8, minimum_perception = 1000,
  droits_garde_pct_min = 0.065, droits_garde_pct_max = 0.125, droits_garde_frequence = 'trimestriel', droits_garde_minimum = 1250,
  tenue_compte_montant = 0, tenue_compte_frequence = 'annuel',
  gestion_sous_mandat_pct_min = 0.8, gestion_sous_mandat_pct_max = 2.0,
  source_url = 'https://www.brvm.org/sites/default/files/20230405_-_homologation_des_tarifs_de_la_sgi_societe_generale_capital_securities_west_africa_sgcswa.pdf',
  source_label = 'Décision PAMF-UMOA/2023/112 (homologation des tarifs, PDF brvm.org)',
  verifie_le = date '2026-11-04', updated_at = now(),
  notes = 'Courtage achat/vente 0,8 % max, minimum 1 000 FCFA ; dossier 0,8 % max (min 1 000) ; garde des clients ordinaires 0,5 %/an jusqu''à 10 M FCFA, 0,26 %/an au-delà, minimum 1 250 FCFA/trimestre (saisis par trimestre : 0,125 % / 0,065 %) ; aucune ligne de tenue de compte dans la décision ; mandat [0,8-2 %]/an (personnes physiques) ; transfert 0,5 % du portefeuille, min 10 000, max 34 375 FCFA.'
where sgi_nom = 'SOGEBOURSE';

-- One Africa Markets Côte d'Ivoire — PAMF-UMOA/2026/198 du 26/06/2026 (absente jusqu'ici)
insert into public.sgi_frais (
  sgi_nom, confiance, courtage_pct_max, droits_garde_pct_max, droits_garde_frequence,
  tenue_compte_montant, tenue_compte_frequence, gestion_sous_mandat_pct_max,
  source_url, source_label, verifie_le, notes
) values (
  'ONE AFRICA MARKETS (OAM CI)', 'homologue_crepmf', 0.8, 0.5, 'annuel',
  15625, 'annuel', 2.0,
  'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa-198-2026_-_homologation_des_tarifs_de_la_sgi_one_africa_markets_cote_divoire.pdf',
  'Décision PAMF-UMOA/2026/198 du 26/06/2026 (homologation des tarifs, PDF brvm.org)',
  date '2026-11-04',
  'Courtage max 0,80 % HT ; acheté/vendu max 0,75 % HT ; dossier max 0,81 % HT ; conservation max 0,5 % HT/an ; tenue max 15 625 FCFA/an ; mandat max 2 % HT/an ; transfert max 34 375 FCFA/ligne ; ouverture gratuite ; clôture max 15 000 FCFA ; bourse en ligne 1 000 HT/mois (PP), 2 000 HT/mois (PM).'
) on conflict (sgi_nom) do nothing;

-- Image Finances Internationales — PAMF-UMOA/2024/346 du 26/12/2024 (absente jusqu'ici)
insert into public.sgi_frais (
  sgi_nom, confiance, courtage_pct_min, courtage_pct_max, droits_garde_pct_max, droits_garde_frequence,
  tenue_compte_montant, tenue_compte_frequence, gestion_sous_mandat_pct_max,
  source_url, source_label, verifie_le, notes
) values (
  'Images Finances Internationales', 'homologue_crepmf', 0.2, 0.75, 0.125, 'trimestriel',
  1000, 'trimestriel', 0.5,
  'https://www.brvm.org/sites/default/files/decision_ndegpamf-umoa_-_346_-_2024_-_homologation_des_tarifs_de_la_sgi_ifi.pdf',
  'Décision PAMF-UMOA/2024/346 du 26/12/2024 (homologation des tarifs, PDF brvm.org)',
  date '2026-11-04',
  'Courtage par paliers de montant : 0,2 % sous 100 M FCFA, 0,75 % de 100 à 500 M, 0,5 % au-delà (palier non modélisé : borne haute retenue) ; dossier 0,25 % (≤ 5 Md), 0,20 % (5-15 Md), 0,5 % (> 15 Md) ; conservation 0,125 %/trimestre ; tenue 1 000 FCFA/trimestre (PP), 2 000 (PM) ; mandat 0,5 %/an ; transfert 10 000 (PP) / 25 000 (PM) FCFA.'
) on conflict (sgi_nom) do nothing;

commit;

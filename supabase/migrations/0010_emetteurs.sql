-- ============================================================================
-- BRVM Analyst Pro — Migration 0010 : référentiel émetteurs BDFIN
-- Source : liste officielle bfin.brvm.org (Code Emetteur + Désignation)
-- Permet de lier les obligations à leur émetteur via code_emetteur.
-- ============================================================================

create table if not exists public.brvm_emetteurs (
  code_emetteur  integer primary key,
  designation    text    not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.brvm_emetteurs is
  'Référentiel des émetteurs BRVM (code numérique BDFIN → dénomination officielle).';

-- RLS : lecture publique, écriture réservée au service_role.
alter table public.brvm_emetteurs enable row level security;
drop policy if exists "lecture publique emetteurs" on public.brvm_emetteurs;
create policy "lecture publique emetteurs"
  on public.brvm_emetteurs for select using (true);

-- Lien optionnel depuis brvm_obligations_daily vers le référentiel.
alter table public.brvm_obligations_daily
  add column if not exists code_emetteur integer references public.brvm_emetteurs(code_emetteur) on update cascade;

create index if not exists idx_obl_emetteur
  on public.brvm_obligations_daily (code_emetteur);

-- trigger updated_at
drop trigger if exists trg_emetteurs_updated on public.brvm_emetteurs;
create trigger trg_emetteurs_updated before update on public.brvm_emetteurs
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SEED : 130 émetteurs officiels BDFIN (source : bfin.brvm.org/emetteurs)
-- ============================================================================
insert into public.brvm_emetteurs (code_emetteur, designation) values
  (1145, 'ADDOHA CI'),
  (1080, 'Agence Française de Développement'),
  (1040, 'AIR LIQUIDE CI'),
  (1144, 'AMSA REALTY SA'),
  (1164, 'APRIL OIL BURKINA SA'),
  (1115, 'BACI-COBACI'),
  (1057, 'Bank Of Africa - Bénin'),
  (1076, 'Bank Of Africa - Burkina Faso'),
  (1083, 'Bank Of Africa - Côte d''Ivoire'),
  (1077, 'Bank Of Africa - Mali'),
  (1063, 'Bank Of Africa - Niger'),
  (1082, 'Bank of Africa - Sénégal'),
  (1087, 'Banque de l''Habitat du Bénin'),
  (1062, 'Banque de l''habitat du Mali'),
  (1139, 'Banque de l''Habitat du Sénégal'),
  (1072, 'Banque d''Investissement et Développement de la Cedeao'),
  (1000, 'Banque Internationale pour le Commerce et l''Industrie de Côte d''Ivoire'),
  (1166, 'BANQUE INTERNATIONALE POUR L''INDUSTRIE ET LE COMMERCE'),
  (1038, 'Banque Ouest Africaine de Développement'),
  (1141, 'BENIN PETRO SA'),
  (1003, 'BERNABE Côte d''Ivoire'),
  (1010, 'BOLLORE TRANSPORT & LOGISTICS Côte d''Ivoire'),
  (1159, 'BRIGDE BANK GROUPE CI'),
  (1056, 'Caisse Autonome d''Amortissement - Benin'),
  (1086, 'CAISSE REGIONALE DE REFINANCEMENT HYPOTHECAIRE DE L''UEMOA'),
  (1137, 'CBAO GROUPE ATTIJARIWAFA BANK'),
  (1065, 'Celtel Burkina Faso'),
  (1088, 'Central Bank'),
  (1027, 'Centre d''Edition et de Diffusion Africaines'),
  (1097, 'COLINA PARTICIPATIONS'),
  (1116, 'COLINA PARTICIPATIONS'),
  (1064, 'Communauté Electrique du Bénin'),
  (1004, 'Compagnie Française de l''Afrique Occidentale de Côte d''Ivoire'),
  (1020, 'Compagnie Ivoirienne d''Electricité'),
  (1103, 'Compagnie Sénégalaise D''industries'),
  (1101, 'Corfitex Trading Limited Sénégal'),
  (1128, 'CORIS BANK INETRNATIONAL'),
  (1117, 'CORIS BANK INTERNATIONAL'),
  (1136, 'CORIS HOLDING SA'),
  (1165, 'CORIS INVEST GROUP SA'),
  (1102, 'Côte D''ivoire Telecom'),
  (1126, 'DEKELOIL COTE D''IVOIRE'),
  (1149, 'DEPOSITAIRE CENTRAL/BANQUE DE REGLEMENT'),
  (1114, 'ECOBANK BURKINA'),
  (1092, 'ECOBANK CI'),
  (1104, 'Ecobank Sénégal'),
  (1070, 'Ecobank Transnational Incorporated'),
  (1143, 'EMERGENCE PLAZA S.A'),
  (1135, 'ENTREPRISE NATIONALE DU BATIMEMENT ET DES TP'),
  (1124, 'ETAT DU MALI'),
  (1129, 'ETAT DU NIGER'),
  (1071, 'ETAT du Togo'),
  (1069, 'ETATdu Sénégal'),
  (1105, 'Fan Milk Togo'),
  (1162, 'FCTC ATOM PHARMA COMPARTIMENT DPCI'),
  (1134, 'FCTC COFINA'),
  (1171, 'FCTC CROISSANCE AGRICOLE'),
  (1160, 'FCTC CROISSANCE ATLANTIQUE'),
  (1133, 'FCTC ENERGIE'),
  (1156, 'FCTC ENERGIE POUR TOUS'),
  (1167, 'FCTC FS YAKAAR'),
  (1169, 'FCTC KEUR SAMBA NSIA BANQUE BENIN'),
  (1140, 'FCTC NSIA BANQUE CI'),
  (1170, 'FCTC SENELEC'),
  (1168, 'FCTC SONABHY'),
  (1158, 'FCTC SONATEL'),
  (1157, 'FIDELIS FINANCE'),
  (1021, 'Filature, Tissage, Sacs'),
  (1151, 'FOCUS IMMOBILIER SA'),
  (1084, 'Gestion des Stocks Pétrolier de CI'),
  (1120, 'GROUPE AZALAÏ HOTELS'),
  (1150, 'Groupe EDK S.A. (anciennement EDK OIL S.A.)'),
  (1106, 'L''africaine Des Assurances'),
  (1161, 'LOTERIE NATIONALE DU BENIN'),
  (1123, 'MANUTENTION - TRANSIT - TRANSPORT'),
  (1130, 'MICROCRED'),
  (1118, 'MONEY EXPRESS'),
  (1030, 'MOVIS - Société Ivoirienne d''Opérations Maritimes'),
  (1052, 'NEI-CEDA CI'),
  (1014, 'NESTLE Côte d''Ivoire'),
  (1154, 'NOURMONY HOLDING'),
  (1113, 'Nouvelle Entreprise Salif Kossouka Ouedraogo'),
  (1132, 'NSIA BANQUE CI'),
  (1095, 'NSIA PARTICIPATIONS'),
  (1068, 'Office National des Télécommunications du Burkina'),
  (1094, 'OMNIUM MALI'),
  (1138, 'ORAGROUP S.A'),
  (1090, 'ORAGROUP SA'),
  (1146, 'ORANGE COTE D''IVOIRE'),
  (1119, 'OUTSPAN'),
  (1050, 'PALM CI'),
  (1163, 'PALMAFRIQUE S.A.'),
  (1093, 'PETRO IVOIRE'),
  (1096, 'Peyrissac Cote D''ivoire'),
  (1085, 'Port Autonome d''Abidjan'),
  (1067, 'Port Autonome de Dakar'),
  (1107, 'Sampana Sau'),
  (1153, 'SANCFIS FASO SA'),
  (1051, 'SERVAIR ABIDJAN'),
  (1089, 'SIFCA S.A'),
  (1112, 'Simat'),
  (1155, 'SIMPA SA'),
  (1001, 'Société Africaine de Crédit Automobile'),
  (1006, 'Société Africaine de Représentations Industrielles'),
  (1031, 'Société Africaine des Plantations d''Hévéas'),
  (1108, 'Société Béninoise D''energie Electrique'),
  (1110, 'Société Burkinabé Des Fibres Textiles'),
  (1100, 'Société D'' Electricité Du Sénégal S.a'),
  (1152, 'SOCIETE DE DEOUANEMENT MARITIMES & AEROPORTUAIRE (SDMA S.A)'),
  (1019, 'Société de Distribution d'' Eau de la Côte d''Ivoire'),
  (1042, 'Société de Limonaderies et Brasseries d''Afrique'),
  (1148, 'SOCIETE DE LOGISTIQUE ET D''EXPLOITATION AGRICOLE'),
  (1147, 'SOCIETE DE TRAVAUX ET DE COMMERCE'),
  (1033, 'Société de Trituration de Graines Oléagineuses'),
  (1079, 'Société d''équipement du Mali'),
  (1029, 'Société des Caoutchoucs de Grand Bereby'),
  (1078, 'Société des Transports Abidjanais'),
  (1018, 'Société d''Etudes et de Travaux pour l''Afrique de l''Ouest'),
  (1073, 'Société Financière Internationale'),
  (1002, 'Société Générale Côte d''Ivoire'),
  (1032, 'Société Ivoirenne d''Emballages Métalliques'),
  (1125, 'SOCIETE IVOIRIENNE DE BANQUE'),
  (1025, 'Société Ivoirienne de Câbles'),
  (1022, 'Société Ivoirienne de Coco Râpé'),
  (1109, 'Société Ivoirienne De Raffinage'),
  (1012, 'Société Ivoirienne des Tabacs'),
  (1099, 'Société Ivoirienne D''oxygène Et D''acétylène'),
  (1028, 'Société Multinationale de Bitumes'),
  (1037, 'Société Nationale des Télécommunications du Sénégal'),
  (1059, 'Société pour l''Habitat et le Logement Territorial en Afrique'),
  (1121, 'SOMAPP'),
  (1127, 'SUCRIVOIRE'),
  (1111, 'Telecel Faso S.a'),
  (1142, 'TEYLIOM GROUP.CI'),
  (1081, 'TOGO TELECOM'),
  (1008, 'TOTAL Côte d''Ivoire'),
  (1098, 'TOTAL SENEGAL S.A.'),
  (1122, 'TOTAL SENEGAL S.A.'),
  (1005, 'Tractafric Motors Côte d''Ivoire'),
  (1049, 'Trésor Public de Côte d''Ivoire'),
  (1131, 'TRESOR PUBLIC DU BENIN'),
  (1060, 'Trésor Public du Burkina Faso'),
  (1011, 'UNILEVER Côte d''Ivoire'),
  (1016, 'UNIWAX'),
  (1026, 'VIVO ENERGY Côte d''Ivoire')
on conflict (code_emetteur) do update
  set designation = excluded.designation,
      updated_at  = now();

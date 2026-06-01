export type PublicationType = 'etats_financiers' | 'ag' | 'rapport' | 'bilan' | 'notation' | 'avis' | 'autre';

export interface Publication {
  code: string;
  date_publication: string;
  libelle: string;
  type_publication: PublicationType;
  source_url: string | null;
  source: 'bdfin';
  dedupe_hash: string;
}

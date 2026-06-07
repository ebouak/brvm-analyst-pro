export interface ParsedNotation {
  agence: string;
  note: string;
  perspective: string;
  date_notation: string;  // ISO "YYYY-MM-DD"
  source_url: string;
}

export interface NotationsResult {
  updated: number;
  skipped: number;
  errors: number;
}

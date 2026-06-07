export interface NotationHistoryEntry {
  note: string;
  court_terme: string | null;
  long_terme: string | null;
  perspective: string;
  date_notation: string;
}

export interface ParsedNotation {
  agence: string;
  note: string;
  perspective: string;
  court_terme: string | null;
  long_terme: string | null;
  date_notation: string;  // ISO "YYYY-MM-DD"
  source_url: string;
  history: NotationHistoryEntry[];  // up to 3 most recent, newest first
}

export interface NotationsResult {
  updated: number;
  skipped: number;
  errors: number;
}

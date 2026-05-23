export interface Dividend {
  code: string;
  exercice: number | null;
  ex_date: string | null;       // YYYY-MM-DD
  payment_date: string | null;
  montant: number;              // dividende par action (FCFA)
  devise: string;
  source: string | null;
  source_url: string | null;
}

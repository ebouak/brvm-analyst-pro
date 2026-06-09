export interface TickItem {
  sym: string;
  val: string;
  dir: 'up' | 'down';
  pct: string;
}

export interface IndexCard {
  name: string;
  value: string;
  move: string;
  dir: 'up' | 'down';
  desc: string;
  featured?: boolean;
}

export interface Mover {
  sym: string;
  pct: string;
  price: string;
  dir: 'up' | 'down';
}

export interface SignalRow {
  action: 'BUY' | 'HOLD' | 'SELL';
  code: string;
  title: string;
  score: number;
}

export interface ScreenerPreset {
  name: string;
  label: string;
  isPremium: boolean;
  filters: {
    rsiMin?: number;
    rsiMax?: number;
    volumeGtAvg?: boolean;
    scoreMin?: number;
    secteur?: string;
    dividendMin?: number;
  };
}

export const PRESETS: ScreenerPreset[] = [
  {
    name: 'oversold',
    label: 'Survendu (RSI<30)',
    isPremium: false,
    filters: { rsiMax: 30, scoreMin: 40 },
  },
  {
    name: 'high_div',
    label: 'Haut dividende (>3%)',
    isPremium: false,
    filters: { dividendMin: 3 },
  },
  {
    name: 'volume',
    label: 'Fort volume',
    isPremium: false,
    filters: { volumeGtAvg: true, scoreMin: 50 },
  },
  {
    name: 'growth',
    label: 'Growth UEMOA',
    isPremium: true,
    filters: { rsiMin: 40, rsiMax: 70, scoreMin: 60 },
  },
  {
    name: 'value',
    label: 'Value hunting',
    isPremium: true,
    filters: { rsiMax: 35, dividendMin: 2, scoreMin: 55 },
  },
];

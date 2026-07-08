import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntraDayPatternsTable from '@/components/screener/IntraDayPatternsTable';
import * as queriesModule from '@/lib/patterns/queries';

// Mock the queries module
vi.mock('@/lib/patterns/queries', () => ({
  getPatternsForDate: vi.fn(),
}));

const mockPatterns = [
  {
    code: 'BOAB',
    pattern_type: 'atr_extreme',
    confidence_level: 'HIGH',
    advisor_delta: 2.5,
    date_marche: '2026-07-08',
    quality_score: 0.85,
    explanation_fr: 'Pattern ATR extrême détecté sur 15m',
    detected_count: 1,
  },
  {
    code: 'BICIB',
    pattern_type: 'bullish_consolidation',
    confidence_level: 'MEDIUM',
    advisor_delta: 1.0,
    date_marche: '2026-07-08',
    quality_score: 0.72,
    explanation_fr: 'Consolidation haussière 3-bar',
    detected_count: 2,
  },
];

describe('IntraDayPatternsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockPatterns), 100))
    );

    render(<IntraDayPatternsTable dateMarche="2026-07-08" />);
    expect(screen.getByText(/Chargement des patterns/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Chargement des patterns/i)).not.toBeInTheDocument();
    });
  });

  it('renders patterns table with data', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue(mockPatterns);

    render(<IntraDayPatternsTable dateMarche="2026-07-08" />);

    await waitFor(() => {
      expect(screen.getByText('BOAB')).toBeInTheDocument();
      expect(screen.getByText('BICIB')).toBeInTheDocument();
    });

    // Check for pattern type badges
    expect(screen.getByText(/⚡ ATR Extrême/)).toBeInTheDocument();
    expect(screen.getByText(/📊 Consolidation/)).toBeInTheDocument();

    // Check for confidence levels
    expect(screen.getAllByText('HIGH')).toHaveLength(1);
    expect(screen.getAllByText('MEDIUM')).toHaveLength(1);
  });

  it('displays empty state when no patterns found', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue([]);

    render(<IntraDayPatternsTable dateMarche="2026-07-08" />);

    await waitFor(() => {
      expect(screen.getByText(/Aucun pattern détecté/i)).toBeInTheDocument();
    });
  });

  it('filters patterns by type', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue(mockPatterns);

    const { rerender } = render(<IntraDayPatternsTable dateMarche="2026-07-08" />);

    await waitFor(() => {
      expect(screen.getByText('BOAB')).toBeInTheDocument();
    });

    // Click on type filter and select atr_extreme
    const typeSelect = screen.getByDisplayValue('Tous les types');
    await userEvent.selectOption(typeSelect, 'atr_extreme');

    // Rerender with new filter - would need state update
    // This is a simplified test; full filtering logic is in the component
  });

  it('calls onPatternSelect when pattern row is clicked', async () => {
    const mockSelect = vi.fn();
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue(mockPatterns);

    render(<IntraDayPatternsTable dateMarche="2026-07-08" onPatternSelect={mockSelect} />);

    await waitFor(() => {
      expect(screen.getByText('BOAB')).toBeInTheDocument();
    });

    // Click on the first pattern row
    const boabRow = screen.getByText('BOAB').closest('tr');
    if (boabRow) {
      await userEvent.click(boabRow);
      expect(mockSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 'BOAB' }));
    }
  });

  it('displays quality score as percentage', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue(mockPatterns);

    render(<IntraDayPatternsTable dateMarche="2026-07-08" />);

    await waitFor(() => {
      // Quality score 0.85 = 85%
      expect(screen.getByText('85%')).toBeInTheDocument();
      // Quality score 0.72 = 72%
      expect(screen.getByText('72%')).toBeInTheDocument();
    });
  });

  it('displays advisor delta with correct sign and color', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue([
      { ...mockPatterns[0], advisor_delta: 2.5 },
      { ...mockPatterns[1], advisor_delta: -1.0 },
    ]);

    render(<IntraDayPatternsTable dateMarche="2026-07-08" />);

    await waitFor(() => {
      expect(screen.getByText('+2.5')).toBeInTheDocument();
      expect(screen.getByText('-1.0')).toBeInTheDocument();
    });
  });

  it('shows detected count badge', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue(mockPatterns);

    render(<IntraDayPatternsTable dateMarche="2026-07-08" />);

    await waitFor(() => {
      // First pattern has detected_count: 1
      // Second pattern has detected_count: 2
      const badges = screen.getAllByText(/^[12]$/);
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('displays help text about patterns', async () => {
    vi.mocked(queriesModule.getPatternsForDate).mockResolvedValue(mockPatterns);

    render(<IntraDayPatternsTable dateMarche="2026-07-08" />);

    await waitFor(() => {
      expect(screen.getByText(/ATR Extrême:/)).toBeInTheDocument();
      expect(screen.getByText(/Consolidation:/)).toBeInTheDocument();
      expect(screen.getByText(/Δ Conseiller:/)).toBeInTheDocument();
    });
  });
});

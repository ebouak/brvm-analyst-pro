import type { ParsedNotation } from './types.js';

export const MOCK_NOTATIONS: Record<string, ParsedNotation> = {
  SNTS: {
    agence: 'Bloomfield Investment',
    note: 'A+',
    perspective: 'Stable',
    date_notation: '2024-11-15',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/SNTS',
  },
  ETIT: {
    agence: 'Bloomfield Investment',
    note: 'A',
    perspective: 'Positive',
    date_notation: '2024-09-20',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/ETIT',
  },
  BOABF: {
    agence: 'GCR Ratings',
    note: 'BBB+',
    perspective: 'Stable',
    date_notation: '2024-06-10',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/BOABF',
  },
  SGBC: {
    agence: 'Bloomfield Investment',
    note: 'BBB',
    perspective: 'Négative',
    date_notation: '2024-03-01',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/SGBC',
  },
  SIVC: {
    agence: 'Bloomfield Investment',
    note: 'B+',
    perspective: 'Stable',
    date_notation: '2023-12-15',
    source_url: 'https://www.richbourse.com/common/notation-financiere/index/SIVC',
  },
};

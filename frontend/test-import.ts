import PortfolioPositions from '@/components/portfolio/PortfolioPositions';
import type { Position } from '@/lib/portfolio/queries';

const positions: Position[] = [];
const onUpdate = (p: Position) => {};

// This would be used as:
// <PortfolioPositions positions={positions} onUpdate={onUpdate} />

console.log('Import successful');

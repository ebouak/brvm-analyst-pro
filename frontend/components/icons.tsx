// Micro-icônes SVG inline — zéro dépendance externe
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 14) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export function TrendingUp({ size = 14, ...p }: P) {
  return <svg {...base(size)} {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
}
export function TrendingDown({ size = 14, ...p }: P) {
  return <svg {...base(size)} {...p}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
}
export function Minus({ size = 14, ...p }: P) {
  return <svg {...base(size)} {...p}><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
export function Activity({ size = 14, ...p }: P) {
  return <svg {...base(size)} {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}
export function BarChart3({ size = 14, ...p }: P) {
  return <svg {...base(size)} {...p}><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>;
}
export function ChevronLeft({ size = 14, ...p }: P) {
  return <svg {...base(size)} {...p}><polyline points="15 18 9 12 15 6"/></svg>;
}
export function ChevronRight({ size = 14, ...p }: P) {
  return <svg {...base(size)} {...p}><polyline points="9 18 15 12 9 6"/></svg>;
}

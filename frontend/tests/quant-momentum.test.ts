import { describe, it, expect } from 'vitest';
import { computeMomentumFactors, scorePriceMomentum, computeAnnualizedVol } from '@/lib/quant/price-momentum';

function closesTrend(up=true, n=260){ const a:number[]=[]; let p=100; for(let i=0;i<n;i++){ p+= up?0.2:-0.2; a.push(p);} return a; }

describe('price-momentum', () => {
  it('hausse régulière => score haut', () => {
    const c = closesTrend(true, 260);
    const f = computeMomentumFactors(c);
    const { score } = scorePriceMomentum({ ...f, liquidityScore: 80, annualizedVol: 0.15 });
    expect(score!).toBeGreaterThan(50);
  });
  it('baissier => score bas', () => {
    const c = closesTrend(false, 260);
    const f = computeMomentumFactors(c);
    const { score } = scorePriceMomentum({ ...f, liquidityScore: 80 });
    expect(score!).toBeLessThan(50);
  });
  it('données insuffisantes => null', () => {
    const { score } = scorePriceMomentum({ m12_1:null,m6m:null,m3m:null,high52wProximity:null,trendConfirmation:null,liquidityScore:80 });
    expect(score).toBeNull();
  });
  it('proche 52w haut', () => {
    const c = closesTrend(true, 260);
    const f = computeMomentumFactors(c); expect(f.high52wProximity).toBeCloseTo(1,1);
  });
  it('pénalité liquidité', () => {
    const c = closesTrend(true, 260); const f=computeMomentumFactors(c);
    const a=scorePriceMomentum({...f,liquidityScore:80}); const b=scorePriceMomentum({...f,liquidityScore:20});
    expect((b.score ?? 0)).toBeLessThan(a.score ?? 100);
  });
  it('pénalité volatilité top 5%', () => {
    const c = closesTrend(true, 260); const f=computeMomentumFactors(c);
    const peers = Array.from({length:20},()=>0.2);
    const { score: s1 } = scorePriceMomentum({...f,liquidityScore:80, annualizedVol:0.9}, {volPeers:peers});
    const { score: s2 } = scorePriceMomentum({...f,liquidityScore:80, annualizedVol:0.1}, {volPeers:peers});
    expect(s1!).toBeLessThan(s2!);
  });
});

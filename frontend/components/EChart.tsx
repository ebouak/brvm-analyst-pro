'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { EChartsOption } from 'echarts';
import type { EChartsReactProps } from 'echarts-for-react';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  loading?: boolean;
  onEvents?: EChartsReactProps['onEvents'];
}

export default function EChart({ option, height = 320, className, loading, onEvents }: EChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const style = { height: typeof height === 'number' ? `${height}px` : height, width: '100%' };

  if (!mounted) return <div style={style} className={className} />;

  const baseTheme: EChartsOption = {
    backgroundColor: 'transparent',
    textStyle: { color: '#8b93a7', fontFamily: 'Inter, sans-serif' },
    grid: { top: 32, right: 16, bottom: 40, left: 56, containLabel: false },
    tooltip: {
      backgroundColor: '#161922',
      borderColor: '#232733',
      borderWidth: 1,
      textStyle: { color: '#e6e9f0', fontSize: 12 },
      axisPointer: { type: 'cross', lineStyle: { color: '#4a5268' } },
    },
    xAxis: {
      axisLine: { lineStyle: { color: '#232733' } },
      axisLabel: { color: '#8b93a7', fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisLabel: { color: '#8b93a7', fontSize: 11 },
      splitLine: { lineStyle: { color: '#232733', type: 'dashed' } },
    },
  };

  const mergedOption = deepMerge(baseTheme, option);

  return (
    <ReactECharts
      option={mergedOption}
      style={style}
      className={className}
      showLoading={loading}
      loadingOption={{ color: '#00c853', maskColor: 'rgba(15,17,23,0.8)', text: '' }}
      onEvents={onEvents}
      notMerge
    />
  );
}

// Merge profond simple (option écrase le thème)
function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const bv = base[key];
    const ov = override[key];
    if (ov !== null && typeof ov === 'object' && !Array.isArray(ov) &&
        bv !== null && typeof bv === 'object' && !Array.isArray(bv)) {
      result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>) as T[keyof T];
    } else if (ov !== undefined) {
      result[key] = ov as T[keyof T];
    }
  }
  return result;
}

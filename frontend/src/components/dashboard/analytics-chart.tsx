'use client';

import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartDataPoint {
  label: string;
  value: number;
  date: string;
}

interface AnalyticsChartProps {
  title: string;
  description?: string;
  data: ChartDataPoint[];
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
}

export function AnalyticsChart({
  title,
  description,
  data,
  valuePrefix = '',
  valueSuffix = '',
  height = 160,
}: AnalyticsChartProps): ReactElement {
  const { trend, trendPercentage, latestValue, maxValue, minValue } = useMemo(() => {
    if (data.length < 2) {
      return {
        trend: 'neutral' as const,
        trendPercentage: 0,
        latestValue: data[0]?.value || 0,
        maxValue: data[0]?.value || 0,
        minValue: data[0]?.value || 0,
      };
    }

    const latest = data[data.length - 1].value;
    const previous = data[data.length - 2].value;
    const max = Math.max(...data.map(d => d.value));
    const min = Math.min(...data.map(d => d.value));

    const change = latest - previous;
    const percentage = previous !== 0 ? Math.abs((change / previous) * 100) : 0;

    return {
      trend: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'neutral' as const,
      trendPercentage: percentage,
      latestValue: latest,
      maxValue: max,
      minValue: min,
    };
  }, [data]);

  const pathData = useMemo(() => {
    if (data.length < 2) return '';

    const maxVal = maxValue;
    const minVal = minValue;
    const range = maxVal - minVal || 1;

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = ((maxVal - point.value) / range) * 80 + 10; // 10% padding top/bottom
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [data, maxValue, minValue]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';

  return (
    <Card className="border-white/10 bg-slate-900/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-slate-200">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs text-slate-400 mt-1">{description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
            <span className={`text-xs font-medium ${trendColor}`}>
              {trendPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-slate-50">
            {valuePrefix}{latestValue.toLocaleString()}{valueSuffix}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative" style={{ height }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgb(34, 197, 218)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgb(34, 197, 218)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Fill area */}
            {data.length > 1 && (
              <path
                d={`${pathData} L 100,90 L 0,90 Z`}
                fill="url(#chartGradient)"
              />
            )}

            {/* Line */}
            {data.length > 1 && (
              <path
                d={pathData}
                fill="none"
                stroke="rgb(34, 197, 218)"
                strokeWidth="0.5"
                className="drop-shadow-sm"
              />
            )}

            {/* Data points */}
            {data.map((point, index) => {
              // Guard against single-point datasets to avoid NaN for cx (index / (len - 1))
              const x = (index / Math.max(data.length - 1, 1)) * 100;
              const y = ((maxValue - point.value) / (maxValue - minValue || 1)) * 80 + 10;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="0.8"
                  fill="rgb(34, 197, 218)"
                  className="drop-shadow-sm"
                />
              );
            })}
          </svg>

          {/* Tooltip overlay */}
          <div className="absolute inset-0 flex items-end justify-between px-1 pb-1">
            {data.slice(0, 3).map((point, index) => (
              <div key={index} className="text-xs text-slate-500">
                {point.label}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
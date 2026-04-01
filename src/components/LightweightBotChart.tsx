'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createSeriesMarkers,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  LineSeries,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';
import { type BotDecisionEvent } from '@/lib/bot';

interface LightweightBotChartProps {
  symbol: string;
  decisionEvents: BotDecisionEvent[];
  timeframe?: '1Day' | '1Hour' | '15Min';
  range?: '1M' | '3M' | '6M' | '1Y';
  heightClassName?: string;
}

type AlpacaBarsPayload = {
  bars: Array<{
    time: string;
    close: number;
  }>;
};

const toChartTime = (timestampMillis: number): Time => Math.floor(timestampMillis / 1000) as Time;

const limitByTimeframe = (timeframe: '1Day' | '1Hour' | '15Min') => {
  switch (timeframe) {
    case '15Min':
      return 1000;
    case '1Hour':
      return 720;
    case '1Day':
    default:
      return 365;
  }
};

const dateWindowFromRange = (range: '1M' | '3M' | '6M' | '1Y') => {
  const end = new Date();
  const start = new Date(end);
  switch (range) {
    case '1M':
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
    case '3M':
      start.setUTCMonth(start.getUTCMonth() - 3);
      break;
    case '6M':
      start.setUTCMonth(start.getUTCMonth() - 6);
      break;
    case '1Y':
    default:
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      break;
  }
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toStrictlyAscendingLineData = (points: LineData[]): LineData[] => {
  const byTime = new Map<number, number>();
  for (const point of points) {
    byTime.set(Number(point.time), point.value);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as Time, value }));
};

export default function LightweightBotChart({
  symbol,
  decisionEvents,
  timeframe = '1Day',
  range = '1Y',
  heightClassName = 'h-[320px]',
}: LightweightBotChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [barsMode, setBarsMode] = useState<'loading' | 'alpaca' | 'fallback'>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: '#09090B' },
        textColor: '#A1A1AA',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.06)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.06)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.12)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.12)',
      },
      localization: {
        locale: 'en-US',
      },
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = lineSeries;

    return () => {
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const lineSeries = seriesRef.current;
    const chart = chartRef.current;
    if (!lineSeries || !chart || !symbol) {
      return;
    }

    const controller = new AbortController();
    setBarsMode('loading');

    const loadBars = async () => {
      try {
        const authorization = getAuthorizationHeader();
        if (!authorization) {
          throw new Error('Missing auth session');
        }
        const limit = limitByTimeframe(timeframe);
        const window = dateWindowFromRange(range);
        const response = await fetch(
          apiUrl(
            STOCK_SCREENER_BASE_URL,
            `/stock-screener/v1/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}&feed=iex&start=${encodeURIComponent(window.start)}&end=${encodeURIComponent(window.end)}`
          ),
          {
            headers: {
              Authorization: authorization,
            },
            signal: controller.signal,
            cache: 'no-store',
          }
        );
        if (!response.ok) {
          throw new Error('Unable to load Alpaca bars');
        }

        const payload = (await response.json()) as AlpacaBarsPayload;
        const barData = toStrictlyAscendingLineData(
          (payload.bars ?? [])
          .filter((bar) => typeof bar.time === 'string' && Number.isFinite(bar.close))
          .map((bar) => ({
            time: toChartTime(new Date(bar.time).getTime()),
            value: bar.close,
          }))
        );

        if (barData.length > 0) {
          lineSeries.setData(barData);
          setBarsMode('alpaca');
          chart.timeScale().fitContent();
          return;
        }
      } catch {
        // Fall back to decision-only line when Alpaca data is unavailable.
      }

      const fallback = toStrictlyAscendingLineData(
        [...decisionEvents]
        .sort((a, b) => a.timestamp_millis - b.timestamp_millis)
          .filter((event) => isFiniteNumber(event.price))
          .map((event) => ({
            time: toChartTime(event.timestamp_millis),
            value: event.price,
          }))
      );
      lineSeries.setData(fallback);
      setBarsMode('fallback');
      chart.timeScale().fitContent();
    };

    void loadBars();

    return () => {
      controller.abort();
    };
  }, [symbol, timeframe, range]);

  useEffect(() => {
    const lineSeries = seriesRef.current;
    const chart = chartRef.current;
    if (!lineSeries || !chart || barsMode !== 'fallback') {
      return;
    }

    const fallback = toStrictlyAscendingLineData(
      [...decisionEvents]
      .sort((a, b) => a.timestamp_millis - b.timestamp_millis)
      .filter((event) => isFiniteNumber(event.price))
      .map((event) => ({
        time: toChartTime(event.timestamp_millis),
        value: event.price,
      }))
    );
    lineSeries.setData(fallback);
    chart.timeScale().fitContent();
  }, [barsMode, decisionEvents]);

  useEffect(() => {
    const lineSeries = seriesRef.current;
    const chart = chartRef.current;
    if (!lineSeries || !chart) {
      return;
    }

    const sorted = [...decisionEvents].sort((a, b) => a.timestamp_millis - b.timestamp_millis);

    const markers: SeriesMarker<Time>[] = sorted
        .filter(
          (event) =>
            (event.action === 'buy' || event.action === 'sell') &&
            isFiniteNumber(event.price) &&
            isFiniteNumber(event.quantity)
        )
      .map((event) => ({
        time: toChartTime(event.timestamp_millis),
        position: event.action === 'buy' ? 'belowBar' : 'aboveBar',
        color: event.action === 'buy' ? '#22C55E' : '#EF4444',
        shape: event.action === 'buy' ? 'arrowUp' : 'arrowDown',
          text: `${event.action.toUpperCase()} ${isFiniteNumber(event.quantity) ? event.quantity.toFixed(2) : 'N/A'} @ ${isFiniteNumber(event.price) ? event.price.toFixed(2) : 'N/A'}`,
      }));
    createSeriesMarkers(lineSeries, markers);
  }, [decisionEvents]);

  return (
    <div className={`relative ${heightClassName} w-full overflow-hidden rounded-xl`}>
      <div ref={containerRef} className="h-full w-full" />
      {barsMode === 'loading' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">
          Loading bars for {symbol.toUpperCase()}...
        </div>
      ) : null}
      {barsMode === 'fallback' && decisionEvents.length > 0 ? (
        <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-yellow-400/40 bg-yellow-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-yellow-200">
          Fallback: decision prices
        </div>
      ) : null}
      {decisionEvents.length === 0 && barsMode !== 'loading' ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-gray-600/60 bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
          No buy/sell markers yet
        </div>
      ) : null}
    </div>
  );
}
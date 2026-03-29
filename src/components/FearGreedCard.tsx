'use client';

import { useEffect, useMemo, useState } from 'react';
import { STOCK_SCREENER_BASE_URL, apiUrl } from '@/lib/api';
import { getAuthorizationHeader } from '@/lib/authSession';

type FearGreedResponse = {
  value: number;
  classification: string;
  previous_close?: number;
  previous_1_week?: number;
  previous_1_month?: number;
  previous_1_year?: number;
  timeline?: {
    timestamp: number;
    value: number;
    rating: string;
  }[];
  source: string;
  fetched_at: string;
};

const classifyFearGreed = (value: number) => {
  if (value <= 24) return 'Extreme Fear';
  if (value <= 44) return 'Fear';
  if (value <= 55) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
};

const sentimentColor = (value: number) => {
  if (value <= 24) return 'text-red-600 dark:text-red-400';
  if (value <= 44) return 'text-orange-600 dark:text-orange-400';
  if (value <= 55) return 'text-yellow-600 dark:text-yellow-400';
  if (value <= 75) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-green-700 dark:text-green-300';
};

const sentimentStrokeHex = (value: number) => {
  if (value <= 24) return '#dc2626';
  if (value <= 44) return '#f97316';
  if (value <= 55) return '#eab308';
  if (value <= 75) return '#10b981';
  return '#16a34a';
};

const formatRating = (rating: string) =>
  rating
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function FearGreedCard() {
  const [data, setData] = useState<FearGreedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredTimelineIndex, setHoveredTimelineIndex] = useState<number | null>(null);

  useEffect(() => {
    let canceled = false;

    const fetchFearGreed = async () => {
      try {
        setError(null);
        const authorization = getAuthorizationHeader();
        if (!authorization) {
          throw new Error('Unauthorized. Please log in again.');
        }

        const response = await fetch(apiUrl(STOCK_SCREENER_BASE_URL, '/stock-screener/v1/sentiment/fear-greed'), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: authorization,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch Fear & Greed (${response.status})`);
        }

        const payload = (await response.json()) as FearGreedResponse;
        if (!canceled) {
          setData(payload);
        }
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    void fetchFearGreed();
    const timer = setInterval(fetchFearGreed, 5 * 60 * 1000);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, []);

  const gaugeValue = data?.value ?? 0;

  const timelinePoints = useMemo(() => {
    if (!data?.timeline || data.timeline.length < 2) {
      return [];
    }

    const timeline = data.timeline;

    return timeline.map((point, index) => {
      const x = 1 + (index / (timeline.length - 1)) * 91;
      const y = 46 - (Math.max(0, Math.min(100, point.value)) / 100) * 44;
      return {
        ...point,
        x,
        y,
      };
    });
  }, [data?.timeline]);

  const hoveredPoint =
    hoveredTimelineIndex != null && timelinePoints[hoveredTimelineIndex]
      ? timelinePoints[hoveredTimelineIndex]
      : null;

  useEffect(() => {
    if (timelinePoints.length === 0) {
      setHoveredTimelineIndex(null);
      return;
    }

    setHoveredTimelineIndex((current) => {
      if (current != null && current >= 0 && current < timelinePoints.length) {
        return current;
      }

      // Default to the most recent datapoint when the timeline first loads.
      return timelinePoints.length - 1;
    });
  }, [timelinePoints]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-black dark:text-white">Fear &amp; Greed Index</h3>
          {!loading && data && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {data.source === 'cnn-json' ? 'Real-time' : 'Historical'}
            </p>
          )}
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          CNN
        </span>
      </div>

      {loading && <p className="text-sm text-gray-600 dark:text-gray-400">Loading sentiment...</p>}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && data && (
        <>
          {/* Main value and classification */}
          <div className="mb-6 flex items-baseline gap-3">
            <span className={`text-5xl font-black ${sentimentColor(data.value)}`}>{data.value}</span>
            <span className={`text-lg font-semibold ${sentimentColor(data.value)}`}>{data.classification}</span>
          </div>

          {/* Horizontal gauge */}
          <div className="mb-8 space-y-2">
            {/* Gradient bar */}
            <div className="relative h-8 overflow-hidden rounded-full bg-gradient-to-r from-red-600 via-yellow-400 via-yellow-500 to-green-600 shadow-inner">
              {/* Pointer */}
              <div
                className="absolute top-0 h-full w-0.5 bg-gray-900 transition-all duration-300 dark:bg-white"
                style={{ left: `${(gaugeValue / 100) * 100}%` }}
              />
            </div>

            {/* Scale numbers */}
            <div className="flex justify-between px-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>

            {/* Zone labels */}
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>Extreme Fear</span>
              <span>Fear</span>
              <span>Neutral</span>
              <span>Greed</span>
              <span>Extreme Greed</span>
            </div>
          </div>

          {/* Historical comparison grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Previous Close', v: data.previous_close },
              { label: '1 Week Ago', v: data.previous_1_week },
              { label: '1 Month Ago', v: data.previous_1_month },
              { label: '1 Year Ago', v: data.previous_1_year },
            ].map(({ label, v }) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-gray-800/50">
                <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
                {v != null ? (
                  <>
                    <p className={`text-2xl font-bold ${sentimentColor(v)}`}>{v}</p>
                    <p className={`text-xs font-semibold ${sentimentColor(v)}`}>{classifyFearGreed(v)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">—</p>
                )}
              </div>
            ))}
          </div>

          {timelinePoints.length > 1 && (
            <div className="mt-8 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-200 dark:bg-white">
              <div className="-mx-2">
                <svg
                  viewBox="0 0 100 48"
                  className="h-64 w-full"
                  role="img"
                  aria-label="One year Fear and Greed timeline"
                >
                  {[0, 25, 50, 75, 100].map((tick) => {
                    const y = 46 - (tick / 100) * 44;
                    return (
                      <g key={tick}>
                        <line x1="0" y1={y} x2="92" y2={y} stroke="#d1d5db" strokeWidth="0.4" />
                        <text x="93.5" y={y + 0.9} textAnchor="start" fontSize="2.6" fill="#6b7280">
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  {timelinePoints.slice(1).map((point, index) => {
                    const previousPoint = timelinePoints[index];
                    const segmentValue = Math.round((previousPoint.value + point.value) / 2);
                    return (
                      <line
                        key={`${previousPoint.timestamp}-${point.timestamp}`}
                        x1={previousPoint.x}
                        y1={previousPoint.y}
                        x2={point.x}
                        y2={point.y}
                        stroke={sentimentStrokeHex(segmentValue)}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    );
                  })}

                  {hoveredPoint && (
                    <>
                      <line x1={hoveredPoint.x} y1="2" x2={hoveredPoint.x} y2="46" stroke="#9ca3af" strokeWidth="0.35" />
                      <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="1.5" fill={sentimentStrokeHex(hoveredPoint.value)} />
                    </>
                  )}

                  {timelinePoints.map((point, index) => (
                    <circle
                      key={`${point.timestamp}-${point.value}`}
                      cx={point.x}
                      cy={point.y}
                      r="1.8"
                      fill="transparent"
                      onMouseEnter={() => setHoveredTimelineIndex(index)}
                    />
                  ))}
                </svg>
              </div>

              {hoveredPoint && (
                <div className="mt-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-200">
                  <span className="font-semibold">Date:</span> {new Date(hoveredPoint.timestamp).toLocaleDateString()} |{' '}
                  <span className="font-semibold">Sentiment Score:</span> {hoveredPoint.value} |{' '}
                  <span className="font-semibold">Fear Index:</span> {formatRating(hoveredPoint.rating)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

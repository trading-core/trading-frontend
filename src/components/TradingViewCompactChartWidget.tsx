'use client';

import { useEffect, useRef } from 'react';

interface TradingViewCompactChartWidgetProps {
  symbol: string;
}

export default function TradingViewCompactChartWidget({
  symbol,
}: TradingViewCompactChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !symbol) {
      return;
    }

    let isDisposed = false;
    container.replaceChildren();

    const timeoutID = window.setTimeout(() => {
      if (isDisposed || !container.isConnected) {
        return;
      }

      const script = document.createElement('script');
      script.src =
        'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        allow_symbol_change: false,
        calendar: false,
        details: false,
        hide_side_toolbar: true,
        hide_top_toolbar: true,
        hide_legend: true,
        hide_volume: true,
        hotlist: false,
        interval: 'D',
        locale: 'en',
        save_image: false,
        style: '1',
        symbol: symbol.toUpperCase(),
        theme: 'dark',
        timezone: 'Etc/UTC',
        backgroundColor: '#09090B',
        gridColor: 'rgba(255, 255, 255, 0.06)',
        withdateranges: false,
        autosize: true,
      });

      container.appendChild(script);
    }, 0);

    return () => {
      isDisposed = true;
      window.clearTimeout(timeoutID);
      container.replaceChildren();
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container h-[180px] w-full overflow-hidden rounded-xl">
      <div
        className="tradingview-widget-container__widget h-full w-full"
        ref={containerRef}
      />
    </div>
  );
}
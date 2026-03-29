'use client';

import { useEffect, useRef } from 'react';

export default function TradingViewStockHeatmapWidget() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let isDisposed = false;
    container.replaceChildren();

    const timeoutID = window.setTimeout(() => {
      if (isDisposed || !container.isConnected) {
        return;
      }

      const symbolUrl = `${window.location.origin}/stock/{tvsymbol}`;

      const script = document.createElement('script');
      script.src =
        'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        dataSource: 'SPX500',
        blockSize: 'market_cap_basic',
        blockColor: 'change',
        grouping: 'sector',
        locale: 'en',
        symbolUrl,
        colorTheme: 'dark',
        exchanges: [],
        hasTopBar: false,
        isDataSetEnabled: false,
        isZoomEnabled: true,
        hasSymbolTooltip: true,
        isMonoSize: false,
        width: '100%',
        height: '100%',
      });

      container.appendChild(script);
    }, 0);

    return () => {
      isDisposed = true;
      window.clearTimeout(timeoutID);
      container.replaceChildren();
    };
  }, []);

  return (
    <div className="tradingview-widget-container h-[520px] w-full overflow-hidden rounded-xl">
      <div
        className="tradingview-widget-container__widget h-full w-full"
        ref={containerRef}
      />
    </div>
  );
}
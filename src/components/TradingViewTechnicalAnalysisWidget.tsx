'use client';

import { useEffect, useRef } from 'react';

interface TradingViewTechnicalAnalysisWidgetProps {
  symbol: string;
}

export default function TradingViewTechnicalAnalysisWidget({
  symbol,
}: TradingViewTechnicalAnalysisWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !symbol) {
      return;
    }

    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      displayMode: 'single',
      isTransparent: false,
      locale: 'en',
      interval: '1m',
      disableInterval: false,
      width: '100%',
      height: 430,
      symbol: symbol.toUpperCase(),
      showIntervalTabs: true,
    });

    containerRef.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="tradingview-widget-container w-full overflow-hidden rounded-xl">
      <div className="tradingview-widget-container__widget" ref={containerRef} />
    </div>
  );
}
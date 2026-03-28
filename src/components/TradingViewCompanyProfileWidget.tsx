'use client';

import { useEffect, useRef } from 'react';

interface TradingViewCompanyProfileWidgetProps {
  symbol: string;
}

export default function TradingViewCompanyProfileWidget({
  symbol,
}: TradingViewCompanyProfileWidgetProps) {
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
        'https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        symbol: symbol.toUpperCase(),
        width: '100%',
        height: 420,
        colorTheme: 'dark',
        isTransparent: false,
        locale: 'en',
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
    <div className="tradingview-widget-container w-full">
      <div className="tradingview-widget-container__widget" ref={containerRef} />
    </div>
  );
}

import StockDetail from '@/components/StockDetail';

export interface StockPageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default async function StockPage({ params }: StockPageProps) {
  const { symbol } = await params;
  return <StockDetail symbol={symbol} />;
}

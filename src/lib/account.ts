export interface BrokerAccount {
  account_type: string;
  account_id: string;
}

export interface TradingAccount {
  account_id: string;
  user_id: string;
  name: string;
  broker_linked: boolean;
  broker_account?: BrokerAccount;
}

export interface CreateAccountResponse {
  account_id: string;
  account_name: string;
}

export interface BalanceInfo {
  net_liquidating_value: number;
  cash_balance: number;
  equity_buying_power: number;
  currency: string;
}

export interface DailyPnL {
  date: string;
  realized_pnl: number;
  trade_count: number;
  fees: number;
}

export interface PnLSummary {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  net_pnl: number;
  net_pnl_after_fees: number;
  fees: number;
  gross_wins: number;
  gross_losses: number;
  win_rate: number;
}

export interface DailyPnLResult {
  currency: string;
  days: DailyPnL[];
  summary: PnLSummary;
}
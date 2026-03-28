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
  balance: number;
  currency: string;
}
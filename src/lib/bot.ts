import { BOT_SERVICE_BASE_URL, apiUrl } from './api';

export type BotStatus = 'running' | 'stopped';

export type StrategyTradeType =
  | 'trend_trading'
  | 'swing_trading'
  | 'scalping'
  | 'breakout_trading';

export const STRATEGY_TRADE_TYPES: StrategyTradeType[] = [
  'trend_trading',
  'swing_trading',
  'scalping',
  'breakout_trading',
];

export const ENABLED_STRATEGY_TRADE_TYPES: StrategyTradeType[] = ['scalping'];

export interface TradingBot {
  id: string;
  user_id: string;
  account_id: string;
  broker_account_id?: string;
  broker_type?: string;
  symbol: string;
  strategy_trade_type: StrategyTradeType;
  allocation_percent: number;
  name?: string;
  status: BotStatus;
  created_at: string;
}

export interface CreateBotInput {
  account_id: string;
  symbol: string;
  strategy_trade_type: StrategyTradeType;
  allocation_percent: number;
}

const getErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const message = payload.user_message ?? payload.message ?? payload.error;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    } catch {
      // Fall back to plain text below.
    }
  }
  const text = await response.text();
  return text || `Request failed with ${response.status}`;
};

const withAuth = (authorization: string) => ({
  Authorization: authorization,
  'Content-Type': 'application/json',
});

const parseJSONBody = <T>(body: string, context: string): T => {
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Invalid JSON response while ${context}`);
  }
};

const altBotBaseUrl = () => {
  if (BOT_SERVICE_BASE_URL.endsWith(':8081')) {
    return BOT_SERVICE_BASE_URL.replace(':8081', ':8080');
  }
  if (BOT_SERVICE_BASE_URL.endsWith(':8080')) {
    return BOT_SERVICE_BASE_URL.replace(':8080', ':8081');
  }
  return null;
};

const shouldRetryWithAltBase = (response: Response, body: string) => {
  if (response.status === 404) {
    return true;
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return true;
  }
  if (body.toLowerCase().includes('page not found')) {
    return true;
  }
  return false;
};

const requestBotService = async (
  path: string,
  init: RequestInit
): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(apiUrl(BOT_SERVICE_BASE_URL, path), init);
  } catch {
    const alternateBaseUrl = altBotBaseUrl();
    if (!alternateBaseUrl) {
      throw new Error('Failed to connect to bot service');
    }
    return fetch(apiUrl(alternateBaseUrl, path), init);
  }

  if (response.ok) {
    return response;
  }

  const message = await getErrorMessage(response.clone());
  const alternateBaseUrl = altBotBaseUrl();
  if (alternateBaseUrl && shouldRetryWithAltBase(response, message)) {
    const fallbackResponse = await fetch(apiUrl(alternateBaseUrl, path), init);
    if (fallbackResponse.ok) {
      return fallbackResponse;
    }
  }

  throw new Error(message);
};

export const listBots = async (authorization: string): Promise<TradingBot[]> => {
  const response = await requestBotService('/bots/v1/bots', {
    method: 'GET',
    headers: withAuth(authorization),
  });
  const body = await response.text();
  const payload = parseJSONBody<TradingBot[] | null>(body, 'listing bots');
  return Array.isArray(payload) ? payload : [];
};

export const createBot = async (
  authorization: string,
  input: CreateBotInput
): Promise<TradingBot> => {
  const response = await requestBotService('/bots/v1/bots', {
    method: 'POST',
    headers: withAuth(authorization),
    body: JSON.stringify(input),
  });
  const body = await response.text();
  return parseJSONBody<TradingBot>(body, 'creating bot');
};

export const updateBotStatus = async (
  authorization: string,
  botID: string,
  status: BotStatus
): Promise<void> => {
  await requestBotService(`/bots/v1/bots/${botID}`, {
    method: 'PATCH',
    headers: withAuth(authorization),
    body: JSON.stringify({ status }),
  });
};

export const deleteBot = async (authorization: string, botID: string): Promise<void> => {
  await requestBotService(`/bots/v1/bots/${botID}`, {
    method: 'DELETE',
    headers: withAuth(authorization),
  });
};

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

export interface BotDecisionEvent {
  sequence: number;
  timestamp_millis: number;
  bot_id: string;
  symbol: string;
  strategy_type: StrategyTradeType;
  action: 'none' | 'buy' | 'sell';
  reason: string;
  quantity: number;
  price: number;
}

type StreamBotDecisionEventReady = {
  bot_id: string;
  cursor: number;
};

type StreamBotDecisionEventsInput = {
  cursor?: number;
  signal?: AbortSignal;
  onReady?: (ready: StreamBotDecisionEventReady) => void;
  onDecision: (event: BotDecisionEvent) => void;
  onError?: (message: string) => void;
};

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

export const getBot = async (authorization: string, botID: string): Promise<TradingBot> => {
  const response = await requestBotService(`/bots/v1/bots/${botID}`, {
    method: 'GET',
    headers: withAuth(authorization),
  });
  const body = await response.text();
  return parseJSONBody<TradingBot>(body, 'loading bot');
};

export const streamBotDecisionEvents = async (
  authorization: string,
  botID: string,
  input: StreamBotDecisionEventsInput
): Promise<void> => {
  const query = typeof input.cursor === 'number' ? `?cursor=${encodeURIComponent(input.cursor)}` : '';
  const response = await requestBotService(`/bots/v1/bots/${botID}/stream${query}`, {
    method: 'GET',
    headers: {
      ...withAuth(authorization),
      Accept: 'text/event-stream',
    },
    signal: input.signal,
  });

  if (!response.body) {
    throw new Error('Bot stream is unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const parseEventBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line || line.startsWith(':')) {
        continue;
      }
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    const dataText = dataLines.join('\n');
    try {
      if (eventName === 'ready') {
        input.onReady?.(JSON.parse(dataText) as StreamBotDecisionEventReady);
        return;
      }
      if (eventName === 'decision') {
        input.onDecision(JSON.parse(dataText) as BotDecisionEvent);
        return;
      }
      if (eventName === 'error') {
        const payload = JSON.parse(dataText) as { message?: string };
        input.onError?.(payload.message ?? 'Bot stream error');
      }
    } catch {
      input.onError?.('Failed to parse bot stream event');
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      parseEventBlock(block);
    }
  }
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

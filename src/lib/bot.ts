import { BOT_SERVICE_BASE_URL, apiUrl } from './api';

export type BotStatus = 'running' | 'stopped';

export interface TradingBot {
  id: string;
  user_id: string;
  account_id: string;
  broker_account_id?: string;
  broker_type?: string;
  symbol: string;
  allocation_percent: number;
  trading_params?: TradingParameters;
  name?: string;
  status: BotStatus;
  created_at: string;
}

export interface TradingParameters {
  timeframe?: string;
  max_position_fraction?: number;
  atr_multiplier?: number;
  session_start?: number;
  session_end?: number;
  reentry_cooldown_minutes?: number;
  oversold_rsi?: number;
  overbought_rsi?: number;
  lookback_bars?: number;
  risk_per_trade_pct?: number;
}

export interface CreateBotInput {
  account_id: string;
  symbol: string;
  allocation_percent: number;
  trading_params?: TradingParameters;
}

export interface BotDecisionEvent {
  sequence: number;
  timestamp_millis: number;
  bot_id: string;
  symbol: string;
  action: 'none' | 'buy' | 'sell';
  reason: string;
  quantity: number;
  price: number;
}

type RawBotDecisionRecordedEvent = {
  bot_id?: unknown;
  symbol?: unknown;
  action?: unknown;
  reason?: unknown;
  quantity?: unknown;
  price?: unknown;
};

type RawBotDecisionFrame = {
  type?: unknown;
  timestamp_millis?: unknown;
  bot_decision_recorded_event?: RawBotDecisionRecordedEvent;
};

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

const normalizeDecisionAction = (value: unknown): BotDecisionEvent['action'] => {
  if (value === 'buy' || value === 'sell' || value === 'none') {
    return value;
  }
  return 'none';
};

const numberOrZero = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const stringOrEmpty = (value: unknown) =>
  typeof value === 'string' ? value : '';

const mapRawDecisionPayload = (
  eventID: number | null,
  payload: unknown
): BotDecisionEvent | null => {
  // Support both the current backend frame format and a flat event payload.
  const candidate = payload as Partial<BotDecisionEvent>;
  if (
    typeof candidate?.bot_id === 'string' &&
    typeof candidate?.symbol === 'string'
  ) {
    return {
      sequence:
        (typeof candidate.sequence === 'number' && Number.isFinite(candidate.sequence)
          ? candidate.sequence
          : eventID) ?? numberOrZero(candidate.timestamp_millis),
      timestamp_millis: numberOrZero(candidate.timestamp_millis),
      bot_id: candidate.bot_id,
      symbol: candidate.symbol,
      action: normalizeDecisionAction(candidate.action),
      reason: stringOrEmpty(candidate.reason),
      quantity: numberOrZero(candidate.quantity),
      price: numberOrZero(candidate.price),
    };
  }

  const frame = payload as RawBotDecisionFrame;
  const decision = frame.bot_decision_recorded_event;
  if (!decision) {
    return null;
  }

  const botID = stringOrEmpty(decision.bot_id);
  const symbol = stringOrEmpty(decision.symbol);
  if (!botID || !symbol) {
    return null;
  }

  const timestampMillis = numberOrZero(frame.timestamp_millis);
  return {
    sequence: eventID ?? timestampMillis,
    timestamp_millis: timestampMillis,
    bot_id: botID,
    symbol,
    action: normalizeDecisionAction(decision.action),
    reason: stringOrEmpty(decision.reason),
    quantity: numberOrZero(decision.quantity),
    price: numberOrZero(decision.price),
  };
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
    let eventID: number | null = null;
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
        continue;
      }
      if (line.startsWith('id:')) {
        const parsedID = Number(line.slice(3).trim());
        if (Number.isFinite(parsedID)) {
          eventID = parsedID;
        }
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
        const event = mapRawDecisionPayload(eventID, JSON.parse(dataText));
        if (!event) {
          input.onError?.('Unexpected bot decision payload shape');
          return;
        }
        input.onDecision(event);
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

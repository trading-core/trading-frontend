import { ACCOUNT_SERVICE_BASE_URL, apiUrl } from './api';
import type { DailyPnLResult } from './account';

const getErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const message = payload.user_message ?? payload.message ?? payload.error;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    } catch {
      // fall through
    }
  }
  const text = await response.text();
  return text || `Request failed with ${response.status}`;
};

export const getDailyPnL = async (
  authorization: string,
  accountID: string,
  from: string,
  to: string
): Promise<DailyPnLResult> => {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(
    apiUrl(ACCOUNT_SERVICE_BASE_URL, `/accounts/v1/accounts/${accountID}/pnl/daily?${query.toString()}`),
    {
      method: 'GET',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json() as Promise<DailyPnLResult>;
};

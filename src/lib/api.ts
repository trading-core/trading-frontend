const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const accountBase =
  process.env.NEXT_PUBLIC_ACCOUNT_SERVICE_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:9000';

const stockScreenerBase =
  process.env.NEXT_PUBLIC_STOCK_SCREENER_BASE_URL ??
  'http://localhost:8080';

const authBase =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_BASE_URL ??
  'http://localhost:9100';

const botBase =
  process.env.NEXT_PUBLIC_BOT_SERVICE_BASE_URL ??
  'http://localhost:8081';

const reportBase =
  process.env.NEXT_PUBLIC_REPORT_SERVICE_BASE_URL ??
  'http://localhost:8082';

export const ACCOUNT_SERVICE_BASE_URL = trimTrailingSlash(accountBase);
export const STOCK_SCREENER_BASE_URL = trimTrailingSlash(stockScreenerBase);
export const AUTH_SERVICE_BASE_URL = trimTrailingSlash(authBase);
export const BOT_SERVICE_BASE_URL = trimTrailingSlash(botBase);
export const REPORT_SERVICE_BASE_URL = trimTrailingSlash(reportBase);

export const apiUrl = (baseUrl: string, path: string) => {
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`;
  }
  return `${baseUrl}/${path}`;
};

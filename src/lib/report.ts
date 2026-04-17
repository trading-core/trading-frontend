import { REPORT_SERVICE_BASE_URL, apiUrl } from './api';

export type ReportStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Report {
  id: string;
  user_id: string;
  name?: string;
  kind: string;
  parameters?: Record<string, string>;
  status: ReportStatus;
  fail_reason?: string;
  download_url?: string;
  created_at: string;
  updated_at: string;
}

export interface EnqueueReportInput {
  kind: string;
  name?: string;
  parameters?: Record<string, string>;
}

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

const request = async (path: string, init: RequestInit): Promise<Response> => {
  const response = await fetch(apiUrl(REPORT_SERVICE_BASE_URL, path), init);
  if (response.ok) {
    return response;
  }
  throw new Error(await getErrorMessage(response));
};

export const enqueueReport = async (
  authorization: string,
  input: EnqueueReportInput
): Promise<Report> => {
  const response = await request('/reports/v1/jobs', {
    method: 'POST',
    headers: withAuth(authorization),
    body: JSON.stringify(input),
  });
  return response.json() as Promise<Report>;
};

export const getReport = async (authorization: string, reportID: string): Promise<Report> => {
  const response = await request(`/reports/v1/jobs/${reportID}`, {
    method: 'GET',
    headers: withAuth(authorization),
  });
  return response.json() as Promise<Report>;
};

export interface ListReportsResult {
  reports: Report[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export const listReports = async (
  authorization: string,
  page: number,
  pageSize: number
): Promise<ListReportsResult> => {
  const response = await request(
    `/reports/v1/jobs?page=${page}&page_size=${pageSize}`,
    { method: 'GET', headers: withAuth(authorization) }
  );
  return response.json() as Promise<ListReportsResult>;
};

export const downloadReport = async (authorization: string, reportID: string): Promise<void> => {
  const response = await request(`/reports/v1/jobs/${reportID}/download`, {
    method: 'GET',
    headers: { Authorization: authorization },
  });
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `report-${reportID}.html`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

export const openReport = async (authorization: string, reportID: string): Promise<void> => {
  const response = await request(`/reports/v1/jobs/${reportID}/download`, {
    method: 'GET',
    headers: { Authorization: authorization },
  });
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const tab = window.open(objectUrl, '_blank');
  // Revoke after a short delay so the new tab has time to load the blob.
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    tab?.focus();
  }, 10000);
};

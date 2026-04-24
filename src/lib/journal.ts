import { JOURNAL_SERVICE_BASE_URL, apiUrl } from './api';

export interface JournalEntry {
  user_id: string;
  date: string;
  notes?: string;
  tags?: string[];
  mood?: string;
  discipline_score?: number;
  screenshot_file_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface UpsertJournalEntryInput {
  notes?: string;
  tags?: string[];
  mood?: string;
  discipline_score?: number;
  screenshot_file_ids?: string[];
}

export interface ListJournalEntriesResult {
  entries: JournalEntry[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
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
      // fall through
    }
  }
  const text = await response.text();
  return text || `Request failed with ${response.status}`;
};

const authHeaders = (authorization: string) => ({
  Authorization: authorization,
  'Content-Type': 'application/json',
});

export const upsertJournalEntry = async (
  authorization: string,
  date: string,
  input: UpsertJournalEntryInput
): Promise<JournalEntry> => {
  const response = await fetch(apiUrl(JOURNAL_SERVICE_BASE_URL, `/journal/v1/entries/${date}`), {
    method: 'PUT',
    headers: authHeaders(authorization),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json() as Promise<JournalEntry>;
};

export const getJournalEntry = async (
  authorization: string,
  date: string
): Promise<JournalEntry | null> => {
  const response = await fetch(apiUrl(JOURNAL_SERVICE_BASE_URL, `/journal/v1/entries/${date}`), {
    method: 'GET',
    headers: authHeaders(authorization),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json() as Promise<JournalEntry>;
};

export const listJournalEntries = async (
  authorization: string,
  from: string,
  to: string
): Promise<ListJournalEntriesResult> => {
  const query = new URLSearchParams({ from, to, page_size: '366' });
  const response = await fetch(
    apiUrl(JOURNAL_SERVICE_BASE_URL, `/journal/v1/entries?${query.toString()}`),
    { method: 'GET', headers: authHeaders(authorization) }
  );
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  return response.json() as Promise<ListJournalEntriesResult>;
};

export const deleteJournalEntry = async (
  authorization: string,
  date: string
): Promise<void> => {
  const response = await fetch(apiUrl(JOURNAL_SERVICE_BASE_URL, `/journal/v1/entries/${date}`), {
    method: 'DELETE',
    headers: authHeaders(authorization),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(await getErrorMessage(response));
  }
};

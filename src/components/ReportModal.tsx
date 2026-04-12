'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getAuthorizationHeader } from '@/lib/authSession';
import {
  enqueueReport,
  listReports,
  getReport,
  downloadReport,
  openReport,
  type Report,
  type EnqueueReportInput,
  type ListReportsResult,
} from '@/lib/report';
import BacktestReportForm, {
  type BacktestFormValues,
  BACKTEST_FORM_DEFAULTS,
  buildBacktestParameters,
  validateBacktestForm,
  parseBacktestParameters,
} from '@/components/BacktestReportForm';

const POLL_INTERVAL_MS = 3000;
const PAGE_SIZE = 10;
const EMPTY_LIST: ListReportsResult = {
  reports: [],
  page: 0,
  page_size: PAGE_SIZE,
  total_count: 0,
  total_pages: 1,
};

export interface ReportKindOption {
  value: string;
  label: string;
  description?: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportKinds: ReportKindOption[];
  defaultParameters?: Record<string, string>;
}

// ── Status icons ─────────────────────────────────────────────────────────────

function IconClock({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function IconSpinner({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className ?? ''}`}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconExternalLink({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 15V3m0 12-4-4m4 4 4-4" />
      <path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" />
    </svg>
  );
}

const STATUS_ICON: Record<Report['status'], (props: { className?: string }) => ReactNode> = {
  pending:   IconClock,
  running:   IconSpinner,
  completed: IconCheck,
  failed:    IconX,
};

const STATUS_LABEL: Record<Report['status'], string> = {
  pending:   'Pending',
  running:   'Running',
  completed: 'Completed',
  failed:    'Failed',
};

const STATUS_COLOR: Record<Report['status'], string> = {
  pending:   'text-amber-500 dark:text-amber-400',
  running:   'text-blue-500 dark:text-blue-400',
  completed: 'text-green-500 dark:text-green-400',
  failed:    'text-red-500 dark:text-red-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportModal({
  isOpen,
  onClose,
  reportKinds,
  defaultParameters,
}: ReportModalProps) {
  const [newReportStep, setNewReportStep] = useState<'pick' | 'form' | null>(null);
  const [selectedKind, setSelectedKind] = useState(reportKinds[0]?.value ?? '');
  const [reportName, setReportName] = useState('');
  const [backtestFormValues, setBacktestFormValues] = useState<BacktestFormValues>(BACKTEST_FORM_DEFAULTS);
  const [listResult, setListResult] = useState<ListReportsResult>(EMPTY_LIST);
  const [activeJobIDs, setActiveJobIDs] = useState<Set<string>>(new Set());
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [authorization, setAuthorization] = useState<string | null>(null);

  // Disable body scroll while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Track current page in a ref so the poll can reload the right page.
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);

  // Resolve auth on the client only — localStorage is not available during SSR.
  useEffect(() => {
    setAuthorization(getAuthorizationHeader());
  }, [isOpen]);

  const loadReports = useCallback(async (targetPage: number) => {
    if (!authorization) {
      return;
    }
    try {
      const result = await listReports(authorization, targetPage, PAGE_SIZE);
      setListResult(result);
    } catch {
      // Keep showing whatever was last loaded.
    }
  }, [authorization]);

  // Load when the modal opens or the page changes.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadReports(page);
  }, [isOpen, page, loadReports]);

  // Poll in-flight jobs — reload the full current page so status stays in sync.
  useEffect(() => {
    if (activeJobIDs.size === 0 || !authorization) {
      return;
    }
    const timer = setInterval(async () => {
      // Check which jobs are still active.
      const stillActive = new Set<string>();
      await Promise.all(
        [...activeJobIDs].map(async (id) => {
          try {
            const updated = await getReport(authorization, id);
            if (updated.status === 'pending' || updated.status === 'running') {
              stillActive.add(id);
            }
          } catch {
            // Stop polling this job if it can't be fetched.
          }
        })
      );
      setActiveJobIDs(stillActive);
      // Reload the current page so the list reflects the latest BE state.
      await loadReports(pageRef.current);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeJobIDs, authorization, loadReports]);

  const buildParameters = (): Record<string, string> | undefined => {
    if (selectedKind === 'backtest') {
      return buildBacktestParameters(backtestFormValues);
    }
    return defaultParameters;
  };

  const validateForm = (): string | null => {
    if (selectedKind === 'backtest') {
      return validateBacktestForm(backtestFormValues);
    }
    return null;
  };

  const handleEnqueue = async () => {
    if (!authorization || !selectedKind) {
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsEnqueuing(true);
    setError(null);
    try {
      const input: EnqueueReportInput = {
        kind: selectedKind,
        name: reportName.trim() || undefined,
        parameters: buildParameters(),
      };
      const created = await enqueueReport(authorization, input);
      // Close the sub-modal immediately so the user sees the job appear in the list.
      setNewReportStep(null);
      setReportName('');
      setBacktestFormValues(BACKTEST_FORM_DEFAULTS);
      setActiveJobIDs((previous) => new Set([...previous, created.id]));
      setPage(0);
      await loadReports(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to enqueue report');
    } finally {
      setIsEnqueuing(false);
    }
  };

  const closeNewReport = () => {
    setNewReportStep(null);
    setReportName('');
    setError(null);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      {/* Main modal */}
      <div className="flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-zinc-900 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-black dark:text-white">Reports</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setNewReportStep('pick'); setError(null); }}
              className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
              + New Report
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto">
          {listResult.total_count === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No reports yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Report Name</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Report Type</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date Created</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"></th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {listResult.reports.map((report) => {
                    const Icon = STATUS_ICON[report.status];
                    const kindLabel = reportKinds.find((k) => k.value === report.kind)?.label ?? report.kind;
                    return (
                      <tr key={report.id} className="group">
                        <td className="py-3 pr-4 text-sm text-black dark:text-white">
                          {report.name ?? (
                            <span className="font-mono text-xs text-gray-400 dark:text-gray-500" title={report.id}>
                              {report.id}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{kindLabel}</td>
                        <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(report.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4">
                          {report.status === 'failed' && report.fail_reason ? (
                            <button
                              type="button"
                              onClick={() => window.alert(report.fail_reason)}
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-2 hover:underline ${STATUS_COLOR[report.status]}`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              {STATUS_LABEL[report.status]}
                            </button>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${STATUS_COLOR[report.status]}`}>
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              {STATUS_LABEL[report.status]}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {report.kind === 'backtest' && report.parameters ? (
                            <button
                              type="button"
                              title="Reuse parameters"
                              onClick={() => {
                                setSelectedKind(report.kind);
                                setBacktestFormValues(parseBacktestParameters(report.parameters!));
                                setNewReportStep('form');
                              }}
                              className="inline-flex items-center text-gray-400 hover:opacity-70 dark:text-gray-500"
                            >
                              <IconCopy className="h-4 w-4" />
                            </button>
                          ) : null}
                        </td>
                        <td className="py-3">
                          {report.status === 'completed' ? (
                            report.kind === 'backtest' ? (
                              <button
                                type="button"
                                title="Open report"
                                onClick={() => { if (authorization) void openReport(authorization, report.id); }}
                                className="inline-flex items-center text-green-500 hover:opacity-70 dark:text-green-400"
                              >
                                <IconExternalLink className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Download report"
                                onClick={() => { if (authorization) void downloadReport(authorization, report.id); }}
                                className="inline-flex items-center text-green-500 hover:opacity-70 dark:text-green-400"
                              >
                                <IconDownload className="h-4 w-4" />
                              </button>
                            )
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {listResult.total_pages > 1 ? (
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-zinc-800"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Page {page + 1} of {listResult.total_pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(listResult.total_pages - 1, p + 1))}
                    disabled={page === listResult.total_pages - 1}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-zinc-800"
                  >
                    Next →
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Step 1 — pick a report type */}
      {newReportStep === 'pick' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeNewReport} />
          <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-black dark:text-white">New Report</h3>
              <button
                type="button"
                onClick={closeNewReport}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Select a report type to continue.</p>
            <ul className="space-y-2">
              {reportKinds.map((kind) => (
                <li key={kind.value}>
                  <button
                    type="button"
                    onClick={() => { setSelectedKind(kind.value); setNewReportStep('form'); }}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-400 dark:hover:bg-blue-950/40"
                  >
                    <p className="text-sm font-semibold text-black dark:text-white">{kind.label}</p>
                    {kind.description ? (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{kind.description}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Step 2 — fill in the form for the chosen type */}
      {newReportStep === 'form' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeNewReport} />
          <div className="relative w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-zinc-900 max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setNewReportStep('pick'); setError(null); }}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
                  title="Back"
                >
                  ←
                </button>
                <h3 className="text-lg font-bold text-black dark:text-white">
                  {reportKinds.find((k) => k.value === selectedKind)?.label ?? 'New Report'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeNewReport}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Report Name
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(event) => setReportName(event.target.value)}
                  placeholder="e.g. AAPL April backtest"
                  disabled={isEnqueuing}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black disabled:opacity-60 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                />
              </div>
              {selectedKind === 'backtest' ? (
                <BacktestReportForm
                  values={backtestFormValues}
                  onChange={setBacktestFormValues}
                />
              ) : null}
              {error ? (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              ) : null}
              {!authorization ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">Sign in to run reports.</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleEnqueue()}
                disabled={isEnqueuing || !selectedKind || !authorization}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isEnqueuing ? 'Queuing…' : 'Run Report'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

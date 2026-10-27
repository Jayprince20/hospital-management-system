'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type AuditLogEntry } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useDebounce } from '@/hooks/use-debounce';
import { Modal, Pagination } from '@/components/ui';

const ACTIONS = [
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
  'EXPORT',
  'ANONYMIZE',
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_FAILED',
  'CONSENT_GRANTED',
  'CONSENT_WITHDRAWN',
];

const ENTITY_TYPES = [
  'Patient',
  'User',
  'Appointment',
  'Consultation',
  'Prescription',
  'PrescriptionItem',
  'LabOrder',
  'LabOrderItem',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'VitalSign',
  'MedicalHistory',
  'Insurance',
  'PatientConsent',
];

// Fields that change on every write and say nothing about what was done
const NOISE_FIELDS = new Set(['updatedAt', 'createdAt']);

const PAGE_SIZE = 25;
const EXPORT_MAX = 1000;

function badgeClasses(action: string): string {
  if (action === 'VIEW' || action === 'LOGIN' || action === 'LOGOUT' || action === 'EXPORT') {
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  }
  if (action.startsWith('CONSENT') || action === 'MFA_ENABLED') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
  }
  if (action === 'DELETE' || action === 'ANONYMIZE' || action.endsWith('FAILED') || action === 'MFA_DISABLED') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function formatValue(value: unknown, formatDateTime: (value: string) => string): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && ISO_TIMESTAMP.test(value)) return formatDateTime(value);
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function csvCell(value: string): string {
  return /[",;\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

interface Picked {
  id: string;
  label: string;
}

/** A search box that resolves to one picked record (user or patient) */
function PickerFilter({
  label,
  placeholder,
  picked,
  onPick,
  search,
  noMatch,
  removeLabel,
}: {
  label: string;
  placeholder: string;
  picked: Picked | null;
  onPick: (value: Picked | null) => void;
  search: (query: string) => Promise<Picked[]>;
  noMatch: string;
  removeLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Picked[]>([]);
  const [loadedQuery, setLoadedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query.trim(), 250);

  useEffect(() => {
    if (debounced.length < 2) return;
    let cancelled = false;
    search(debounced)
      .then((found) => {
        if (cancelled) return;
        setOptions(found);
        setLoadedQuery(debounced);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions([]);
        setLoadedQuery(debounced);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, search]);

  const shown = debounced.length >= 2 && loadedQuery === debounced ? options : [];

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {picked ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-lime-300 bg-lime-50 dark:bg-lime-900/30 dark:border-lime-700 text-sm">
          <span className="truncate text-gray-900 dark:text-white" title={picked.label}>
            {picked.label}
          </span>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="text-xs text-lime-700 dark:text-lime-400 hover:underline shrink-0"
          >
            {removeLabel}
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent"
        />
      )}
      {!picked && open && debounced.length >= 2 && loadedQuery === debounced && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {shown.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{noMatch}</p>
          ) : (
            shown.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(option);
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-lime-50 dark:hover:bg-gray-700"
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const { t, tEnum, formatDateTime } = useLanguage();

  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [pickedUser, setPickedUser] = useState<Picked | null>(null);
  const [pickedPatient, setPickedPatient] = useState<Picked | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const actionLabel = useCallback((value: string) => t(`audit.action.${value}`), [t]);
  const entityLabel = useCallback((value: string) => t(`audit.entity.${value}`), [t]);
  const dateTime = useCallback(
    (value: string) =>
      formatDateTime(value, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [formatDateTime]
  );

  const filters = useCallback(
    () => ({
      action: action || undefined,
      // A picked patient narrows to that patient's record
      entityType: pickedPatient ? 'Patient' : entityType || undefined,
      entityId: pickedPatient?.id,
      userId: pickedUser?.id,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [action, entityType, pickedPatient, pickedUser, dateFrom, dateTo]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAuditLogs({ ...filters(), page, limit: PAGE_SIZE });
      setLogs(result.logs);
      setTotal(result.pagination.total);
      setTotalPages(Math.max(1, result.pagination.totalPages));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('audit.loadFailed'));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const changeFilter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setAction('');
    setEntityType('');
    setPickedUser(null);
    setPickedPatient(null);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = !!(action || entityType || pickedUser || pickedPatient || dateFrom || dateTo);

  const searchUsers = useCallback(async (query: string): Promise<Picked[]> => {
    const result = await api.getUsers({ search: query, limit: 8 });
    return result.users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName} · ${user.email}` }));
  }, []);

  const searchPatients = useCallback(async (query: string): Promise<Picked[]> => {
    const result = await api.getPatients({ search: query, limit: 8 });
    return result.data.map((patient) => ({ id: patient.id, label: `${patient.firstName} ${patient.lastName} (${patient.patientId})` }));
  }, []);

  /** Who did it: the account, or for a failed sign-in the email that was tried */
  const actorName = (log: AuditLogEntry): string => {
    if (log.user) return log.user.name;
    const tried = log.newData && typeof log.newData.email === 'string' ? log.newData.email : null;
    if (tried) return tried;
    return log.action === 'LOGIN_FAILED' ? t('audit.unknownUser') : t('audit.system');
  };

  const recordName = (log: AuditLogEntry): string =>
    log.entityLabel || (log.entityId === '*' ? entityLabel(log.entityType) : `${entityLabel(log.entityType)} · ${log.entityId.slice(0, 8)}`);

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const rows: AuditLogEntry[] = [];
      for (let p = 1; rows.length < EXPORT_MAX; p++) {
        const result = await api.getAuditLogs({ ...filters(), page: p, limit: 100 });
        rows.push(...result.logs);
        if (p >= result.pagination.totalPages || result.logs.length === 0) break;
      }
      const header = [
        t('audit.csv.date'),
        t('audit.csv.user'),
        t('audit.csv.role'),
        t('audit.csv.action'),
        t('audit.csv.entityType'),
        t('audit.csv.entity'),
        t('audit.csv.entityId'),
        t('audit.csv.ip'),
        t('audit.csv.userAgent'),
      ];
      const lines = rows.slice(0, EXPORT_MAX).map((log) =>
        [
          dateTime(log.createdAt),
          actorName(log),
          log.user ? tEnum(log.user.role) : '',
          actionLabel(log.action),
          entityLabel(log.entityType),
          log.entityLabel || '',
          log.entityId,
          log.ipAddress || '',
          log.userAgent || '',
        ]
          .map(csvCell)
          .join(',')
      );
      const csv = '﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      const stamp = new Date();
      const day = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, '0')}-${String(stamp.getDate()).padStart(2, '0')}`;
      link.href = url;
      link.download = `journal-audit-${day}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t('audit.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('audit.title')}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">{t('audit.subtitle')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? t('audit.exporting') : t('audit.exportCsv')}
          </button>
          {exportError && <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('audit.filter.action')}</label>
            <select value={action} onChange={(e) => changeFilter(setAction)(e.target.value)} className={inputClass}>
              <option value="">{t('audit.filter.allActions')}</option>
              {ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {actionLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('audit.filter.entity')}</label>
            <select
              value={pickedPatient ? 'Patient' : entityType}
              disabled={!!pickedPatient}
              onChange={(e) => changeFilter(setEntityType)(e.target.value)}
              className={`${inputClass} disabled:opacity-60`}
            >
              <option value="">{t('audit.filter.allEntities')}</option>
              {ENTITY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {entityLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('audit.filter.from')}</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => changeFilter(setDateFrom)(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('audit.filter.to')}</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => changeFilter(setDateTo)(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <PickerFilter
            label={t('audit.filter.user')}
            placeholder={t('audit.filter.userPlaceholder')}
            picked={pickedUser}
            onPick={changeFilter(setPickedUser)}
            search={searchUsers}
            noMatch={t('audit.filter.noMatch')}
            removeLabel={t('audit.filter.remove')}
          />
          <PickerFilter
            label={t('audit.filter.patient')}
            placeholder={t('audit.filter.patientPlaceholder')}
            picked={pickedPatient}
            onPick={changeFilter(setPickedPatient)}
            search={searchPatients}
            noMatch={t('audit.filter.noMatch')}
            removeLabel={t('audit.filter.remove')}
          />
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
              {total === 1 ? t('audit.totalOne', { count: total }) : t('audit.total', { count: total.toLocaleString() })}
            </p>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="pb-2 text-sm text-lime-700 dark:text-lime-400 hover:underline">
                {t('audit.filter.clear')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 px-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 px-4 py-2 text-sm font-medium text-red-600 bg-red-100 dark:bg-red-900/40 rounded-lg hover:bg-red-200 transition-colors"
            >
              {t('audit.retry')}
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="font-medium text-gray-900 dark:text-white">{t('audit.empty')}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('audit.emptyHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  {['audit.col.date', 'audit.col.user', 'audit.col.action', 'audit.col.entity', 'audit.col.ip'].map((key) => (
                    <th key={key} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="cursor-pointer hover:bg-lime-50/60 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300 tabular-nums">{dateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{actorName(log)}</div>
                      {log.user && <div className="text-xs text-gray-500 dark:text-gray-400">{tEnum(log.user.role)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badgeClasses(log.action)}`}>
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <div>{recordName(log)}</div>
                      {log.entityLabel && <div className="text-xs text-gray-500 dark:text-gray-400">{entityLabel(log.entityType)}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 font-mono text-xs">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} size="full">
        <Modal.Header>{t('audit.details.title')}</Modal.Header>
        <Modal.Body>{selected && <AuditDetails log={selected} actorName={actorName(selected)} recordName={recordName(selected)} />}</Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('audit.details.close')}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function AuditDetails({ log, actorName, recordName }: { log: AuditLogEntry; actorName: string; recordName: string }) {
  const { t, tEnum, formatDateTime } = useLanguage();

  const facts: Array<[string, string]> = [
    [
      t('audit.details.when'),
      formatDateTime(log.createdAt, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ],
    [t('audit.details.who'), log.user ? `${actorName} · ${tEnum(log.user.role)} · ${log.user.email}` : actorName],
    [t('audit.col.action'), t(`audit.action.${log.action}`)],
    [t('audit.details.record'), recordName],
    [t('audit.details.recordId'), log.entityId],
    [t('audit.details.ip'), log.ipAddress || '—'],
    [t('audit.details.userAgent'), log.userAgent || '—'],
  ];

  const oldData = log.oldData ?? null;
  const newData = log.newData ?? null;
  const isUpdate = log.action === 'UPDATE' && oldData && newData;
  const changed = isUpdate
    ? [...new Set([...Object.keys(oldData), ...Object.keys(newData)])].filter(
        (key) => !NOISE_FIELDS.has(key) && !sameValue(oldData[key], newData[key])
      )
    : [];

  const empty = <span className="italic text-gray-400">{t('audit.details.empty')}</span>;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="text-gray-900 dark:text-white break-all">{value}</dd>
          </div>
        ))}
      </dl>

      {isUpdate ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('audit.details.changes')}</h3>
          {changed.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('audit.details.noChanges')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('audit.details.field')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('audit.details.before')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('audit.details.after')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {changed.map((key) => (
                    <tr key={key} className="align-top">
                      <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{key}</td>
                      <td className="px-3 py-2 bg-red-50/60 dark:bg-red-900/20">
                        <pre className="whitespace-pre-wrap break-all font-mono text-xs text-gray-800 dark:text-gray-200">
                          {formatValue(oldData[key], formatDateTime) || empty}
                        </pre>
                      </td>
                      <td className="px-3 py-2 bg-green-50/60 dark:bg-green-900/20">
                        <pre className="whitespace-pre-wrap break-all font-mono text-xs text-gray-800 dark:text-gray-200">
                          {formatValue(newData[key], formatDateTime) || empty}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : newData || oldData ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {newData ? t('audit.details.data') : t('audit.details.previousData')}
          </h3>
          <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-3 font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">
            {JSON.stringify(newData ?? oldData, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('audit.details.noData')}</p>
      )}
    </div>
  );
}

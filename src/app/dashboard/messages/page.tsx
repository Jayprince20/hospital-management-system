'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui';
import { useToast } from '@/components/toast';
import { SimulateSmsReply } from '@/components/confirmation';
import { api, type MessageChannel, type MessageStatus, type MessagesResponse, type OutboundMessage } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useDebounce } from '@/hooks/use-debounce';

const CHANNELS: MessageChannel[] = ['SMS', 'WHATSAPP', 'EMAIL'];
const STATUSES: MessageStatus[] = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED'];
const PAGE_SIZE = 25;

const STATUS_STYLES: Record<MessageStatus, string> = {
  QUEUED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  SKIPPED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const CHANNEL_ICONS: Record<MessageChannel, string> = {
  SMS: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  WHATSAPP: 'M3 21l1.65-4.5A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.2-1.1L3 21z',
  EMAIL: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
};

const inputClass =
  'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500';

function ChannelIcon({ channel }: { channel: MessageChannel }) {
  return (
    <svg className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CHANNEL_ICONS[channel]} />
    </svg>
  );
}

export default function MessagesPage() {
  const { t, formatDateTime } = useLanguage();
  const toast = useToast();
  const [filters, setFilters] = useState({ channel: '', status: '', template: '', dateFrom: '', dateTo: '' });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MessagesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<OutboundMessage | null>(null);
  const [detail, setDetail] = useState<OutboundMessage | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [testForm, setTestForm] = useState<{ channel: MessageChannel; to: string; message: string }>({ channel: 'SMS', to: '', message: '' });
  const [sendingTest, setSendingTest] = useState(false);

  // A key that is missing from the dictionary comes back unchanged: fall back to the raw name
  const templateLabel = (template: string) => {
    const label = t(`msg.template.${template}`);
    return label === `msg.template.${template}` ? template : label;
  };

  useEffect(() => {
    let cancelled = false;
    api
      .getMessages({ ...filters, search: debouncedSearch, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, debouncedSearch, page, reload]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    api
      .getMessage(selected.id)
      .then((full) => {
        if (!cancelled) {
          setDetail(full);
          setDetailFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDetailFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setSearch('');
    setFilters({ channel: '', status: '', template: '', dateFrom: '', dateTo: '' });
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
    setDetailFailed(false);
  };

  const retry = useCallback(async () => {
    if (!detail) return;
    setRetrying(true);
    try {
      await api.retryMessage(detail.id);
      toast.success(t('msg.detail.retried'));
      setDetail(await api.getMessage(detail.id));
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('msg.loadFailed'));
    } finally {
      setRetrying(false);
    }
  }, [detail, t, toast]);

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testForm.to.trim() || !testForm.message.trim()) return;
    setSendingTest(true);
    try {
      await api.sendTestMessage({ channel: testForm.channel, to: testForm.to.trim(), message: testForm.message.trim() });
      toast.success(t('msg.test.sent'));
      setTestForm((f) => ({ ...f, message: '' }));
      setPage(1);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('msg.loadFailed'));
    } finally {
      setSendingTest(false);
    }
  };

  const total = data ? Object.values(data.counts ?? {}).reduce((sum, n) => sum + (n ?? 0), 0) : 0;
  const hasFilters = Object.values(filters).some(Boolean) || search !== '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('msg.title')}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">{t('msg.subtitle')}</p>
      </div>

      {data && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            data.mode === 'live'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300'
          }`}
        >
          <p className="font-medium">{data.mode === 'live' ? t('msg.modeLive') : t('msg.modeOutbox')}</p>
          <p className="mt-0.5 text-xs opacity-80">
            {t('msg.providers', {
              sms: data.providers?.sms ?? '—',
              email: data.providers?.email ?? '—',
              whatsapp: data.providers?.whatsapp ?? '—',
            })}
          </p>
        </div>
      )}

      {/* Not live: play a patient's SMS reply to a reminder (confirm / cancel) */}
      {data && data.mode !== 'live' && <SimulateSmsReply onDone={() => setReload((n) => n + 1)} />}

      {/* Counts per status: click to filter */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setFilter('status', '')}
          className={`rounded-xl border bg-white dark:bg-gray-800 p-3 text-left ${filters.status === '' ? 'border-lime-500' : 'border-gray-100 dark:border-gray-700'}`}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('msg.total')}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{total}</p>
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter('status', filters.status === status ? '' : status)}
            className={`rounded-xl border bg-white dark:bg-gray-800 p-3 text-left ${filters.status === status ? 'border-lime-500' : 'border-gray-100 dark:border-gray-700'}`}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{t(`msg.status.${status}`)}</p>
            <p className={`text-xl font-bold ${status === 'FAILED' && (data?.counts?.FAILED ?? 0) > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
              {data?.counts?.[status] ?? 0}
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('msg.filter.search')}
          aria-label={t('msg.filter.search')}
          className={`${inputClass} min-w-[220px] flex-1`}
        />
        <select value={filters.channel} onChange={(e) => setFilter('channel', e.target.value)} aria-label={t('msg.filter.channel')} className={inputClass}>
          <option value="">{t('msg.filter.allChannels')}</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>{t(`msg.channel.${channel}`)}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label={t('msg.filter.status')} className={inputClass}>
          <option value="">{t('msg.filter.allStatuses')}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>{t(`msg.status.${status}`)}</option>
          ))}
        </select>
        <select value={filters.template} onChange={(e) => setFilter('template', e.target.value)} aria-label={t('msg.filter.template')} className={inputClass}>
          <option value="">{t('msg.filter.allTemplates')}</option>
          {(data?.templates ?? []).map((template) => (
            <option key={template} value={template}>{templateLabel(template)}</option>
          ))}
        </select>
        <label className="text-sm text-gray-600 dark:text-gray-400">
          <span className="mr-1">{t('msg.filter.from')}</span>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm text-gray-600 dark:text-gray-400">
          <span className="mr-1">{t('msg.filter.to')}</span>
          <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilter('dateTo', e.target.value)} className={inputClass} />
        </label>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-medium text-lime-700 dark:text-lime-400 hover:underline">
            {t('msg.filter.clear')}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        {failed ? (
          <div className="flex items-center justify-between p-4 text-sm text-red-600 dark:text-red-400">
            <span>{t('msg.loadFailed')}</span>
            <button type="button" onClick={() => setReload((n) => n + 1)} className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-1.5 font-medium">
              {t('msg.retryLoad')}
            </button>
          </div>
        ) : !data ? (
          <p className="p-4 text-sm text-gray-500">{t('common.loading')}</p>
        ) : data.messages.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('msg.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">{t('msg.col.date')}</th>
                  <th className="px-4 py-3">{t('msg.col.channel')}</th>
                  <th className="px-4 py-3">{t('msg.col.to')}</th>
                  <th className="px-4 py-3">{t('msg.col.patient')}</th>
                  <th className="px-4 py-3">{t('msg.col.template')}</th>
                  <th className="px-4 py-3">{t('msg.col.preview')}</th>
                  <th className="px-4 py-3">{t('msg.col.status')}</th>
                  <th className="px-4 py-3 text-right">{t('msg.col.attempts')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-900 dark:text-white">
                {data.messages.map((message) => (
                  <tr
                    key={message.id}
                    onClick={() => setSelected(message)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(message)}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:bg-gray-50 focus:outline-none"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(message.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={message.channel} />
                        {t(`msg.channel.${message.channel}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{message.to}</td>
                    <td className="px-4 py-3">
                      {message.patient ? (
                        <>
                          <span className="block">{message.patient.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{message.patient.hospitalId}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{templateLabel(message.template)}</td>
                    <td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-300">
                      <span className="line-clamp-2">{message.subject ? `${message.subject} — ` : ''}{message.preview}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[message.status]}`}>
                        {t(`msg.status.${message.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{message.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {t('admin.billing.pageOf', { page: data.pagination.page, total: data.pagination.totalPages })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 disabled:opacity-40"
              >
                {t('admin.billing.previous')}
              </button>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 disabled:opacity-40"
              >
                {t('admin.billing.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test message */}
      <form onSubmit={sendTest} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{t('msg.test.title')}</h2>
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span className="mb-1 block">{t('msg.test.channel')}</span>
            <select
              value={testForm.channel}
              onChange={(e) => setTestForm((f) => ({ ...f, channel: e.target.value as MessageChannel }))}
              className={`${inputClass} w-full`}
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>{t(`msg.channel.${channel}`)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span className="mb-1 block">{t('msg.test.to')}</span>
            <input
              type={testForm.channel === 'EMAIL' ? 'email' : 'tel'}
              required
              value={testForm.to}
              onChange={(e) => setTestForm((f) => ({ ...f, to: e.target.value }))}
              placeholder={testForm.channel === 'EMAIL' ? t('msg.test.toEmail') : t('msg.test.toSms')}
              className={`${inputClass} w-full`}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300 md:col-span-2">
            <span className="mb-1 block">{t('msg.test.message')}</span>
            <textarea
              required
              rows={2}
              maxLength={480}
              value={testForm.message}
              onChange={(e) => setTestForm((f) => ({ ...f, message: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={sendingTest} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            {t('msg.test.send')}
          </button>
        </div>
      </form>

      {/* Details */}
      <Modal isOpen={!!selected} onClose={closeDetail} size="full">
        <Modal.Header>{t('msg.detail.title')}</Modal.Header>
        <Modal.Body>
          {detailFailed ? (
            <p className="text-sm text-red-600">{t('msg.detail.loadFailed')}</p>
          ) : !detail ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2">
                <dt className="text-gray-500 dark:text-gray-400">{t('msg.col.channel')}</dt>
                <dd className="text-gray-900 dark:text-white">{t(`msg.channel.${detail.channel}`)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('msg.col.to')}</dt>
                <dd className="text-gray-900 dark:text-white">{detail.to}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('msg.col.template')}</dt>
                <dd className="text-gray-900 dark:text-white">{templateLabel(detail.template)} · {t('msg.detail.language')} {detail.language.toUpperCase()}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('msg.col.status')}</dt>
                <dd>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[detail.status]}`}>
                    {t(`msg.status.${detail.status}`)}
                  </span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">{t('msg.col.attempts')} : {detail.attempts}</span>
                </dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('msg.detail.provider')}</dt>
                <dd className="text-gray-900 dark:text-white">{detail.provider}</dd>
                {detail.providerMessageId && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">{t('msg.detail.providerId')}</dt>
                    <dd className="font-mono text-xs text-gray-900 dark:text-white">{detail.providerMessageId}</dd>
                  </>
                )}
                <dt className="text-gray-500 dark:text-gray-400">{t('msg.detail.createdAt')}</dt>
                <dd className="text-gray-900 dark:text-white">{formatDateTime(detail.createdAt)}</dd>
                {detail.sentAt && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">{t('msg.detail.sentAt')}</dt>
                    <dd className="text-gray-900 dark:text-white">{formatDateTime(detail.sentAt)}</dd>
                  </>
                )}
                {detail.relatedType && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">{t('msg.detail.related')}</dt>
                    <dd className="text-gray-900 dark:text-white">
                      {detail.relatedType} <span className="font-mono text-xs text-gray-500">{detail.relatedId?.slice(0, 8)}</span>
                    </dd>
                  </>
                )}
                {detail.subject && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">{t('msg.detail.subject')}</dt>
                    <dd className="text-gray-900 dark:text-white">{detail.subject}</dd>
                  </>
                )}
              </dl>

              {detail.error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-red-700 dark:text-red-300">
                  <p className="font-medium">{t('msg.detail.error')}</p>
                  <p>{detail.error}</p>
                </div>
              )}

              <div>
                <p className="mb-1 font-medium text-gray-900 dark:text-white">{t('msg.detail.body')}</p>
                {detail.channel === 'EMAIL' ? (
                  // Email HTML is shown in a fully sandboxed frame: no scripts, no navigation, no same-origin access
                  <iframe
                    title={detail.subject ?? t('msg.detail.body')}
                    sandbox=""
                    srcDoc={detail.body ?? ''}
                    className="h-96 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white"
                  />
                ) : (
                  <p className="whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-gray-900 dark:text-white">{detail.body}</p>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {detail?.status === 'FAILED' && (
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {t('msg.detail.retry')}
            </button>
          )}
          <button type="button" onClick={closeDetail} className="rounded-lg px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            {t('pay.close')}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

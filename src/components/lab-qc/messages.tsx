'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  MESSAGE_STATUSES,
  ingestStatusClass,
  messageStatusClass,
  segmentType,
  splitRawMessage,
  type InstrumentMessage,
  type InstrumentMessageStatus,
  type LabInstrument,
} from '@/lib/lab-qc';
import { DialogShell, ErrorBox, cancelBtn, labelClass, messageOf, selectClass, smallBtn } from './ui';
import { usePolling } from '@/components/inpatient/ui';

const PAGE_SIZE = 25;

/** Inbound analyser messages, newest first, with filters and the raw text */
export function MessageLog({ instruments }: { instruments: LabInstrument[] }) {
  const { t, formatDateTime } = useLanguage();
  const [instrumentId, setInstrumentId] = useState('');
  const [status, setStatus] = useState<InstrumentMessageStatus | ''>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<InstrumentMessage[] | null>(null);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<InstrumentMessage | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getInstrumentMessages({ instrumentId: instrumentId || undefined, status, page, limit: PAGE_SIZE });
      setRows(res.data);
      setPages(Math.max(1, res.pagination?.totalPages ?? 1));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('qc.loadFailed')));
      setRows([]);
    }
  }, [instrumentId, status, page, t]);

  const refresh = useCallback(() => void load(), [load]);
  usePolling(refresh, null);

  const codeOf = (m: InstrumentMessage) => m.instrument?.code ?? instruments.find((i) => i.id === m.instrumentId)?.code ?? '—';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="msg-instrument" className={labelClass}>
            {t('instr.messages.instrument')}
          </label>
          <select
            id="msg-instrument"
            className={selectClass}
            value={instrumentId}
            onChange={(e) => {
              setInstrumentId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('instr.messages.all')}</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="msg-status" className={labelClass}>
            {t('instr.messages.status')}
          </label>
          <select
            id="msg-status"
            className={selectClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as InstrumentMessageStatus | '');
              setPage(1);
            }}
          >
            <option value="">{t('instr.messages.all')}</option>
            {MESSAGE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`instr.msgStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ErrorBox message={error} />
      {rows === null ? (
        <p className="text-sm text-gray-500">{t('qc.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('instr.messages.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="py-2 pr-3">{t('instr.messages.received')}</th>
                <th className="py-2 pr-3">{t('instr.messages.instrument')}</th>
                <th className="py-2 pr-3">{t('instr.messages.transport')}</th>
                <th className="py-2 pr-3">{t('instr.messages.status')}</th>
                <th className="py-2 pr-3 text-right">{t('instr.messages.results')}</th>
                <th className="py-2 pr-3">{t('instr.messages.samples')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(m.receivedAt)}</td>
                  <td className="py-2 pr-3 font-mono">{codeOf(m)}</td>
                  <td className="py-2 pr-3">
                    {m.transport} · {m.protocol === 'ASTM_E1394' ? 'ASTM' : m.protocol === 'HL7_V2' ? 'HL7' : m.protocol}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${messageStatusClass(m.status)}`}>{t(`instr.msgStatus.${m.status}`)}</span>
                    {m.error && <p className="text-xs text-red-700 dark:text-red-400 mt-0.5 max-w-xs truncate" title={m.error}>{m.error}</p>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.resultsCount}</td>
                  <td className="py-2 pr-3 font-mono text-xs max-w-[12rem] truncate" title={m.sampleBarcodes.join(', ')}>
                    {m.sampleBarcodes.join(', ') || '—'}
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" className={smallBtn} onClick={() => setViewing(m)}>
                      {t('instr.messages.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" className={smallBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('instr.messages.prev')}
          </button>
          <span className="text-gray-600 dark:text-gray-400">{t('instr.messages.page', { page, pages })}</span>
          <button type="button" className={smallBtn} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t('instr.messages.next')}
          </button>
        </div>
      )}
      {viewing && <RawMessageDialog message={viewing} code={codeOf(viewing)} onClose={() => setViewing(null)} />}
    </div>
  );
}

function RawMessageDialog({ message, code, onClose }: { message: InstrumentMessage; code: string; onClose: () => void }) {
  const { t, formatDateTime } = useLanguage();
  const lines = splitRawMessage(message.raw);
  return (
    <DialogShell
      title={t('instr.messages.title', { code, date: formatDateTime(message.receivedAt) })}
      onClose={onClose}
      wide
      footer={
        <button type="button" className={cancelBtn} onClick={onClose}>
          {t('common.close')}
        </button>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${messageStatusClass(message.status)}`}>{t(`instr.msgStatus.${message.status}`)}</span>
          <span className="text-gray-600 dark:text-gray-400">
            {message.transport} · {message.protocol}
          </span>
          {message.ackSent ? <span className="text-xs text-gray-500 dark:text-gray-400">· {t('instr.messages.ack')}</span> : null}
        </div>
        {message.error && <ErrorBox message={`${t('instr.messages.error')} : ${message.error}`} />}
        {message.results && message.results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {message.results.map((r, i) => (
                  <tr key={`${r.barcode}-${r.instrumentCode}-${i}`}>
                    <td className="py-1 pr-3 font-mono">{r.barcode}</td>
                    <td className="py-1 pr-3 font-mono">{r.instrumentCode}</td>
                    <td className="py-1 pr-3">{r.labTestCode ?? '—'}</td>
                    <td className="py-1 pr-3 tabular-nums">
                      {r.value ?? '—'} {r.unit ?? ''} {r.flag ?? ''}
                    </td>
                    <td className="py-1">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${ingestStatusClass(r.status)}`}>{t(`instr.result.${r.status}`)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div>
          <p className={labelClass}>{t('instr.messages.raw')}</p>
          <pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 text-gray-100 p-3 text-xs leading-relaxed font-mono">
            {lines.map((line, i) => {
              const type = segmentType(line);
              return (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {type ? <span className="text-lime-300 font-semibold">{line.slice(0, line.indexOf(type) + type.length)}</span> : null}
                  {type ? line.slice(line.indexOf(type) + type.length) : line}
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </DialogShell>
  );
}

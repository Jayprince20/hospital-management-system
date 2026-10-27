'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import {
  INSTRUMENT_CONNECTIONS,
  INSTRUMENT_PROTOCOLS,
  copyText,
  num,
  type InstrumentConnection,
  type InstrumentProtocol,
  type InstrumentTestMapping,
  type LabInstrument,
  type LabInstrumentInput,
  type LabTestRef,
} from '@/lib/lab-qc';
import { DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, selectClass, smallBtn } from './ui';

// ---------- list ----------

export function InstrumentsPanel({ instruments, tests, canEdit, onChanged }: { instruments: LabInstrument[]; tests: LabTestRef[]; canEdit: boolean; onChanged: () => void }) {
  const { t, formatDateTime } = useLanguage();
  const [editing, setEditing] = useState<LabInstrument | 'new' | null>(null);
  const [open, setOpen] = useState<string | null>(instruments.length === 1 ? instruments[0].id : null);
  const [keyFor, setKeyFor] = useState<LabInstrument | null>(null);

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <button type="button" className={primaryBtn} onClick={() => setEditing('new')}>
            {t('instr.add')}
          </button>
        </div>
      )}
      {instruments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('instr.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {instruments.map((i) => (
            <li key={i.id} className={`${cardClass} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    <span className="font-mono">{i.code}</span> · {i.name}
                    {!i.active && <span className="ml-2 text-xs font-normal text-gray-500">{t('instr.inactive')}</span>}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {[i.manufacturer, i.model, i.serialNumber ? `S/N ${i.serialNumber}` : null].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t(`instr.protocol.${i.protocol}`)} · {t(`instr.connection.${i.connection}`)}
                    {i.tcpPort ? ` :${i.tcpPort}` : ''} · {t('instr.lastMessage')} : {i.lastMessageAt ? formatDateTime(i.lastMessageAt) : t('instr.never')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={smallBtn} aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)}>
                    {t('instr.mappings')}
                  </button>
                  {canEdit && (
                    <>
                      <button type="button" className={smallBtn} onClick={() => setEditing(i)}>
                        {t('common.edit')}
                      </button>
                      {i.connection === 'HTTP' && (
                        <button type="button" className={smallBtn} onClick={() => setKeyFor(i)}>
                          {i.hasApiKey ? t('instr.key.regenerate') : t('instr.key.generate')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {open === i.id && <MappingsEditor instrument={i} tests={tests} canEdit={canEdit} />}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <InstrumentDialog
          instrument={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {keyFor && (
        <ApiKeyDialog
          instrument={keyFor}
          onClose={() => {
            setKeyFor(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// ---------- create / edit ----------

function InstrumentDialog({ instrument, onClose, onSaved }: { instrument: LabInstrument | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [f, setF] = useState({
    code: instrument?.code ?? '',
    name: instrument?.name ?? '',
    manufacturer: instrument?.manufacturer ?? '',
    model: instrument?.model ?? '',
    serialNumber: instrument?.serialNumber ?? '',
    protocol: (instrument?.protocol ?? 'HL7_V2') as InstrumentProtocol,
    connection: (instrument?.connection ?? 'HTTP') as InstrumentConnection,
    tcpPort: instrument?.tcpPort ? String(instrument.tcpPort) : '',
    active: instrument?.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [key]: e.target.value }));
  const tcp = f.connection === 'TCP_MLLP' || f.connection === 'TCP_ASTM';

  const save = async () => {
    if (!f.code.trim() || !f.name.trim()) return setError(t('instr.required'));
    const port = num(f.tcpPort);
    if (tcp && (port === null || !Number.isInteger(port) || port < 1024 || port > 65535)) return setError(t('instr.portRequired'));
    const input: LabInstrumentInput = {
      code: f.code.trim().toUpperCase(),
      name: f.name.trim(),
      manufacturer: f.manufacturer.trim() || null,
      model: f.model.trim() || null,
      serialNumber: f.serialNumber.trim() || null,
      protocol: f.protocol,
      connection: f.connection,
      tcpPort: tcp ? port : null,
      active: f.active,
    };
    setBusy(true);
    setError('');
    try {
      if (instrument) await api.updateLabInstrument(instrument.id, input);
      else await api.createLabInstrument(input);
      toast.success(t('instr.saved'));
      onSaved();
    } catch (err) {
      setError(messageOf(err, t('qc.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={instrument ? t('instr.edit') : t('instr.add')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="in-code" className={labelClass}>
              {t('instr.code')}
            </label>
            <input id="in-code" className={`${inputClass} font-mono`} value={f.code} onChange={set('code')} placeholder="HEMA-01" />
          </div>
          <div>
            <label htmlFor="in-name" className={labelClass}>
              {t('instr.name')}
            </label>
            <input id="in-name" className={inputClass} value={f.name} onChange={set('name')} placeholder="Sysmex XN-350" />
          </div>
          <div>
            <label htmlFor="in-manufacturer" className={labelClass}>
              {t('instr.manufacturer')}
            </label>
            <input id="in-manufacturer" className={inputClass} value={f.manufacturer} onChange={set('manufacturer')} />
          </div>
          <div>
            <label htmlFor="in-model" className={labelClass}>
              {t('instr.model')}
            </label>
            <input id="in-model" className={inputClass} value={f.model} onChange={set('model')} />
          </div>
          <div>
            <label htmlFor="in-serial" className={labelClass}>
              {t('instr.serial')}
            </label>
            <input id="in-serial" className={inputClass} value={f.serialNumber} onChange={set('serialNumber')} />
          </div>
          <div>
            <label htmlFor="in-protocol" className={labelClass}>
              {t('instr.protocol')}
            </label>
            <select id="in-protocol" className={`${selectClass} w-full`} value={f.protocol} onChange={(e) => setF((prev) => ({ ...prev, protocol: e.target.value as InstrumentProtocol }))}>
              {INSTRUMENT_PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {t(`instr.protocol.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="in-connection" className={labelClass}>
              {t('instr.connection')}
            </label>
            <select id="in-connection" className={`${selectClass} w-full`} value={f.connection} onChange={(e) => setF((prev) => ({ ...prev, connection: e.target.value as InstrumentConnection }))}>
              {INSTRUMENT_CONNECTIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`instr.connection.${c}`)}
                </option>
              ))}
            </select>
          </div>
          {tcp && (
            <div>
              <label htmlFor="in-port" className={labelClass}>
                {t('instr.tcpPort')}
              </label>
              <input id="in-port" inputMode="numeric" className={inputClass} value={f.tcpPort} onChange={set('tcpPort')} placeholder="5100" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
            <input type="checkbox" checked={f.active} onChange={(e) => setF((prev) => ({ ...prev, active: e.target.checked }))} />
            {t('instr.active')}
          </label>
        </div>
      </div>
    </DialogShell>
  );
}

// ---------- test code mappings ----------

function MappingsEditor({ instrument, tests, canEdit }: { instrument: LabInstrument; tests: LabTestRef[]; canEdit: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [rows, setRows] = useState<InstrumentTestMapping[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ instrumentCode: '', labTestId: '', unitFactor: '1' });
  const [edits, setEdits] = useState<Record<string, { labTestId: string; unitFactor: string }>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.getInstrumentMappings(instrument.id));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('qc.loadFailed')));
      setRows([]);
    }
  }, [instrument.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const testLabel = (id: string, row?: InstrumentTestMapping) => {
    const test = row?.labTest ?? tests.find((x) => x.id === id);
    return test ? `${test.name} (${test.code})` : '—';
  };

  const add = async () => {
    const factor = num(draft.unitFactor);
    if (!draft.instrumentCode.trim() || !draft.labTestId) return setError(t('instr.mappings.required'));
    setBusy(true);
    try {
      await api.createInstrumentMapping(instrument.id, { instrumentCode: draft.instrumentCode.trim(), labTestId: draft.labTestId, unitFactor: factor ?? 1 });
      toast.success(t('instr.mappings.saved'));
      setDraft({ instrumentCode: '', labTestId: '', unitFactor: '1' });
      setError('');
      await load();
    } catch (err) {
      setError(messageOf(err, t('qc.actionFailed')));
    } finally {
      setBusy(false);
    }
  };

  const saveRow = async (row: InstrumentTestMapping) => {
    const edit = edits[row.id];
    if (!edit) return;
    setBusy(true);
    try {
      await api.updateInstrumentMapping(instrument.id, row.id, { labTestId: edit.labTestId, unitFactor: num(edit.unitFactor) ?? 1 });
      toast.success(t('instr.mappings.saved'));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await load();
    } catch (err) {
      setError(messageOf(err, t('qc.actionFailed')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: InstrumentTestMapping) => {
    setBusy(true);
    try {
      await api.deleteInstrumentMapping(instrument.id, row.id);
      toast.success(t('instr.mappings.deleted'));
      await load();
    } catch (err) {
      setError(messageOf(err, t('qc.actionFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-3">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('instr.mappings')}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('instr.mappings.subtitle')} · {t('instr.mappings.factorHint')}
      </p>
      <div className="mt-2">
        <ErrorBox message={error} />
      </div>
      {rows === null ? (
        <p className="text-sm text-gray-500 mt-2">{t('qc.loading')}</p>
      ) : (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-1.5 pr-3">{t('instr.mappings.instrumentCode')}</th>
                <th className="py-1.5 pr-3">{t('instr.mappings.test')}</th>
                <th className="py-1.5 pr-3 w-28">{t('instr.mappings.factor')}</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-gray-500 dark:text-gray-400">
                    {t('instr.mappings.empty')}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const edit = edits[row.id];
                return (
                  <tr key={row.id}>
                    <td className="py-1.5 pr-3 font-mono">{row.instrumentCode}</td>
                    <td className="py-1.5 pr-3">
                      {canEdit ? (
                        <select
                          aria-label={t('instr.mappings.test')}
                          className={`${selectClass} w-full`}
                          value={edit?.labTestId ?? row.labTestId}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { labTestId: e.target.value, unitFactor: prev[row.id]?.unitFactor ?? String(row.unitFactor) } }))}
                        >
                          {!tests.some((x) => x.id === row.labTestId) && <option value={row.labTestId}>{testLabel(row.labTestId, row)}</option>}
                          {tests.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name} ({x.code})
                            </option>
                          ))}
                        </select>
                      ) : (
                        testLabel(row.labTestId, row)
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      {canEdit ? (
                        <input
                          aria-label={t('instr.mappings.factor')}
                          inputMode="decimal"
                          className={inputClass}
                          value={edit?.unitFactor ?? String(row.unitFactor)}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: { labTestId: prev[row.id]?.labTestId ?? row.labTestId, unitFactor: e.target.value } }))}
                        />
                      ) : (
                        String(row.unitFactor).replace('.', ',')
                      )}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {canEdit && (
                        <span className="inline-flex gap-1.5">
                          {edit && (
                            <button type="button" className={smallBtn} disabled={busy} onClick={() => saveRow(row)}>
                              {t('common.save')}
                            </button>
                          )}
                          <button type="button" className={smallBtn} disabled={busy} onClick={() => remove(row)}>
                            {t('instr.mappings.delete')}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {canEdit && (
                <tr>
                  <td className="py-1.5 pr-3">
                    <input
                      aria-label={t('instr.mappings.instrumentCode')}
                      className={`${inputClass} font-mono`}
                      placeholder="WBC"
                      value={draft.instrumentCode}
                      onChange={(e) => setDraft((d) => ({ ...d, instrumentCode: e.target.value }))}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <select aria-label={t('instr.mappings.test')} className={`${selectClass} w-full`} value={draft.labTestId} onChange={(e) => setDraft((d) => ({ ...d, labTestId: e.target.value }))}>
                      <option value="">{t('qc.materials.chooseTest')}</option>
                      {tests.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} ({x.code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <input aria-label={t('instr.mappings.factor')} inputMode="decimal" className={inputClass} value={draft.unitFactor} onChange={(e) => setDraft((d) => ({ ...d, unitFactor: e.target.value }))} />
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" className={primaryBtn} disabled={busy} onClick={add}>
                      {t('instr.mappings.add')}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- API key (shown once) ----------

function ApiKeyDialog({ instrument, onClose }: { instrument: LabInstrument; onClose: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      setKey(await api.generateLabInstrumentKey(instrument.id));
    } catch (err) {
      setError(messageOf(err, t('qc.actionFailed')));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!key) return;
    if (await copyText(key)) toast.success(t('instr.key.copied'));
    else toast.error(t('instr.key.copyFailed'));
  };

  return (
    <DialogShell
      title={t('instr.key.title', { name: instrument.name })}
      onClose={onClose}
      footer={
        key ? (
          <button type="button" className={primaryBtn} onClick={onClose}>
            {t('instr.key.done')}
          </button>
        ) : (
          <>
            <button type="button" className={cancelBtn} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className={instrument.hasApiKey ? dangerBtn : primaryBtn} onClick={generate} disabled={busy}>
              {instrument.hasApiKey ? t('instr.key.regenerate') : t('instr.key.generate')}
            </button>
          </>
        )
      }
    >
      <div className="space-y-3 text-sm">
        <ErrorBox message={error} />
        {!key && instrument.hasApiKey && <p className="text-gray-700 dark:text-gray-300">{t('instr.key.confirm')}</p>}
        {key && (
          <>
            <div role="alert" className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              {t('instr.key.warning')}
            </div>
            <div className="flex gap-2">
              <input readOnly aria-label={t('instr.key.title', { name: instrument.name })} className={`${inputClass} font-mono text-xs`} value={key} onFocus={(e) => e.target.select()} />
              <button type="button" className={smallBtn} onClick={copy}>
                {t('instr.key.copy')}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('instr.key.header', { code: instrument.code })}</p>
          </>
        )}
      </div>
    </DialogShell>
  );
}

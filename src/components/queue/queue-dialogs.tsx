'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type Department, type Doctor, type Patient, type QueueTicket } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

function DialogShell({ title, children, footer, onClose, wide = false }: { title: string; children: ReactNode; footer: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-white dark:bg-gray-800 rounded-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const cancelBtn = 'px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700';
const primaryBtn = 'px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg disabled:opacity-50';
const dangerBtn = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50';

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{message}</div>;
}

const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** Room to call a patient to; used for one ticket and for "call next" */
export function CallDialog({
  title,
  initialRoom,
  onClose,
  onConfirm,
}: {
  title: string;
  initialRoom: string;
  onClose: () => void;
  onConfirm: (room: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [room, setRoom] = useState(initialRoom);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!room.trim()) return setError(t('q.call.roomRequired'));
    setSaving(true);
    setError('');
    try {
      await onConfirm(room.trim());
    } catch (err) {
      setError(messageOf(err, t('q.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ins.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('q.call.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="queue-room">{t('q.call.room')}</label>
        <input
          id="queue-room"
          autoFocus
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('q.call.roomPlaceholder')}
          className={inputClass}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('q.call.smsHint')}</p>
    </DialogShell>
  );
}

export function CancelDialog({ ticket, onClose, onConfirm }: { ticket: QueueTicket; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return setError(t('q.cancel.reasonRequired'));
    setSaving(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(messageOf(err, t('q.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('q.cancel.title', { number: ticket.number })}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ins.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={dangerBtn}>{t('q.cancel.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="queue-cancel-reason">{t('q.cancel.reason')}</label>
        <textarea id="queue-cancel-reason" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  useEffect(() => {
    api
      .getDepartments({ isActive: true, limit: 100 })
      .then((res) => setDepartments(res.departments))
      .catch(() => setDepartments([]));
  }, []);
  return departments;
}

function useDoctors(departmentId: string) {
  // Keyed by department so a change of department never shows the previous list
  const [loaded, setLoaded] = useState<{ departmentId: string; doctors: Doctor[] }>({ departmentId: '', doctors: [] });
  useEffect(() => {
    if (!departmentId) return;
    let live = true;
    api
      .getDoctors({ department: departmentId, limit: 100 })
      .then((res) => live && setLoaded({ departmentId, doctors: res.data }))
      .catch(() => live && setLoaded({ departmentId, doctors: [] }));
    return () => {
      live = false;
    };
  }, [departmentId]);
  return departmentId && loaded.departmentId === departmentId ? loaded.doctors : [];
}

export function TransferDialog({
  ticket,
  onClose,
  onConfirm,
}: {
  ticket: QueueTicket;
  onClose: () => void;
  onConfirm: (data: { departmentId?: string; doctorId?: string | null }) => Promise<void>;
}) {
  const { t } = useLanguage();
  const departments = useDepartments();
  const [departmentId, setDepartmentId] = useState(ticket.department.id);
  const [doctorId, setDoctorId] = useState(ticket.doctor?.id ?? '');
  const doctors = useDoctors(departmentId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        ...(departmentId !== ticket.department.id ? { departmentId } : {}),
        doctorId: doctorId || null,
      });
    } catch (err) {
      setError(messageOf(err, t('q.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('q.transfer.title', { number: ticket.number })}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ins.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('q.transfer.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('q.transfer.hint')}</p>
      <div>
        <label className={labelClass} htmlFor="queue-transfer-dept">{t('q.department')}</label>
        <select
          id="queue-transfer-dept"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setDoctorId('');
          }}
          className={inputClass}
        >
          {departments.length === 0 && <option value={ticket.department.id}>{ticket.department.name}</option>}
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="queue-transfer-doctor">{t('q.transfer.doctor')}</label>
        <select id="queue-transfer-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
          <option value="">{t('q.ticket.anyDoctor')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>Dr {d.firstName} {d.lastName}</option>
          ))}
        </select>
      </div>
    </DialogShell>
  );
}

export function NewTicketDialog({
  defaultDepartmentId,
  onClose,
  onCreated,
}: {
  defaultDepartmentId: string;
  onClose: () => void;
  onCreated: (ticket: QueueTicket) => void;
}) {
  const { t } = useLanguage();
  const departments = useDepartments();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [source, setSource] = useState<'WALK_IN' | 'EMERGENCY'>('WALK_IN');
  const [chosenDepartmentId, setDepartmentId] = useState(defaultDepartmentId);
  // Without a choice (queue showing all departments), start on the first one
  const departmentId = chosenDepartmentId || departments[0]?.id || '';
  const [doctorId, setDoctorId] = useState('');
  const doctors = useDoctors(departmentId);
  const [needsTriage, setNeedsTriage] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const searchSeq = useRef(0);

  const query = search.trim();
  const showResults = !patient && query.length >= 2;
  const visibleResults = showResults ? results : [];

  useEffect(() => {
    if (!showResults) return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .getPatients({ search: query, limit: 8 })
        .then((res) => seq === searchSeq.current && setResults(res.data.filter((p) => !p.anonymizedAt)))
        .catch(() => seq === searchSeq.current && setResults([]))
        .finally(() => seq === searchSeq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, showResults]);

  const submit = async () => {
    if (!patient) return setError(t('q.new.patientRequired'));
    if (!departmentId) return setError(t('q.new.departmentRequired'));
    setSaving(true);
    setError('');
    try {
      const ticket = await api.createQueueTicket({
        patientId: patient.id,
        departmentId,
        ...(doctorId ? { doctorId } : {}),
        source,
        needsTriage: source === 'EMERGENCY' ? true : needsTriage,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onCreated(ticket);
    } catch (err) {
      setError(messageOf(err, t('q.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('q.new.title')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ins.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('q.new.create')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="queue-new-patient">{t('q.new.patient')}</label>
        {patient ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.patientId}</p>
            </div>
            <button type="button" onClick={() => { setPatient(null); setSearch(''); }} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">
              {t('q.new.change')}
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              id="queue-new-patient"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('q.new.searchPatient')}
              className={inputClass}
              autoComplete="off"
            />
            {showResults && !searching && visibleResults.length === 0 && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('q.new.noPatient')}</p>
            )}
            {visibleResults.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {visibleResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { setPatient(p); setResults([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <span className="text-gray-900 dark:text-white">{p.firstName} {p.lastName}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{p.patientId}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div>
        <span className={labelClass}>{t('q.new.source')}</span>
        <div className="flex gap-2">
          {(['WALK_IN', 'EMERGENCY'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSource(value);
                // Emergencies go to the emergency department when there is one
                const emergencyDept = departments.find((d) => /urgence|emergenc/i.test(d.name));
                if (value === 'EMERGENCY' && emergencyDept) { setDepartmentId(emergencyDept.id); setDoctorId(''); }
              }}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                source === value
                  ? value === 'EMERGENCY'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
              aria-pressed={source === value}
            >
              {t(`q.source.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="queue-new-dept">{t('q.department')}</label>
          <select id="queue-new-dept" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setDoctorId(''); }} className={inputClass}>
            {!departmentId && <option value="">{t('q.chooseDepartment')}</option>}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="queue-new-doctor">{t('q.new.doctorOptional')}</label>
          <select id="queue-new-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
            <option value="">{t('q.ticket.anyDoctor')}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>Dr {d.firstName} {d.lastName}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={source === 'EMERGENCY' ? true : needsTriage}
          disabled={source === 'EMERGENCY'}
          onChange={(e) => setNeedsTriage(e.target.checked)}
          className="mt-1 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
        />
        <span>
          <span className="text-sm text-gray-900 dark:text-white">{t('q.new.needsTriage')}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">{t('q.new.needsTriageHint')}</span>
        </span>
      </label>

      <div>
        <label className={labelClass} htmlFor="queue-new-notes">{t('q.new.notes')}</label>
        <textarea id="queue-new-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

export function DisplayLinkDialog({ departmentId, departmentName, onClose }: { departmentId: string; departmentName: string | null; onClose: () => void }) {
  const { t, formatDate } = useLanguage();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .createQueueDisplayToken(departmentId || undefined)
      .then((res) => {
        if (!live) return;
        const path = res.path || `/queue-display?token=${encodeURIComponent(res.token)}`;
        setLink({ url: `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`, expiresAt: res.expiresAt });
      })
      .catch((err) => live && setError(messageOf(err, t('q.actionFailed'))));
    return () => {
      live = false;
    };
  }, [departmentId, t]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DialogShell
      title={t('q.display.title')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('q.display.close')}</button>
          {link && (
            <a href={link.url} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
              {t('q.display.open')}
            </a>
          )}
        </>
      }
    >
      <ErrorBox message={error} />
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('q.display.hint')}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {departmentName ? t('q.display.forDepartment', { name: departmentName }) : t('q.display.forAll')}
      </p>
      {!link && !error && <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />}
      {link && (
        <>
          <div className="flex gap-2">
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-xs`} aria-label={t('q.display.title')} />
            <button type="button" onClick={copy} className={cancelBtn}>{copied ? t('q.display.copied') : t('q.display.copy')}</button>
          </div>
          {link.expiresAt && <p className="text-xs text-gray-500 dark:text-gray-400">{t('q.display.expires', { date: formatDate(link.expiresAt) })}</p>}
        </>
      )}
    </DialogShell>
  );
}

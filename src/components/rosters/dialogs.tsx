'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type LeaveRequest, type RosterShift, type RosterStaffMember, type ShiftType } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { addDays, isoDate, weekStart } from '@/lib/rosters';
import { DialogShell, ErrorBox, ShiftChip, ShiftHours, cancelBtn, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, useDayLabel } from './ui';

/** Add, change or remove the shift(s) of one person on one day */
export function ShiftCellDialog({
  person,
  date,
  shifts,
  shiftTypes,
  departmentId,
  onClose,
  onChanged,
}: {
  person: RosterStaffMember;
  date: string;
  shifts: RosterShift[];
  shiftTypes: ShiftType[];
  departmentId: string;
  onClose: () => void;
  onChanged: (warnings: Array<{ type: string; message?: string }>) => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const dayLabel = useDayLabel();
  const current = shifts[0] ?? null;
  const [typeId, setTypeId] = useState(current?.shiftType.id ?? shiftTypes[0]?.id ?? '');
  const [note, setNote] = useState(current?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!typeId) return;
    setSaving(true);
    setError('');
    try {
      if (current) {
        await api.updateRosterShift(current.id, { shiftTypeId: typeId, note: note.trim() || null });
        onChanged([]);
      } else {
        const res = await api.createRosterShift({ userId: person.userId, departmentId, date, shiftTypeId: typeId, ...(note.trim() ? { note: note.trim() } : {}) });
        onChanged(res.warnings);
      }
      toast.success(t('ros.cell.saved'));
    } catch (err) {
      setError(messageOf(err, t('ros.actionFailed')));
      setSaving(false);
    }
  };

  const remove = async (shift: RosterShift) => {
    setSaving(true);
    setError('');
    try {
      await api.deleteRosterShift(shift.id);
      toast.success(t('ros.cell.removed'));
      onChanged([]);
    } catch (err) {
      setError(messageOf(err, t('ros.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={person.name}
      subtitle={dayLabel(date)}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ros.cancel')}</button>
          <button type="button" onClick={save} disabled={saving || !typeId} className={primaryBtn}>
            {current ? t('ros.cell.change') : t('ros.cell.add')}
          </button>
        </>
      }
    >
      {shifts.length > 0 && (
        <ul className="space-y-2">
          {shifts.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <ShiftChip shiftType={s.shiftType} />
                {s.shiftType.name} · <ShiftHours shift={s} />
              </span>
              <button type="button" onClick={() => remove(s)} disabled={saving} className="text-sm text-red-600 dark:text-red-400 hover:underline">
                {t('ros.cell.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <fieldset>
        <legend className={labelClass}>{t('ros.cell.type')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {shiftTypes.map((type) => (
            <label key={type.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${typeId === type.id ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="radio" name="shift-type" value={type.id} checked={typeId === type.id} onChange={() => setTypeId(type.id)} className="sr-only" />
              <ShiftChip shiftType={type} />
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {type.name}
                <span className="block text-xs text-gray-500 dark:text-gray-400 tabular-nums">{type.startTime}–{type.endTime}{type.isOnCall ? ` · ${t('ros.onCallShort')}` : ''}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="shift-note" className={labelClass}>{t('ros.cell.note')}</label>
        <input id="shift-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder={t('ros.cell.notePlaceholder')} />
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}

/** Copy one week's planned shifts onto another week (conflicts are skipped by the server) */
export function CopyWeekDialog({ departmentId, month, onClose, onDone }: { departmentId: string; month: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const firstMonday = weekStart(`${month}-01`);
  const [from, setFrom] = useState(firstMonday);
  const [to, setTo] = useState(addDays(firstMonday, 7));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const copy = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.copyRosterWeek(departmentId, weekStart(from), weekStart(to));
      toast.success(t('ros.copy.done', { count: res.created ?? res.copied ?? 0, skipped: res.skipped ?? 0 }));
      onDone();
    } catch (err) {
      setError(messageOf(err, t('ros.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('ros.copy.title')}
      subtitle={t('ros.copy.subtitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ros.cancel')}</button>
          <button type="button" onClick={copy} disabled={saving || weekStart(from) === weekStart(to)} className={primaryBtn}>{t('ros.copy.confirm')}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="copy-from" className={labelClass}>{t('ros.copy.from')}</label>
          <input id="copy-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('ros.copy.weekOf', { date: weekStart(from) })}</p>
        </div>
        <div>
          <label htmlFor="copy-to" className={labelClass}>{t('ros.copy.to')}</label>
          <input id="copy-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('ros.copy.weekOf', { date: weekStart(to) })}</p>
        </div>
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}

/** Offer one of my shifts to a colleague, optionally taking one of theirs in return */
export function ProposeSwapDialog({ shift, colleagues, onClose, onDone }: { shift: RosterShift; colleagues: RosterStaffMember[]; onClose: () => void; onDone: () => void }) {
  const { t, tEnum } = useLanguage();
  const toast = useToast();
  const dayLabel = useDayLabel();
  const [peerId, setPeerId] = useState('');
  const [peerShifts, setPeerShifts] = useState<RosterShift[]>([]);
  const [toShiftId, setToShiftId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The colleague's own upcoming shifts in the same department (published roster of the month)
  useEffect(() => {
    if (!peerId) return;
    let live = true;
    const month = shift.date.slice(0, 7);
    api
      .getRoster(shift.departmentId, month)
      .then((view) => {
        if (!live) return;
        const today = isoDate(new Date());
        setPeerShifts(view.shifts.filter((s) => s.userId === peerId && s.status !== 'CANCELLED' && s.date.slice(0, 10) >= today));
      })
      .catch(() => live && setPeerShifts([]));
    return () => {
      live = false;
    };
  }, [peerId, shift.date, shift.departmentId]);

  const send = async () => {
    if (!peerId) return setError(t('ros.swap.pickColleague'));
    setSaving(true);
    setError('');
    try {
      await api.requestShiftSwap({ fromShiftId: shift.id, peerId, ...(toShiftId ? { toShiftId } : {}), ...(message.trim() ? { message: message.trim() } : {}) });
      toast.success(t('ros.swap.sent'));
      onDone();
    } catch (err) {
      setError(messageOf(err, t('ros.actionFailed')));
      setSaving(false);
    }
  };

  const others = colleagues.filter((c) => c.userId !== shift.userId);

  return (
    <DialogShell
      title={t('ros.swap.title')}
      subtitle={`${dayLabel(shift.date)} · ${shift.shiftType.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ros.cancel')}</button>
          <button type="button" onClick={send} disabled={saving} className={primaryBtn}>{t('ros.swap.send')}</button>
        </>
      }
    >
      <div>
        <label htmlFor="swap-peer" className={labelClass}>{t('ros.swap.colleague')}</label>
        <select
          id="swap-peer"
          value={peerId}
          onChange={(e) => {
            setPeerId(e.target.value);
            setToShiftId('');
            setPeerShifts([]);
          }}
          className={inputClass}
        >
          <option value="">{t('ros.swap.choose')}</option>
          {others.map((c) => (
            <option key={c.userId} value={c.userId}>{c.name} · {c.title || tEnum(c.role)}</option>
          ))}
        </select>
      </div>
      {peerId && (
        <div>
          <label htmlFor="swap-back" className={labelClass}>{t('ros.swap.inReturn')}</label>
          <select id="swap-back" value={toShiftId} onChange={(e) => setToShiftId(e.target.value)} className={inputClass}>
            <option value="">{t('ros.swap.nothingBack')}</option>
            {peerShifts.map((s) => (
              <option key={s.id} value={s.id}>{dayLabel(s.date)} · {s.shiftType.code} {s.shiftType.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="swap-message" className={labelClass}>{t('ros.swap.message')}</label>
        <textarea id="swap-message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('ros.swap.flow')}</p>
      <ErrorBox message={error} />
    </DialogShell>
  );
}

/** Approve or reject a leave request; after approval, list the shifts that were cancelled */
export function LeaveDecisionDialog({ request, onClose, onDone }: { request: LeaveRequest; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const dayLabel = useDayLabel();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelled, setCancelled] = useState<RosterShift[] | null>(null);

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (decision === 'REJECT' && !note.trim()) return setError(t('ros.leave.rejectNoteRequired'));
    setSaving(true);
    setError('');
    try {
      const res = await api.decideLeave(request.id, decision, note.trim() || undefined);
      toast.success(t(decision === 'APPROVE' ? 'ros.leave.approved' : 'ros.leave.rejected'));
      if (decision === 'APPROVE' && res.cancelledShifts.length > 0) {
        setCancelled(res.cancelledShifts);
        setSaving(false);
      } else {
        onDone();
      }
    } catch (err) {
      setError(messageOf(err, t('ros.actionFailed')));
      setSaving(false);
    }
  };

  const name = useMemo(
    () => request.userName ?? request.user?.name ?? `${request.user?.firstName ?? ''} ${request.user?.lastName ?? ''}`.trim(),
    [request]
  );

  if (cancelled) {
    return (
      <DialogShell
        title={t('ros.leave.cancelledShiftsTitle')}
        subtitle={t('ros.leave.cancelledShiftsSubtitle', { name })}
        onClose={onDone}
        footer={<button type="button" onClick={onDone} className={primaryBtn}>{t('ros.close')}</button>}
      >
        <ul className="space-y-1.5">
          {cancelled.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <ShiftChip shiftType={s.shiftType} size="xs" /> {dayLabel(s.date)} · {s.shiftType.name}
            </li>
          ))}
        </ul>
        <p className="text-sm text-amber-700 dark:text-amber-300">{t('ros.leave.reassign')}</p>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      title={t('ros.leave.decideTitle', { name })}
      subtitle={`${t(`ros.leaveType.${request.type}`)} · ${dayLabel(request.startDate)} → ${dayLabel(request.endDate)} · ${t('ros.leave.daysCount', { count: request.days })}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ros.cancel')}</button>
          <button type="button" onClick={() => decide('REJECT')} disabled={saving} className={dangerBtn}>{t('ros.leave.reject')}</button>
          <button type="button" onClick={() => decide('APPROVE')} disabled={saving} className={primaryBtn}>{t('ros.leave.approve')}</button>
        </>
      }
    >
      {request.reason && <p className="text-sm text-gray-700 dark:text-gray-300">« {request.reason} »</p>}
      {(request.conflicts ?? 0) > 0 && (
        <p className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-sm text-amber-800 dark:text-amber-200">
          {t('ros.leave.conflicts', { count: request.conflicts ?? 0 })}
        </p>
      )}
      <div>
        <label htmlFor="leave-note" className={labelClass}>{t('ros.leave.note')}</label>
        <textarea id="leave-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, type ShiftType, type ShiftTypeInput } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { isValidTime, shiftSpan } from '@/lib/rosters';
import { ShiftChip, useRosterDepartments, useShiftTypes } from '@/components/rosters';
import { DialogShell, ErrorBox, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/rosters/ui';

const EMPTY: ShiftTypeInput = { code: '', name: '', startTime: '08:00', endTime: '16:00', isOnCall: false, color: '#84cc16', isActive: true };

function ShiftTypeDialog({ initial, onClose, onSaved }: { initial: ShiftType | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<ShiftTypeInput>(initial ? { ...initial } : EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ShiftTypeInput>(key: K, value: ShiftTypeInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const timesOk = isValidTime(form.startTime) && isValidTime(form.endTime);
  const span = timesOk ? shiftSpan('2026-01-05', form.startTime, form.endTime) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return setError(t('ros.types.required'));
    if (!timesOk) return setError(t('ros.types.badTime'));
    setSaving(true);
    setError('');
    try {
      const input = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() };
      if (initial) await api.updateShiftType(initial.id, input);
      else await api.createShiftType(input);
      onSaved();
    } catch (err) {
      setError(messageOf(err, t('ros.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={initial ? t('ros.types.edit') : t('ros.types.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('ros.cancel')}</button>
          <button type="submit" form="shift-type-form" disabled={saving} className={primaryBtn}>{t('ros.save')}</button>
        </>
      }
    >
      <form id="shift-type-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="st-code" className={labelClass}>{t('ros.types.code')}</label>
            <input id="st-code" value={form.code} maxLength={4} onChange={(e) => set('code', e.target.value)} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label htmlFor="st-name" className={labelClass}>{t('ros.types.name')}</label>
            <input id="st-name" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="st-start" className={labelClass}>{t('ros.types.start')}</label>
            <input id="st-start" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-end" className={labelClass}>{t('ros.types.end')}</label>
            <input id="st-end" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="st-color" className={labelClass}>{t('ros.types.color')}</label>
            <input id="st-color" type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600" />
          </div>
        </div>
        {span && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('ros.types.duration', { hours: span.hours })}
            {span.overnight ? ` · ${t('ros.nextDay')}` : ''}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={form.isOnCall} onChange={(e) => set('isOnCall', e.target.checked)} className="rounded" />
          {t('ros.types.isOnCall')}
        </label>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t('ros.types.preview')} <ShiftChip shiftType={{ ...form, code: form.code.toUpperCase() || '?' }} />
        </div>
        <ErrorBox message={error} />
      </form>
    </DialogShell>
  );
}

export default function RosterSettingsPage() {
  const { user } = useAuth();
  const { t, tEnum } = useLanguage();
  const toast = useToast();
  const { types, reload: reloadTypes } = useShiftTypes(true);
  const { departments, reload: reloadDepartments } = useRosterDepartments();
  const [editing, setEditing] = useState<ShiftType | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (user && user.role !== 'ADMIN') {
    return <p className="text-sm text-gray-600 dark:text-gray-300">{t('ros.adminOnly')}</p>;
  }

  const toggleActive = async (type: ShiftType) => {
    setBusy(type.id);
    try {
      await api.updateShiftType(type.id, { isActive: !type.isActive });
      reloadTypes();
    } catch (err) {
      toast.error(t('ros.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  const setHead = async (departmentId: string, userId: string) => {
    setBusy(departmentId);
    try {
      await api.setDepartmentHead(departmentId, userId || null);
      toast.success(t('ros.heads.saved'));
      reloadDepartments();
    } catch (err) {
      toast.error(t('ros.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ros.settings.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ros.settings.subtitle')}</p>
        </div>
        <Link href="/dashboard/rosters" className={smallBtn}>{t('ros.backToPlanning')}</Link>
      </div>

      <section className={`${cardClass} p-5`} aria-labelledby="types-title">
        <div className="flex items-center justify-between mb-3">
          <h2 id="types-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('ros.types.title')}</h2>
          <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>{t('ros.types.new')}</button>
        </div>
        {!types ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.loading')}</p>
        ) : types.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.types.none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3 font-medium">{t('ros.types.code')}</th>
                  <th className="py-2 pr-3 font-medium">{t('ros.types.name')}</th>
                  <th className="py-2 pr-3 font-medium">{t('ros.types.hours')}</th>
                  <th className="py-2 pr-3 font-medium">{t('ros.types.isOnCallShort')}</th>
                  <th className="py-2 pr-3 font-medium">{t('ros.types.status')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr key={type.id} className={`border-b border-gray-100 dark:border-gray-700/60 ${type.isActive ? '' : 'opacity-60'}`}>
                    <td className="py-2 pr-3"><ShiftChip shiftType={type} /></td>
                    <td className="py-2 pr-3 text-gray-900 dark:text-white">{type.name}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700 dark:text-gray-300">
                      {type.startTime} → {type.endTime} ({shiftSpan('2026-01-05', type.startTime, type.endTime).hours} h)
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{type.isOnCall ? t('ros.yes') : t('ros.no')}</td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{type.isActive ? t('ros.types.active') : t('ros.types.inactive')}</td>
                    <td className="py-2 text-right whitespace-nowrap space-x-2">
                      <button type="button" onClick={() => setEditing(type)} className={smallBtn}>{t('ros.types.editShort')}</button>
                      <button type="button" disabled={busy === type.id} onClick={() => toggleActive(type)} className={smallBtn}>
                        {type.isActive ? t('ros.types.deactivate') : t('ros.types.activate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${cardClass} p-5`} aria-labelledby="heads-title">
        <h2 id="heads-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('ros.heads.title')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('ros.heads.subtitle')}</p>
        {!departments ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.loading')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {departments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{d.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('ros.heads.staffCount', { count: d.staff.length })}</p>
                </div>
                <select
                  aria-label={t('ros.heads.label', { name: d.name })}
                  value={d.head?.id ?? ''}
                  disabled={busy === d.id}
                  onChange={(e) => setHead(d.id, e.target.value)}
                  className={`${inputClass} sm:w-72`}
                >
                  <option value="">{t('ros.heads.none')}</option>
                  {d.head && !d.staff.some((s) => s.userId === d.head?.id) && <option value={d.head.id}>{d.head.name}</option>}
                  {d.staff.map((s) => (
                    <option key={s.userId} value={s.userId}>{s.name} · {tEnum(s.role)}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <ShiftTypeDialog
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success(t('ros.types.saved'));
            reloadTypes();
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Doctor, type Patient } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  ACTIVE_STATUSES,
  ARRIVAL_MODES,
  ED_ZONES,
  dispositionsFor,
  freeBays,
  type BayState,
  type BoardRow,
  type EdArrivalMode,
  type EdDisposition,
  type EdStatus,
} from '@/lib/emergency';
import { DialogShell, ErrorBox, cancelBtn, dangerBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

const fullName = (row: Pick<BoardRow, 'patient'>) => `${row.patient.firstName} ${row.patient.lastName}`.trim();

function Footer({ onClose, onSave, busy, label, danger = false }: { onClose: () => void; onSave: () => void; busy: boolean; label?: string; danger?: boolean }) {
  const { t } = useLanguage();
  return (
    <>
      <button type="button" onClick={onClose} className={cancelBtn}>{t('ed.cancel')}</button>
      <button type="button" onClick={onSave} disabled={busy} className={danger ? dangerBtn : primaryBtn}>{label ?? t('ed.save')}</button>
    </>
  );
}

// ---------- arrival ----------

export function ArrivalDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [sex, setSex] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [approxAge, setApproxAge] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<EdArrivalMode>('WALK_IN');
  const [complaint, setComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const query = search.trim();
  const showResults = !patient && !unknown && query.length >= 2;

  useEffect(() => {
    if (!showResults) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .getPatients({ search: query, limit: 8 })
        .then((res) => mine === seq.current && setResults(res.data.filter((p) => !p.anonymizedAt)))
        .catch(() => mine === seq.current && setResults([]))
        .finally(() => mine === seq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, showResults]);

  const submit = async () => {
    if (!unknown && !patient) return setError(t('ed.arr.patientRequired'));
    const age = Number(approxAge);
    if (unknown && (!sex || !approxAge || !Number.isFinite(age) || age < 0 || age > 120 || !description.trim())) return setError(t('ed.arr.unknownRequired'));
    if (!complaint.trim()) return setError(t('ed.arr.complaintRequired'));
    setBusy(true);
    setError('');
    try {
      await api.createEdEncounter({
        ...(unknown ? { unknownPatient: { sex: sex as 'MALE' | 'FEMALE' | 'OTHER', approxAge: Math.round(age), description: description.trim() } } : { patientId: patient!.id }),
        arrivalMode: mode,
        chiefComplaint: complaint.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onCreated();
    } catch (err) {
      setError(messageOf(err, t('ed.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t('ed.arr.title')} onClose={onClose} wide footer={<Footer onClose={onClose} onSave={submit} busy={busy} label={t('ed.arr.submit')} />}>
      <ErrorBox message={error} />
      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <label className={labelClass} htmlFor="ed-arrival-patient">{t('ed.arr.patient')}</label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={unknown} onChange={(e) => { setUnknown(e.target.checked); setPatient(null); }} className="rounded border-gray-300" />
            {t('ed.arr.unknown')}
          </label>
        </div>
        {unknown ? (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
            <p className="text-xs text-amber-800 dark:text-amber-200">{t('ed.arr.unknownHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>{t('ed.arr.sex')}</span>
                <select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)} className={inputClass}>
                  <option value="">—</option>
                  {(['MALE', 'FEMALE', 'OTHER'] as const).map((s) => <option key={s} value={s}>{t(`ed.sex.${s}`)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>{t('ed.arr.approxAge')}</span>
                <input type="number" min={0} max={120} inputMode="numeric" value={approxAge} onChange={(e) => setApproxAge(e.target.value)} className={inputClass} />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>{t('ed.arr.description')}</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
            </label>
          </div>
        ) : patient ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-canvas dark:bg-gray-900/40 border border-line dark:border-gray-700">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.patientId}</p>
            </div>
            <button type="button" onClick={() => { setPatient(null); setSearch(''); }} className="text-sm font-medium text-brand hover:underline">{t('ed.arr.change')}</button>
          </div>
        ) : (
          <div className="relative">
            <input id="ed-arrival-patient" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ed.arr.search')} className={inputClass} autoComplete="off" autoFocus />
            {showResults && (
              <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg" role="listbox">
                {searching && <li className="px-3 py-2 text-sm text-gray-500">{t('ed.arr.searching')}</li>}
                {!searching && results.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">{t('ed.arr.noResult')}</li>}
                {results.map((p) => (
                  <li key={p.id} role="option" aria-selected={false}>
                    <button type="button" onClick={() => setPatient(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white">{p.firstName} {p.lastName}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{p.patientId}{p.phoneNumber ? ` · ${p.phoneNumber}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>{t('ed.arr.mode')}</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as EdArrivalMode)} className={inputClass}>
            {ARRIVAL_MODES.map((m) => <option key={m} value={m}>{t(`ed.mode.${m}`)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>{t('ed.arr.complaint')}</span>
          <input value={complaint} onChange={(e) => setComplaint(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>{t('ed.arr.notes')}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </label>
    </DialogShell>
  );
}

// ---------- bay ----------

export function BayDialog({ row, bays, onClose, onSave }: { row: BoardRow; bays: BayState[]; onClose: () => void; onSave: (bayId: string | null) => Promise<void> }) {
  const { t } = useLanguage();
  const [chosen, setChosen] = useState<string | null>(row.bay?.id ?? null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const available = useMemo(() => new Set(freeBays(bays, row.id).map((b) => b.id)), [bays, row.id]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(chosen);
    } catch (err) {
      setError(messageOf(err, t('ed.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t('ed.bay.title', { name: fullName(row) })} onClose={onClose} wide footer={<Footer onClose={onClose} onSave={save} busy={busy} />}>
      <ErrorBox message={error} />
      {ED_ZONES.map((zone) => {
        const inZone = bays.filter((b) => b.zone === zone);
        if (inZone.length === 0) return null;
        return (
          <fieldset key={zone}>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400 mb-2">{t(`ed.zone.${zone}`)}</legend>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {inZone.map((b) => {
                const free = available.has(b.id);
                const selected = chosen === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={!free}
                    aria-pressed={selected}
                    onClick={() => setChosen(b.id)}
                    className={`rounded-xl border px-2 py-2 text-left text-sm transition ${selected ? 'border-brand bg-brand text-white' : free ? 'border-gray-200 dark:border-gray-700 hover:border-brand' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400 cursor-not-allowed'}`}
                  >
                    <span className="block font-semibold">{b.code}</span>
                    <span className="block text-[11px] opacity-80">{b.id === row.bay?.id ? t('ed.bay.current') : free ? t('ed.bay.free') : t('ed.bay.occupied')}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {row.bay && (
        <button type="button" onClick={() => setChosen(null)} aria-pressed={chosen === null} className={`text-sm font-medium ${chosen === null ? 'text-red-700 dark:text-red-300 underline' : 'text-gray-600 dark:text-gray-300 hover:underline'}`}>
          {t('ed.bay.none')}
        </button>
      )}
    </DialogShell>
  );
}

// ---------- doctor ----------

/** ED doctors first (department named like "Urgences"), then everyone else */
function sortDoctors(doctors: Doctor[]): Doctor[] {
  const isEd = (d: Doctor) => /urgence|emergenc/i.test(d.department ?? '');
  return [...doctors].sort((a, b) => Number(isEd(b)) - Number(isEd(a)) || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'));
}

export function DoctorDialog({ row, onClose, onSave }: { row: BoardRow; onClose: () => void; onSave: (doctorId: string | null) => Promise<void> }) {
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [chosen, setChosen] = useState(row.assignedDoctor?.id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getDoctors({ limit: 100 })
      .then((res) => live && setDoctors(sortDoctors(res.data)))
      .catch(() => live && setDoctors([]));
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(chosen || null);
    } catch (err) {
      setError(messageOf(err, t('ed.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t('ed.doc.title', { name: fullName(row) })} onClose={onClose} footer={<Footer onClose={onClose} onSave={save} busy={busy || doctors === null} />}>
      <ErrorBox message={error} />
      <label className="block">
        <span className={labelClass}>{t('ed.doc.choose')}</span>
        <select value={chosen} onChange={(e) => setChosen(e.target.value)} className={inputClass} disabled={doctors === null}>
          <option value="">{doctors === null ? t('ed.doc.loading') : t('ed.doc.none')}</option>
          {(doctors ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              Dr {d.firstName} {d.lastName}{d.department ? ` · ${d.department}` : ''}
            </option>
          ))}
        </select>
      </label>
    </DialogShell>
  );
}

// ---------- status ----------

export function StatusDialog({ row, onClose, onSave }: { row: BoardRow; onClose: () => void; onSave: (patch: { status: EdStatus; isolation: boolean; notes?: string }) => Promise<void> }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<EdStatus>(row.status === 'DEPARTED' ? 'WAITING_DOCTOR' : row.status);
  const [isolation, setIsolation] = useState(row.isolation);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave({ status, isolation, ...(notes.trim() ? { notes: notes.trim() } : {}) });
    } catch (err) {
      setError(messageOf(err, t('ed.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t('ed.st.title', { name: fullName(row) })} onClose={onClose} footer={<Footer onClose={onClose} onSave={save} busy={busy} />}>
      <ErrorBox message={error} />
      <label className="block">
        <span className={labelClass}>{t('ed.st.status')}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as EdStatus)} className={inputClass}>
          {ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{t(`ed.status.${s}`)}</option>)}
        </select>
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={isolation} onChange={(e) => setIsolation(e.target.checked)} className="rounded border-gray-300" />
        {t('ed.st.isolation')}
      </label>
      <label className="block">
        <span className={labelClass}>{t('ed.st.notes')}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </label>
    </DialogShell>
  );
}

// ---------- disposition ----------

interface WardOption {
  id: string;
  name: string;
  beds: Array<{ id: string; label: string }>;
}

export function DispositionDialog({ row, onClose, onDone }: { row: BoardRow; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const choices = dispositionsFor(row);
  const [disposition, setDisposition] = useState<EdDisposition>('DISCHARGED');
  const [note, setNote] = useState('');
  const [wards, setWards] = useState<WardOption[] | null>(null);
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState(row.chiefComplaint);
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const admitting = disposition === 'ADMITTED';
  useEffect(() => {
    if (!admitting || wards !== null) return;
    let live = true;
    api
      .getWards({ active: true })
      .then((board) =>
        live &&
        setWards(
          board.wards
            .filter((w) => w.isActive)
            .map((w) => ({ id: w.id, name: w.name, beds: w.beds.filter((b) => b.isActive && b.status === 'AVAILABLE').map((b) => ({ id: b.id, label: b.label })) }))
        )
      )
      .catch(() => live && setWards([]));
    return () => {
      live = false;
    };
  }, [admitting, wards]);

  const ward = wards?.find((w) => w.id === wardId) ?? null;

  const save = async () => {
    if (admitting && !wardId) return setError(t('ed.dispo.wardRequired'));
    if (admitting && !reason.trim()) return setError(t('ed.dispo.reasonRequired'));
    if (disposition === 'TRANSFERRED' && !destination.trim()) return setError(t('ed.dispo.destinationRequired'));
    setBusy(true);
    setError('');
    try {
      await api.setEdDisposition(row.id, {
        disposition,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(admitting ? { admission: { wardId, ...(bedId ? { bedId } : {}), reason: reason.trim() } } : {}),
        ...(disposition === 'TRANSFERRED' ? { transferDestination: destination.trim() } : {}),
      });
      onDone();
    } catch (err) {
      setError(messageOf(err, t('ed.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('ed.dispo.title', { name: fullName(row) })}
      onClose={onClose}
      wide
      footer={<Footer onClose={onClose} onSave={save} busy={busy} label={t('ed.dispo.submit')} danger={disposition === 'DECEASED'} />}
    >
      <ErrorBox message={error} />
      <fieldset>
        <legend className={labelClass}>{t('ed.dispo.choice')}</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          {choices.map((d) => (
            <label key={d} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer ${disposition === d ? 'border-brand bg-canvas dark:bg-gray-900/40' : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="radio" name="ed-disposition" value={d} checked={disposition === d} onChange={() => setDisposition(d)} />
              <span className="text-gray-900 dark:text-white">{t(`ed.disp.${d}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {admitting && (
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>{t('ed.dispo.ward')}</span>
            <select value={wardId} onChange={(e) => { setWardId(e.target.value); setBedId(''); }} className={inputClass} disabled={wards === null}>
              <option value="">{t('ed.dispo.chooseWard')}</option>
              {(wards ?? []).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.beds.length})</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t('ed.dispo.bed')}</span>
            <select value={bedId} onChange={(e) => setBedId(e.target.value)} className={inputClass} disabled={!ward}>
              <option value="">{t('ed.dispo.anyBed')}</option>
              {(ward?.beds ?? []).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            {ward && ward.beds.length === 0 && <span className="block text-xs text-amber-700 dark:text-amber-300 mt-1">{t('ed.dispo.noFreeBed')}</span>}
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>{t('ed.dispo.reason')}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
          </label>
        </div>
      )}

      {disposition === 'TRANSFERRED' && (
        <label className="block">
          <span className={labelClass}>{t('ed.dispo.destination')}</span>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} className={inputClass} />
        </label>
      )}

      {disposition === 'DECEASED' && <p className="p-3 rounded-lg bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200 text-sm">{t('ed.dispo.deceasedWarning')}</p>}

      <label className="block">
        <span className={labelClass}>{t('ed.dispo.note')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
      </label>
    </DialogShell>
  );
}

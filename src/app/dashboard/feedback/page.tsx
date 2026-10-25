'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type FeedbackEntry, type FeedbackStatus, type FeedbackSummary } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { DialogShell, ErrorBox, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';
import { StarsDisplay } from '@/components/feedback';
import { FEEDBACK_ASPECTS } from '@/lib/patient-extras';

const STATUSES: FeedbackStatus[] = ['NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED'];
const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nameOf = (v: { name: string } | string | null | undefined) => (typeof v === 'string' ? v : v?.name ?? null);

/** "Avis patients": satisfaction after visits, NPS, and complaints follow-up */
export default function FeedbackPage() {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();
  const isDoctor = user?.role === 'DOCTOR';
  const canManage = user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST';
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return day(d);
  });
  const [to, setTo] = useState(() => day(new Date()));
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [tab, setTab] = useState<'complaints' | 'all'>(isDoctor ? 'all' : 'complaints');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api
      .getDepartments({ limit: 100 })
      .then((res) => setDepartments((res.departments ?? []).map((d) => ({ id: d.id, name: d.name }))))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    let live = true;
    api
      .getFeedbackSummary({ from, to, ...(departmentId ? { departmentId } : {}) })
      .then((data) => {
        if (!live) return;
        setSummary(data);
        setSummaryError('');
      })
      .catch((err) => live && setSummaryError(messageOf(err, t('fb.staff.loadFailed'))));
    return () => {
      live = false;
    };
  }, [from, to, departmentId, reload, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isDoctor ? t('fb.staff.titleDoctor') : t('fb.staff.title')}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">{isDoctor ? t('fb.staff.subtitleDoctor') : t('fb.staff.subtitle')}</p>
      </div>

      <div className={`${cardClass} grid gap-3 p-4 sm:grid-cols-3`}>
        <div>
          <label htmlFor="fb-from" className={labelClass}>
            {t('fb.staff.from')}
          </label>
          <input id="fb-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="fb-to" className={labelClass}>
            {t('fb.staff.to')}
          </label>
          <input id="fb-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </div>
        {!isDoctor && (
          <div>
            <label htmlFor="fb-dept" className={labelClass}>
              {t('fb.staff.department')}
            </label>
            <select id="fb-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputClass}>
              <option value="">{t('fb.staff.allDepartments')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ErrorBox message={summaryError} />
      {summary && <SummaryView summary={summary} showDoctors={user?.role === 'ADMIN'} />}

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4">
          {(isDoctor ? (['all'] as const) : (['complaints', 'all'] as const)).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 px-1 py-3 text-sm font-medium ${tab === id ? 'border-lime-600 text-lime-700 dark:text-lime-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {id === 'complaints' ? t('fb.staff.tab.complaints') : isDoctor ? t('fb.staff.tab.mine') : t('fb.staff.tab.all')}
            </button>
          ))}
        </nav>
      </div>

      <FeedbackList
        key={`${tab}-${from}-${to}-${departmentId}-${reload}`}
        mode={tab}
        filters={{ from, to, ...(departmentId ? { departmentId } : {}) }}
        canManage={canManage}
        currentUserId={user?.id ?? null}
        formatDate={formatDate}
        onChanged={() => setReload((n) => n + 1)}
      />
    </div>
  );
}

function SummaryView({ summary, showDoctors }: { summary: FeedbackSummary; showDoctors: boolean }) {
  const { t } = useLanguage();
  // The rate may come as 0..1 or as a percentage
  const rate = summary.responseRate === null || summary.responseRate === undefined ? null : summary.responseRate <= 1 ? summary.responseRate * 100 : summary.responseRate;
  const npsTotal = summary.nps.promoters + summary.nps.passives + summary.nps.detractors;
  const pct = (n: number) => (npsTotal ? Math.round((n / npsTotal) * 100) : 0);
  const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(1).replace('.', ','));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label={t('fb.staff.responses')} value={String(summary.responses)} hint={t('fb.staff.sentHint', { count: summary.sent })} />
        <Tile label={t('fb.staff.responseRate')} value={rate === null ? '—' : `${Math.round(rate)} %`} />
        <Tile label={t('fb.staff.overall')} value={summary.averages.overall === null ? '—' : `${fmt(summary.averages.overall)} / 5`} />
        <div className={`${cardClass} p-4`}>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('fb.staff.nps')}</p>
          <p className={`text-2xl font-bold ${summary.nps.score === null ? 'text-gray-400' : summary.nps.score >= 30 ? 'text-green-600' : summary.nps.score >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
            {summary.nps.score === null ? '—' : summary.nps.score > 0 ? `+${summary.nps.score}` : summary.nps.score}
          </p>
          {npsTotal > 0 && (
            <>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                <div className="bg-green-500" style={{ width: `${pct(summary.nps.promoters)}%` }} />
                <div className="bg-amber-400" style={{ width: `${pct(summary.nps.passives)}%` }} />
                <div className="bg-red-500" style={{ width: `${pct(summary.nps.detractors)}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('fb.staff.npsBreakdown', { promoters: summary.nps.promoters, passives: summary.nps.passives, detractors: summary.nps.detractors })}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`${cardClass} p-4 lg:col-span-2`}>
          <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{t('fb.staff.trend')}</h2>
          {summary.trend.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('fb.staff.noData')}</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} tickLine={false} />
                  <YAxis allowDecimals={false} stroke="#9ca3af" fontSize={12} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [String(value), t('fb.staff.responses')]}
                    labelFormatter={(label, payload) => {
                      const overall = payload?.[0]?.payload?.overall as number | null | undefined;
                      return overall === null || overall === undefined ? String(label) : `${label} · ${t('fb.staff.overall')} ${fmt(overall)} / 5`;
                    }}
                  />
                  <Bar dataKey="responses" fill="#84cc16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className={`${cardClass} p-4`}>
          <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{t('fb.staff.aspects')}</h2>
          <dl className="space-y-2 text-sm">
            {FEEDBACK_ASPECTS.map((aspect) => (
              <div key={aspect} className="flex items-center justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400">{t(`fb.aspect.${aspect}`)}</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{summary.averages[aspect] === null ? '—' : `${fmt(summary.averages[aspect])} / 5`}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mb-2 mt-5 font-semibold text-gray-900 dark:text-white">{t('fb.staff.complaints')}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('fb.staff.complaintsCounts', { open: summary.complaints.open, resolved: summary.complaints.resolved })}</p>
          <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {Object.entries(summary.complaints.byCategory ?? {})
              .filter(([, n]) => n > 0)
              .map(([category, n]) => (
                <li key={category}>
                  {t(`fb.category.${category}`)} : {n}
                </li>
              ))}
          </ul>
        </div>
      </div>

      <BreakdownTable title={t('fb.staff.byDepartment')} label={t('fb.staff.department')} rows={summary.byDepartment.map((r, i) => ({ id: r.departmentId ?? `dept-${i}`, name: r.department, responses: r.responses, overall: r.overall, nps: r.nps }))} />
      {showDoctors && summary.byDoctor && summary.byDoctor.length > 0 && (
        <BreakdownTable title={t('fb.staff.byDoctor')} label={t('fb.staff.doctor')} rows={summary.byDoctor.map((r, i) => ({ id: r.doctorId ?? `doc-${i}`, name: r.doctorName, responses: r.responses, overall: r.overall, nps: r.nps }))} />
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

function BreakdownTable({ title, label, rows }: { title: string; label: string; rows: Array<{ id: string; name: string; responses: number; overall: number | null; nps: number | null }> }) {
  const { t } = useLanguage();
  if (rows.length === 0) return null;
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <h2 className="p-4 font-semibold text-gray-900 dark:text-white">{title}</h2>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
          <tr>
            <th className="px-4 py-2">{label}</th>
            <th className="px-4 py-2 text-right">{t('fb.staff.responses')}</th>
            <th className="px-4 py-2 text-right">{t('fb.staff.overall')}</th>
            <th className="px-4 py-2 text-right">{t('fb.staff.nps')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2 text-gray-900 dark:text-white">{r.name}</td>
              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{r.responses}</td>
              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{r.overall === null ? '—' : r.overall.toFixed(1).replace('.', ',')}</td>
              <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{r.nps === null ? '—' : r.nps > 0 ? `+${r.nps}` : r.nps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  NEW: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  IN_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

function FeedbackList({
  mode,
  filters,
  canManage,
  currentUserId,
  formatDate,
  onChanged,
}: {
  mode: 'complaints' | 'all';
  filters: { from: string; to: string; departmentId?: string };
  canManage: boolean;
  currentUserId: string | null;
  formatDate: (value: string) => string;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<FeedbackStatus | ''>('');
  // '' any, 'low' = 1–2 stars, 'high' = 4–5 stars
  const [rating, setRating] = useState<'' | 'low' | 'high'>('');
  const [includePending, setIncludePending] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FeedbackEntry[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FeedbackEntry | null>(null);

  const query = useMemo(
    () => ({
      ...filters,
      ...(mode === 'complaints' ? { complaint: true } : {}),
      ...(status ? { status } : {}),
      ...(rating === 'low' ? { maxOverall: 2 } : rating === 'high' ? { minOverall: 4 } : {}),
      ...(includePending && mode === 'all' ? { includePending: true } : {}),
      page,
      limit: 20,
    }),
    [filters, mode, status, rating, includePending, page]
  );

  const load = useCallback(async () => {
    try {
      const res = await api.getFeedbacks(query);
      // Complaints still to handle first
      const list = mode === 'complaints' ? [...res.feedbacks].sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)) : res.feedbacks;
      setItems(list);
      setTotalPages(res.pagination.totalPages || 1);
      setError('');
    } catch (err) {
      setError(messageOf(err, t('fb.staff.loadFailed')));
    }
  }, [query, mode, t]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <select aria-label={t('fb.staff.status')} value={status} onChange={(e) => { setStatus(e.target.value as FeedbackStatus | ''); setPage(1); }} className={`${inputClass} w-auto`}>
          <option value="">{t('fb.staff.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`fb.status.${s}`)}
            </option>
          ))}
        </select>
        {mode === 'all' && (
          <>
            <select aria-label={t('fb.staff.minOverall')} value={rating} onChange={(e) => { setRating(e.target.value as '' | 'low' | 'high'); setPage(1); }} className={`${inputClass} w-auto`}>
              <option value="">{t('fb.staff.anyRating')}</option>
              <option value="low">{t('fb.staff.lowRatings')}</option>
              <option value="high">{t('fb.staff.highRatings')}</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includePending} onChange={(e) => { setIncludePending(e.target.checked); setPage(1); }} />
              {t('fb.staff.includePending')}
            </label>
          </>
        )}
      </div>
      <ErrorBox message={error} />
      {items && items.length === 0 && <p className={`${cardClass} p-6 text-center text-sm text-gray-500 dark:text-gray-400`}>{mode === 'complaints' ? t('fb.staff.noComplaints') : t('fb.staff.noFeedback')}</p>}
      <ul className="space-y-3">
        {items?.map((f) => (
          <li key={f.id} className={`${cardClass} p-4 ${f.isComplaint && (f.status === 'NEW' || f.status === 'IN_REVIEW') ? 'border-l-4 border-l-red-500' : ''}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {f.submittedAt ? <StarsDisplay value={f.overall} /> : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{t('fb.staff.notAnswered')}</span>}
                  {typeof f.recommend === 'number' && <span className="text-xs text-gray-500 dark:text-gray-400">{t('fb.staff.recommendValue', { value: f.recommend })}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[f.status]}`}>{t(`fb.status.${f.status}`)}</span>
                  {f.isComplaint && (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                      {t('fb.staff.complaint')}
                      {f.complaintCategory ? ` · ${t(`fb.category.${f.complaintCategory}`)}` : ''}
                    </span>
                  )}
                  {f.contactBack && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">{t('fb.staff.callBack')}</span>}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {[
                    f.patient?.name,
                    f.visit ? t(f.visit.kind === 'STAY' ? 'fb.visit.STAY' : 'fb.visit.CONSULTATION') : null,
                    f.visit?.date ? formatDate(f.visit.date) : f.submittedAt ? formatDate(f.submittedAt) : null,
                    f.visit?.department ?? nameOf(f.department),
                    f.visit?.doctorName ?? nameOf(f.doctor),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {f.comment && <p className="whitespace-pre-line text-sm text-gray-900 dark:text-white">« {f.comment} »</p>}
                {f.response && (
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-300">
                    <span className="font-medium">{t('fb.staff.ourResponse')}</span> {f.response}
                    {f.respondedByName ? ` — ${f.respondedByName}` : ''}
                  </p>
                )}
                {f.assignedTo && <p className="text-xs text-gray-500 dark:text-gray-400">{t('fb.staff.assignedTo', { name: f.assignedTo.name })}</p>}
              </div>
              {canManage && f.submittedAt && (
                <button type="button" onClick={() => setEditing(f)} className={smallBtn}>
                  {t('fb.staff.handle')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={smallBtn}>
            {t('fb.staff.prev')}
          </button>
          <span className="text-gray-600 dark:text-gray-400">{t('fb.staff.page', { page, total: totalPages })}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={smallBtn}>
            {t('fb.staff.next')}
          </button>
        </div>
      )}
      {editing && (
        <HandleDialog
          entry={editing}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function HandleDialog({ entry, currentUserId, onClose, onSaved }: { entry: FeedbackEntry; currentUserId: string | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [status, setStatus] = useState<FeedbackStatus>(entry.status === 'NEW' ? 'IN_REVIEW' : entry.status);
  const [assignToMe, setAssignToMe] = useState(Boolean(currentUserId && entry.assignedToId === currentUserId));
  const [response, setResponse] = useState(entry.response ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (status === 'RESOLVED' && entry.isComplaint && !response.trim()) return setError(t('fb.staff.responseRequired'));
    setSaving(true);
    setError('');
    try {
      await api.updateFeedback(entry.id, {
        status,
        ...(assignToMe && currentUserId ? { assignedToId: currentUserId } : {}),
        ...(response.trim() && response.trim() !== (entry.response ?? '') ? { response: response.trim() } : {}),
      });
      toast.success(t('fb.staff.saved'));
      onSaved();
    } catch (err) {
      setError(messageOf(err, t('fb.staff.saveFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={entry.isComplaint ? t('fb.staff.handleComplaint') : t('fb.staff.handleFeedback')}
      subtitle={entry.patient?.name}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>
            {t('fam.cancel')}
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
            {t('fb.staff.save')}
          </button>
        </>
      }
    >
      {entry.comment && <p className="whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-700/50 dark:text-gray-200">« {entry.comment} »</p>}
      {entry.contactBack && <p className="text-sm font-medium text-sky-700 dark:text-sky-300">{t('fb.staff.callBackHelp')}</p>}
      <div>
        <label htmlFor="fb-status" className={labelClass}>
          {t('fb.staff.status')}
        </label>
        <select id="fb-status" value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`fb.status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={assignToMe} onChange={(e) => setAssignToMe(e.target.checked)} />
        {t('fb.staff.assignToMe')}
      </label>
      <div>
        <label htmlFor="fb-response" className={labelClass}>
          {t('fb.staff.response')}
        </label>
        <textarea id="fb-response" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder={t('fb.staff.responsePlaceholder')} className={inputClass} />
        {entry.contactBack && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('fb.staff.responseNotified')}</p>}
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}

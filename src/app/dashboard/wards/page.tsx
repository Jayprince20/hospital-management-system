'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type BedStatus, type Ward, type WardBed, type WardBoard } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { AdmissionDialog, AddBedsDialog, WardDialog, BedStatusBadge, cardClass, smallBtn, useDaysLabel, usePolling } from '@/components/inpatient';
import { BED_STATUSES, BED_TILE } from '@/lib/inpatient';

const REFRESH_MS = 30_000;

type Dialog = { kind: 'admit'; bed: WardBed; ward: Ward } | { kind: 'ward'; ward: Ward | null } | { kind: 'beds'; ward: Ward } | null;

/** Statuses a nurse or the desk may set by hand (OCCUPIED comes from an admission) */
const MANUAL_STATUSES: Array<Exclude<BedStatus, 'OCCUPIED'>> = ['AVAILABLE', 'CLEANING', 'MAINTENANCE', 'RESERVED'];

function BedTile({
  bed,
  ward,
  canAdmit,
  canSetStatus,
  busy,
  onOpen,
  onAdmit,
  onStatus,
}: {
  bed: WardBed;
  ward: Ward;
  canAdmit: boolean;
  canSetStatus: boolean;
  busy: boolean;
  onOpen: (admissionId: string) => void;
  onAdmit: () => void;
  onStatus: (status: Exclude<BedStatus, 'OCCUPIED'>) => void;
}) {
  const { t } = useLanguage();
  const daysLabel = useDaysLabel();
  const occupant = bed.occupant;
  return (
    <div className={`rounded-lg border p-2.5 min-h-[104px] flex flex-col ${BED_TILE[bed.status]} ${bed.isActive ? '' : 'opacity-50'}`} data-testid="bed-tile">
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold tabular-nums">{t('inp.bedLabel', { label: bed.label })}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide">{t(`inp.bed.${bed.status}`)}</span>
      </div>
      {occupant ? (
        <button type="button" onClick={() => onOpen(occupant.admissionId)} className="mt-1 text-left flex-1 hover:underline">
          <span className="block text-sm font-semibold leading-tight">{occupant.patientName}</span>
          <span className="block text-xs opacity-80">
            {occupant.age !== null ? `${t('inp.age', { age: occupant.age })} · ` : ''}{daysLabel(occupant.days)}
          </span>
          <span className="block text-xs opacity-80 truncate">Dr {occupant.attendingDoctorName.replace(/^Dr\.?\s*/i, '')}</span>
        </button>
      ) : (
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {canAdmit && bed.isActive && (bed.status === 'AVAILABLE' || bed.status === 'RESERVED') && ward.isActive && (
            <button type="button" onClick={onAdmit} disabled={busy} className="px-2 py-0.5 text-xs font-medium rounded bg-lime-600 hover:bg-lime-700 text-white disabled:opacity-50">
              {t('inp.board.admitHere')}
            </button>
          )}
          {canSetStatus && bed.status === 'CLEANING' && (
            <button type="button" onClick={() => onStatus('AVAILABLE')} disabled={busy} className="px-2 py-0.5 text-xs font-medium rounded bg-white/70 dark:bg-gray-800/70 border border-current disabled:opacity-50">
              {t('inp.board.markClean')}
            </button>
          )}
          {canSetStatus && (
            <select
              aria-label={t('inp.board.setStatus', { label: bed.label })}
              value=""
              disabled={busy}
              onChange={(e) => e.target.value && onStatus(e.target.value as Exclude<BedStatus, 'OCCUPIED'>)}
              className="text-xs rounded border border-current bg-white/70 dark:bg-gray-800/70 px-1 py-0.5"
            >
              <option value="">{t('inp.board.status')}</option>
              {MANUAL_STATUSES.filter((s) => s !== bed.status).map((s) => (
                <option key={s} value={s}>{t(`inp.bed.${s}`)}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

export default function WardsPage() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const role = user?.role;
  const isAdmin = role === 'ADMIN';
  const canAdmit = role === 'ADMIN' || role === 'DOCTOR' || role === 'RECEPTIONIST';
  const canSetStatus = role === 'ADMIN' || role === 'NURSE' || role === 'RECEPTIONIST';

  const [board, setBoard] = useState<WardBoard | null>(null);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [busyBed, setBusyBed] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const data = await api.getWards(showInactive ? {} : { active: true });
      if (mine !== seq.current) return;
      setBoard(data);
      setError('');
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof Error && err.message ? err.message : t('inp.loadFailed'));
    }
  }, [showInactive, t]);

  usePolling(load, REFRESH_MS);

  const setStatus = async (bed: WardBed, status: Exclude<BedStatus, 'OCCUPIED'>) => {
    setBusyBed(bed.id);
    try {
      await api.updateBed(bed.id, { status });
      toast.success(t('inp.board.statusChanged', { label: bed.label, status: t(`inp.bed.${status}`) }));
      await load();
    } catch (err) {
      toast.error(t('inp.actionFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setBusyBed(null);
    }
  };

  const toggleWard = async (ward: Ward) => {
    try {
      await api.updateWard(ward.id, { isActive: !ward.isActive });
      await load();
    } catch (err) {
      toast.error(t('inp.actionFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const totals = board?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inp.board.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('inp.board.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              {t('inp.board.showInactive')}
            </label>
          )}
          {canAdmit && (
            <button type="button" onClick={() => router.push('/dashboard/admissions')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
              {t('inp.board.admissions')}
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={() => setDialog({ kind: 'ward', ward: null })} className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm">
              + {t('inp.ward.new')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('inp.board.beds'), value: totals?.beds },
          { label: t('inp.board.free'), value: totals?.available, tone: 'text-green-700 dark:text-green-400' },
          { label: t('inp.board.occupied'), value: totals?.occupied, tone: 'text-blue-700 dark:text-blue-400' },
          { label: t('inp.board.occupancy'), value: totals ? `${Math.round(totals.occupancyPct)} %` : undefined },
        ].map((tile) => (
          <div key={tile.label} className={`${cardClass} p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tile.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${tile.tone ?? 'text-gray-900 dark:text-white'}`}>{tile.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4" aria-label={t('inp.board.legend')}>
        {BED_STATUSES.map((s) => <BedStatusBadge key={s} status={s} />)}
      </div>

      {board === null && !error && <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>}
      {board && board.wards.length === 0 && (
        <div className={`${cardClass} p-8 text-center text-gray-500 dark:text-gray-400`}>{isAdmin ? t('inp.board.noWardsAdmin') : t('inp.board.noWards')}</div>
      )}

      {board?.wards.map((ward) => (
        <section key={ward.id} className={`${cardClass} p-5 ${ward.isActive ? '' : 'opacity-70'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {ward.name} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">· {ward.code}</span>
                {!ward.isActive && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{t('inp.ward.inactive')}</span>}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(`inp.wardType.${ward.type}`)}
                {ward.gender !== 'ANY' ? ` · ${t(`inp.wardGender.${ward.gender}`)}` : ''}
                {ward.department ? ` · ${ward.department.name}` : ''}
                {ward.floor ? ` · ${t('inp.ward.floorValue', { floor: ward.floor })}` : ''}
                {` · ${formatCurrency(ward.dailyRate)}${t('inp.perDay')}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                {t('inp.board.wardCounts', { free: ward.counts.available, total: ward.counts.total })} · {Math.round(ward.occupancyPct)} %
              </span>
              {isAdmin && (
                <>
                  <button type="button" onClick={() => setDialog({ kind: 'beds', ward })} className={smallBtn}>{t('inp.ward.addBeds')}</button>
                  <button type="button" onClick={() => setDialog({ kind: 'ward', ward })} className={smallBtn}>{t('inp.edit')}</button>
                  <button type="button" onClick={() => toggleWard(ward)} className={smallBtn}>{ward.isActive ? t('inp.ward.deactivate') : t('inp.ward.activate')}</button>
                </>
              )}
            </div>
          </div>
          {ward.beds.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.board.noBeds')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {ward.beds.map((bed) => (
                <BedTile
                  key={bed.id}
                  bed={bed}
                  ward={ward}
                  canAdmit={canAdmit}
                  canSetStatus={canSetStatus}
                  busy={busyBed === bed.id}
                  onOpen={(id) => router.push(`/dashboard/admissions/${id}`)}
                  onAdmit={() => setDialog({ kind: 'admit', bed, ward })}
                  onStatus={(s) => setStatus(bed, s)}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {dialog?.kind === 'admit' && (
        <AdmissionDialog
          bedId={dialog.bed.id}
          onClose={() => setDialog(null)}
          onAdmitted={(admission) => {
            setDialog(null);
            toast.success(t('inp.admit.done', { number: admission.number }));
            router.push(`/dashboard/admissions/${admission.id}`);
          }}
        />
      )}
      {dialog?.kind === 'ward' && (
        <WardDialog
          ward={dialog.ward}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast.success(t('inp.ward.saved'));
            load();
          }}
        />
      )}
      {dialog?.kind === 'beds' && (
        <AddBedsDialog
          ward={dialog.ward}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast.success(t('inp.ward.bedsAdded'));
            load();
          }}
        />
      )}
    </div>
  );
}

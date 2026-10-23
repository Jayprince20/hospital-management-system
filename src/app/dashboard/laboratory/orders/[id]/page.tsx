'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, LabOrderStatus } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { calculateAge } from '@/lib/formatters';

// Shape returned by GET /api/lab-orders/[id] (richer than the list item type in api.ts)
interface LabOrderDetail {
  id: string;
  patient: {
    id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    department?: string;
  };
  consultation?: { id: string; chiefComplaint?: string; diagnosis?: string[] | string } | null;
  status: LabOrderStatus;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  notes?: string | null;
  collectedAt?: string | null;
  collectedBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    labTest: {
      id: string;
      code: string;
      name: string;
      category: string;
      sampleType: string;
      normalRange?: string | null;
      unit?: string | null;
      processingTime: number;
      price: number;
    };
    result?: string | null;
    unit?: string | null;
    normalRange?: string | null;
    isAbnormal?: boolean | null;
    notes?: string | null;
  }>;
  totalPrice: number;
}

interface ResultDraft {
  itemId: string;
  result: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
  notes: string;
}

const FLOW: LabOrderStatus[] = ['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED'];

const statusBadge: Record<LabOrderStatus, string> = {
  ORDERED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400',
  SAMPLE_COLLECTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400',
  PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400',
};

const priorityBadge: Record<string, string> = {
  STAT: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400',
  URGENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400',
  ROUTINE: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const inputClass =
  'w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent';

export default function LabOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { user, checkPermission } = useAuth();
  const { t, tEnum, formatDate, formatDateTime, formatCurrency } = useLanguage();
  const toast = useToast();

  const canEnterResults = checkPermission('laboratory:enter_results');
  const canCancel = canEnterResults || checkPermission('laboratory:create_orders');

  const [order, setOrder] = useState<LabOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [editingResults, setEditingResults] = useState(false);
  const [drafts, setDrafts] = useState<ResultDraft[]>([]);
  const [resultError, setResultError] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const data = (await api.getLabOrder(orderId)) as unknown as LabOrderDetail;
      setOrder(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('lab.detail.notFound'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const startEditing = () => {
    if (!order) return;
    setDrafts(
      order.items.map((item) => ({
        itemId: item.id,
        result: item.result || '',
        unit: item.unit || item.labTest.unit || '',
        normalRange: item.normalRange || item.labTest.normalRange || '',
        isAbnormal: !!item.isAbnormal,
        notes: item.notes || '',
      }))
    );
    setResultError('');
    setEditingResults(true);
  };

  const updateDraft = (itemId: string, patch: Partial<ResultDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.itemId === itemId ? { ...d, ...patch } : d)));
  };

  const changeStatus = async (status: LabOrderStatus) => {
    if (!order) return;
    try {
      setUpdating(true);
      const payload = {
        status,
        collectedBy: status === 'SAMPLE_COLLECTED' && user ? `${user.firstName} ${user.lastName}` : undefined,
      };
      await api.updateLabOrder(order.id, payload);
      toast.success(t('lab.detail.statusUpdated'), tEnum(status));
      await fetchOrder();
    } catch (err) {
      toast.error(t('lab.detail.updateFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setUpdating(false);
    }
  };

  const saveResults = async (complete: boolean) => {
    if (!order) return;
    const filled = drafts.filter((d) => d.result.trim());
    if (complete && filled.length !== drafts.length) {
      setResultError(t('lab.detail.resultsRequired'));
      return;
    }
    const results = filled.map((d) => ({
      itemId: d.itemId,
      result: d.result.trim(),
      unit: d.unit.trim() || undefined,
      normalRange: d.normalRange.trim() || undefined,
      isAbnormal: d.isAbnormal,
      notes: d.notes.trim() || undefined,
    }));
    const payload = { results, status: complete ? ('COMPLETED' as LabOrderStatus) : undefined };

    try {
      setUpdating(true);
      setResultError('');
      await api.updateLabOrder(order.id, payload);
      toast.success(complete ? t('lab.detail.orderCompleted') : t('lab.detail.resultsSaved'));
      setEditingResults(false);
      await fetchOrder();
    } catch (err) {
      setResultError(err instanceof Error ? err.message : t('lab.detail.updateFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const cancelOrder = async () => {
    if (!order) return;
    try {
      setUpdating(true);
      await api.cancelLabOrder(order.id);
      toast.success(t('lab.detail.cancelled'));
      setShowCancel(false);
      await fetchOrder();
    } catch (err) {
      toast.error(t('lab.detail.updateFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">{t('lab.loading')}</span>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 dark:text-red-400 mb-4">{loadError || t('lab.detail.notFound')}</p>
        <button onClick={() => router.back()} className="text-lime-600 dark:text-lime-400 hover:underline">
          {t('lab.detail.back')}
        </button>
      </div>
    );
  }

  const isClosed = order.status === 'COMPLETED' || order.status === 'CANCELLED';
  const currentIndex = FLOW.indexOf(order.status);
  const stepDates: Record<string, string | null | undefined> = {
    ORDERED: order.createdAt,
    SAMPLE_COLLECTED: order.collectedAt,
    PROCESSING: null,
    COMPLETED: order.completedAt,
  };
  const diagnosis = Array.isArray(order.consultation?.diagnosis)
    ? order.consultation?.diagnosis.join(', ')
    : order.consultation?.diagnosis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={t('lab.detail.back')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('lab.detail.title')}</h1>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge[order.status]}`}>{tEnum(order.status)}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${priorityBadge[order.priority] || priorityBadge.ROUTINE}`}>
                {tEnum(order.priority)}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('lab.detail.orderedOn')} {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        {!isClosed && (
          <div className="flex flex-wrap gap-2">
            {canEnterResults && order.status === 'ORDERED' && (
              <button
                onClick={() => changeStatus('SAMPLE_COLLECTED')}
                disabled={updating}
                className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 text-sm font-medium"
              >
                {t('lab.detail.markCollected')}
              </button>
            )}
            {canEnterResults && order.status === 'SAMPLE_COLLECTED' && (
              <button
                onClick={() => changeStatus('PROCESSING')}
                disabled={updating}
                className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 text-sm font-medium"
              >
                {t('lab.detail.startProcessing')}
              </button>
            )}
            {canEnterResults && !editingResults && (order.status === 'PROCESSING' || order.status === 'SAMPLE_COLLECTED') && (
              <button
                onClick={startEditing}
                className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
              >
                {t('lab.detail.enterResults')}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancel(true)}
                disabled={updating}
                className="px-4 py-2 text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 text-sm font-medium"
              >
                {t('lab.detail.cancelOrder')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">{t('lab.detail.patient')}</h2>
          <Link
            href={`/dashboard/patients/${order.patient.id}`}
            className="text-lg font-semibold text-gray-900 dark:text-white hover:text-lime-600"
          >
            {order.patient.firstName} {order.patient.lastName}
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400">{order.patient.patientId}</p>
          <dl className="mt-3 space-y-1 text-sm">
            {order.patient.dateOfBirth && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('lab.detail.age')}</dt>
                <dd className="text-gray-900 dark:text-white">
                  {t('unit.years', { count: calculateAge(order.patient.dateOfBirth) })}
                  {order.patient.gender ? ` • ${tEnum(order.patient.gender)}` : ''}
                </dd>
              </div>
            )}
            {order.patient.phoneNumber && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{t('lab.detail.phone')}</dt>
                <dd className="text-gray-900 dark:text-white">{order.patient.phoneNumber}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Doctor & notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">{t('lab.detail.doctor')}</h2>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            Dr. {order.doctor.firstName} {order.doctor.lastName}
          </p>
          {order.doctor.department && <p className="text-sm text-gray-500 dark:text-gray-400">{order.doctor.department}</p>}
          <h3 className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">{t('lab.detail.notes')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{order.notes || t('lab.detail.noNotes')}</p>
          {order.consultation && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('lab.detail.consultation')}</h3>
              <Link
                href={`/dashboard/consultations/${order.consultation.id}`}
                className="text-sm text-lime-700 dark:text-lime-400 hover:underline"
              >
                {order.consultation.chiefComplaint || diagnosis || t('lab.detail.consultation')}
              </Link>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">{t('lab.detail.timeline')}</h2>
          {order.status === 'CANCELLED' ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{tEnum('CANCELLED')}</p>
          ) : (
            <ol className="space-y-3">
              {FLOW.map((step, index) => {
                const done = index <= currentIndex;
                const date = stepDates[step];
                return (
                  <li key={step} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        done ? 'bg-lime-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}
                    >
                      {done ? '✓' : index + 1}
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${done ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {tEnum(step)}
                      </p>
                      {done && date && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(date)}
                          {step === 'SAMPLE_COLLECTED' && order.collectedBy
                            ? ` ${t('lab.detail.collectedBy', { name: order.collectedBy })}`
                            : ''}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Tests & results */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('lab.detail.tests')}</h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('lab.detail.total')} : <strong className="text-gray-900 dark:text-white">{formatCurrency(order.totalPrice)}</strong>
          </span>
        </div>

        {resultError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {resultError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3">{t('lab.table.name')}</th>
                <th className="px-4 py-3">{t('lab.detail.result')}</th>
                <th className="px-4 py-3">{t('lab.detail.unit')}</th>
                <th className="px-4 py-3">{t('lab.detail.reference')}</th>
                <th className="px-4 py-3">{t('lab.detail.flag')}</th>
                <th className="px-4 py-3">{t('lab.detail.resultNotes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {order.items.map((item) => {
                const draft = drafts.find((d) => d.itemId === item.id);
                return (
                  <tr key={item.id} className="align-top">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{item.labTest.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.labTest.code} • {formatCurrency(item.labTest.price)}
                      </p>
                    </td>
                    {editingResults && draft ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            value={draft.result}
                            onChange={(e) => updateDraft(item.id, { result: e.target.value })}
                            className={inputClass}
                            aria-label={`${t('lab.detail.result')} — ${item.labTest.name}`}
                          />
                        </td>
                        <td className="px-4 py-3 w-28">
                          <input value={draft.unit} onChange={(e) => updateDraft(item.id, { unit: e.target.value })} className={inputClass} />
                        </td>
                        <td className="px-4 py-3 w-36">
                          <input
                            value={draft.normalRange}
                            onChange={(e) => updateDraft(item.id, { normalRange: e.target.value })}
                            className={inputClass}
                          />
                        </td>
                        <td className="px-4 py-3 w-36">
                          <select
                            value={draft.isAbnormal ? 'abnormal' : 'normal'}
                            onChange={(e) => updateDraft(item.id, { isAbnormal: e.target.value === 'abnormal' })}
                            className={inputClass}
                          >
                            <option value="normal">{t('lab.detail.normal')}</option>
                            <option value="abnormal">{t('lab.detail.abnormal')}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input value={draft.notes} onChange={(e) => updateDraft(item.id, { notes: e.target.value })} className={inputClass} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm">
                          {item.result ? (
                            <span className={`font-semibold ${item.isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                              {item.result}
                            </span>
                          ) : (
                            <span className="text-gray-400">{t('lab.detail.noResult')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.unit || item.labTest.unit || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {item.normalRange || item.labTest.normalRange || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.result ? (
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                item.isAbnormal
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                              }`}
                            >
                              {item.isAbnormal ? t('lab.detail.abnormal') : t('lab.detail.normal')}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.notes || '—'}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editingResults && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap justify-end gap-3">
            <button
              onClick={() => {
                setEditingResults(false);
                setResultError('');
              }}
              disabled={updating}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
            >
              {t('lab.detail.cancelEdit')}
            </button>
            <button
              onClick={() => saveResults(false)}
              disabled={updating}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-medium"
            >
              {updating ? t('lab.detail.saving') : t('lab.detail.saveResults')}
            </button>
            <button
              onClick={() => saveResults(true)}
              disabled={updating}
              className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 text-sm font-medium"
            >
              {updating ? t('lab.detail.saving') : t('lab.detail.saveAndComplete')}
            </button>
          </div>
        )}

        {order.completedAt && (
          <p className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
            {tEnum('COMPLETED')} : {formatDate(order.completedAt)}
          </p>
        )}
      </div>

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={cancelOrder}
        title={t('lab.detail.cancelTitle')}
        message={t('lab.detail.cancelMessage')}
        confirmText={t('lab.detail.cancelConfirm')}
        cancelText={t('lab.detail.keep')}
        variant="danger"
        isLoading={updating}
      />
    </div>
  );
}

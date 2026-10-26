'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, type ImagingOrder } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { LoadingState, ErrorState } from '@/components/ui';
import {
  AttachmentsPanel,
  CancelOrderDialog,
  ContrastBadge,
  CriticalBadge,
  ModalityBadge,
  PriorityBadge,
  ReportEditor,
  SafetyPanel,
  ScheduleDialog,
  SignedReport,
  StatusTimeline,
  useIsRadiologist,
} from '@/components/imaging';
import { cardClass, messageOf, primaryBtn, smallBtn } from '@/components/imaging/ui';
import { DicomPanel } from '@/components/dicom';

export default function ImagingOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { t, formatDateTime, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const isRadiologist = useIsRadiologist();
  const role = user?.role;
  const [order, setOrder] = useState<ImagingOrder | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'schedule' | 'cancel' | null>(null);
  const [billing, setBilling] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await api.getImagingOrder(id));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('img.loadFailed')));
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !order) return <ErrorState title={t('img.loadFailed')} message={error} onRetry={load} />;
  if (!order) return <LoadingState label={t('img.loading')} />;

  const canSchedule = role === 'ADMIN' || role === 'RECEPTIONIST' || role === 'LAB_TECH' || role === 'DOCTOR';
  const canArrive = canSchedule || role === 'NURSE';
  const canPerform = role === 'ADMIN' || role === 'LAB_TECH' || role === 'DOCTOR';
  const canUpload = (role === 'ADMIN' || role === 'LAB_TECH' || role === 'DOCTOR') && ['ARRIVED', 'PERFORMED', 'REPORTED'].includes(order.status);
  const canDeleteFiles = canUpload && order.status !== 'REPORTED';
  const canCancel = (role === 'ADMIN' || role === 'DOCTOR') && order.status !== 'REPORTED' && order.status !== 'CANCELLED';
  const canBill = (role === 'ADMIN' || role === 'RECEPTIONIST') && !order.invoice && !order.chargedToStay && order.status !== 'CANCELLED';
  // Doctors see the editor; the server refuses non-radiologists with a clear message
  const showReportEditor = order.status === 'PERFORMED' && role === 'DOCTOR';
  const allergies = order.patient.allergies ?? [];

  const arrive = async () => {
    try {
      setOrder(await api.updateImagingOrder(order.id, { action: 'arrive' }));
      toast.success(t('img.arrive.done', { name: order.patient.name }));
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    }
  };

  const bill = async () => {
    setBilling(true);
    try {
      const res = await api.billImagingOrder(order.id);
      toast.success(t('img.bill.done', { number: res.invoice.invoiceNumber }));
      load();
    } catch (err) {
      toast.error(t('img.bill.failed'), messageOf(err, ''));
    } finally {
      setBilling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/imaging" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('img.back')}</Link>

      <div className={`${cardClass} p-5 space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
              {order.exam.name} <ModalityBadge modality={order.exam.modality} /> <PriorityBadge priority={order.priority} />
              {order.exam.usesContrast && <ContrastBadge />}
              {order.isCritical && <CriticalBadge />}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {order.number} · <Link href={`/dashboard/patients/${order.patient.id}`} className="hover:underline">{order.patient.name}</Link> · {order.patient.patientId}
              {order.patient.age != null && ` · ${t('img.age', { age: order.patient.age })}`}
              {order.patient.gender && ` · ${t(`img.gender.${order.patient.gender}`)}`}
            </p>
            <p className={`text-sm mt-1 font-medium ${allergies.length ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {allergies.length ? t('img.allergies', { list: allergies.join(', ') }) : t('img.noAllergy')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSchedule && (order.status === 'ORDERED' || order.status === 'SCHEDULED') && (
              <button type="button" onClick={() => setDialog('schedule')} className={smallBtn}>{order.status === 'SCHEDULED' ? t('img.action.reschedule') : t('img.action.schedule')}</button>
            )}
            {canArrive && (order.status === 'ORDERED' || order.status === 'SCHEDULED') && (
              <button type="button" onClick={arrive} className={primaryBtn}>{t('img.action.arrive')}</button>
            )}
            {canCancel && (
              <button type="button" onClick={() => setDialog('cancel')} className={`${smallBtn} text-red-600 dark:text-red-400`}>{t('img.action.cancel')}</button>
            )}
          </div>
        </div>
        <StatusTimeline status={order.status} />
        {order.status === 'CANCELLED' && order.cancelReason && (
          <p className="text-sm text-red-700 dark:text-red-300">{t('img.cancelledBecause', { reason: order.cancelReason, date: order.cancelledAt ? formatDateTime(order.cancelledAt) : '' })}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className={`${cardClass} p-5 space-y-3`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('img.request.title')}</h2>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('img.clinicalInfo')}</h3>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">{order.clinicalInfo}</p>
            </div>
            {order.question && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('img.question')}</h3>
                <p className="text-sm text-gray-900 dark:text-white">{order.question}</p>
              </div>
            )}
            {order.warnings.length > 0 && (
              <ul className="space-y-1">
                {order.warnings.map((w) => (
                  <li key={w} className="text-sm p-2 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                    {t(`img.warning.${w}`) === `img.warning.${w}` ? w : t(`img.warning.${w}`)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {order.status === 'ARRIVED' && canPerform && <SafetyPanel order={order} isRadiologist={isRadiologist} onChanged={setOrder} />}
          {order.status === 'ARRIVED' && !canPerform && (
            <p className={`${cardClass} p-5 text-sm text-gray-600 dark:text-gray-300`}>{t('img.safety.technicianOnly')}</p>
          )}

          {showReportEditor && <ReportEditor order={order} onSigned={setOrder} />}
          {order.status === 'PERFORMED' && role !== 'DOCTOR' && (
            <p className={`${cardClass} p-5 text-sm text-gray-600 dark:text-gray-300`}>{t('img.report.waiting')}</p>
          )}
          {order.status === 'REPORTED' && <SignedReport order={order} canAddendum={isRadiologist} onChanged={setOrder} />}

          {['ARRIVED', 'PERFORMED', 'REPORTED'].includes(order.status) && (
            <DicomPanel order={order} canUpload={canUpload && (role !== 'DOCTOR' || isRadiologist)} isRadiologist={isRadiologist} onChanged={load} />
          )}

          {['ARRIVED', 'PERFORMED', 'REPORTED'].includes(order.status) && (
            <AttachmentsPanel orderId={order.id} files={order.attachments} canUpload={canUpload} canDelete={canDeleteFiles} onChanged={load} />
          )}
        </div>

        <div className="space-y-6">
          <section className={`${cardClass} p-5 space-y-2 text-sm`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('img.details.title')}</h2>
            <p><span className="text-gray-500 dark:text-gray-400">{t('img.details.orderedBy')} :</span> {order.orderedBy.name}</p>
            <p><span className="text-gray-500 dark:text-gray-400">{t('img.details.requested')} :</span> {formatDateTime(order.createdAt)}</p>
            {order.scheduledAt && (
              <p><span className="text-gray-500 dark:text-gray-400">{t('img.details.scheduled')} :</span> {formatDateTime(order.scheduledAt)}{order.room ? ` · ${order.room}` : ''}</p>
            )}
            {order.arrivedAt && <p><span className="text-gray-500 dark:text-gray-400">{t('img.details.arrived')} :</span> {formatDateTime(order.arrivedAt)}</p>}
            {order.performedAt && (
              <p><span className="text-gray-500 dark:text-gray-400">{t('img.details.performed')} :</span> {formatDateTime(order.performedAt)}{order.performedByName ? ` · ${order.performedByName}` : ''}</p>
            )}
            {order.pregnancyStatus && <p><span className="text-gray-500 dark:text-gray-400">{t('img.safety.pregnancy')} :</span> {t(`img.pregnancy.${order.pregnancyStatus}`)}</p>}
            {order.exam.usesContrast && order.contrastChecked && <p className="text-green-700 dark:text-green-300">{t('img.details.contrastChecked')}{order.creatinine != null ? ` · ${t('img.details.creatinine', { value: order.creatinine })}` : ''}</p>}
            {order.safetyNotes && <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{order.safetyNotes}</p>}
            {order.exam.preparation && <p><span className="text-gray-500 dark:text-gray-400">{t('img.preparation')} :</span> {order.exam.preparation}</p>}
            {order.consultationId && <Link href={`/dashboard/consultations/${order.consultationId}`} className="block text-lime-700 dark:text-lime-400 hover:underline">{t('img.details.consultation')}</Link>}
            {order.admissionId && <Link href={`/dashboard/admissions/${order.admissionId}`} className="block text-lime-700 dark:text-lime-400 hover:underline">{t('img.details.admission')}</Link>}
          </section>

          <section className={`${cardClass} p-5 space-y-2 text-sm`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('img.bill.title')}</h2>
            <p>{t('img.bill.price', { price: formatCurrency(order.exam.price) })}</p>
            {order.chargedToStay ? (
              <p className="text-gray-700 dark:text-gray-300">{t('img.bill.chargedToStay')}</p>
            ) : order.invoice ? (
              <Link href={`/dashboard/billing/${order.invoice.id}`} className="text-lime-700 dark:text-lime-400 hover:underline">{t('img.bill.invoice', { number: order.invoice.invoiceNumber })}</Link>
            ) : canBill ? (
              <button type="button" onClick={bill} disabled={billing} className={primaryBtn}>{t('img.bill.button')}</button>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">{t('img.bill.notBilled')}</p>
            )}
          </section>
        </div>
      </div>

      {dialog === 'schedule' && (
        <ScheduleDialog
          order={order}
          onClose={() => setDialog(null)}
          onDone={(o) => {
            setDialog(null);
            setOrder(o);
            toast.success(t('img.schedule.done', { number: o.number }));
          }}
        />
      )}
      {dialog === 'cancel' && (
        <CancelOrderDialog
          order={order}
          onClose={() => setDialog(null)}
          onDone={(o) => {
            setDialog(null);
            setOrder(o);
            toast.success(t('img.cancelOrder.done', { number: o.number }));
          }}
        />
      )}
    </div>
  );
}

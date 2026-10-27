'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, type ImagingExam, type ImagingOrder, type ImagingPriority } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { MODALITIES, PRIORITIES } from '@/lib/imaging';
import { ContrastBadge, DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

export interface ImagingPatient {
  id: string;
  patientId: string;
  name: string;
}

/** Request an imaging exam: from a consultation, a hospital stay or the patient record */
export function NewImagingOrderDialog({
  patient,
  consultationId,
  admissionId,
  prefillClinicalInfo = '',
  onClose,
  onCreated,
}: {
  patient: ImagingPatient;
  consultationId?: string;
  admissionId?: string;
  prefillClinicalInfo?: string;
  onClose: () => void;
  onCreated?: (order: ImagingOrder) => void;
}) {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [exams, setExams] = useState<ImagingExam[] | null>(null);
  const [search, setSearch] = useState('');
  const [examId, setExamId] = useState('');
  const [priority, setPriority] = useState<ImagingPriority>('ROUTINE');
  const [clinicalInfo, setClinicalInfo] = useState(prefillClinicalInfo);
  const [question, setQuestion] = useState('');
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [doctorId, setDoctorId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<ImagingOrder | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getImagingExams({ active: true })
      .then((list) => live && setExams(list))
      .catch((err) => {
        if (!live) return;
        setExams([]);
        setError(messageOf(err, t('img.loadFailed')));
      });
    return () => {
      live = false;
    };
  }, [t]);

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    api
      .getDoctors({ limit: 100 })
      .then((res) => live && setDoctors(res.data.map((d) => ({ id: d.id, name: `Dr ${d.firstName} ${d.lastName}` }))))
      .catch(() => live && setDoctors([]));
    return () => {
      live = false;
    };
  }, [isAdmin]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = (exams ?? []).filter((e) => !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || e.bodyPart.toLowerCase().includes(q));
    return MODALITIES.map((m) => ({ modality: m, exams: visible.filter((e) => e.modality === m) })).filter((g) => g.exams.length > 0);
  }, [exams, search]);

  const exam = exams?.find((e) => e.id === examId) ?? null;

  const submit = async () => {
    if (!examId) return setError(t('img.order.examRequired'));
    if (clinicalInfo.trim().length < 5) return setError(t('img.order.clinicalRequired'));
    if (isAdmin && !doctorId) return setError(t('img.order.doctorRequired'));
    setSaving(true);
    setError('');
    try {
      const order = await api.createImagingOrder({
        patientId: patient.id,
        examId,
        priority,
        clinicalInfo: clinicalInfo.trim(),
        ...(question.trim() ? { question: question.trim() } : {}),
        ...(consultationId ? { consultationId } : {}),
        ...(admissionId ? { admissionId } : {}),
        ...(isAdmin && doctorId ? { orderedById: doctorId } : {}),
      });
      setCreated(order);
      onCreated?.(order);
    } catch (err) {
      setError(messageOf(err, t('img.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <DialogShell
        title={t('img.order.createdTitle')}
        subtitle={`${created.number} · ${created.exam.name}`}
        onClose={onClose}
        footer={
          <>
            <Link href={`/dashboard/imaging/${created.id}`} className={cancelBtn}>{t('img.order.openExam')}</Link>
            <button type="button" onClick={onClose} className={primaryBtn}>{t('img.close')}</button>
          </>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('img.order.createdHint')}</p>
        {created.warnings.length > 0 && (
          <ul className="space-y-2">
            {created.warnings.map((w) => (
              <li key={w} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
                {t(`img.warning.${w}`) === `img.warning.${w}` ? w : t(`img.warning.${w}`)}
              </li>
            ))}
          </ul>
        )}
        {created.exam.preparation && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">{t('img.preparation')} :</span> {created.exam.preparation}
          </p>
        )}
      </DialogShell>
    );
  }

  return (
    <DialogShell
      wide
      title={t('img.order.title')}
      subtitle={`${patient.name} · ${patient.patientId}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('img.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{saving ? t('img.saving') : t('img.order.submit')}</button>
        </>
      }
    >
      <ErrorBox message={error} />

      <div>
        <label htmlFor="img-exam-search" className={labelClass}>{t('img.order.exam')}<span className="text-red-500"> *</span></label>
        <input id="img-exam-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('img.order.searchExam')} className={inputClass} />
        <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
          {exams === null && <p className="p-3 text-sm text-gray-500">{t('img.loading')}</p>}
          {exams !== null && grouped.length === 0 && <p className="p-3 text-sm text-gray-500">{t('img.order.noExam')}</p>}
          {grouped.map((group) => (
            <div key={group.modality}>
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">{t(`img.modality.${group.modality}`)}</p>
              {group.exams.map((e) => (
                <label key={e.id} className={`flex items-start gap-3 px-3 py-2 cursor-pointer ${examId === e.id ? 'bg-lime-50 dark:bg-lime-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                  <input type="radio" name="img-exam" value={e.id} checked={examId === e.id} onChange={() => setExamId(e.id)} className="mt-1" />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{e.name}</span>
                      {e.usesContrast && <ContrastBadge />}
                    </span>
                    {e.preparation && <span className="block text-xs text-gray-500 dark:text-gray-400">{t('img.preparation')} : {e.preparation}</span>}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatCurrency(e.price)}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        {exam?.usesContrast && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{t('img.order.contrastHint')}</p>}
      </div>

      <fieldset>
        <legend className={labelClass}>{t('img.order.priority')}</legend>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              aria-pressed={priority === p}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${
                priority === p
                  ? p === 'STAT'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t(`img.priority.${p}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="img-clinical" className={labelClass}>{t('img.clinicalInfo')}<span className="text-red-500"> *</span></label>
        <textarea id="img-clinical" rows={4} value={clinicalInfo} onChange={(e) => setClinicalInfo(e.target.value)} className={inputClass} placeholder={t('img.order.clinicalPlaceholder')} />
      </div>
      <div>
        <label htmlFor="img-question" className={labelClass}>{t('img.question')}</label>
        <input id="img-question" value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass} placeholder={t('img.order.questionPlaceholder')} />
      </div>

      {isAdmin && (
        <div>
          <label htmlFor="img-doctor" className={labelClass}>{t('img.order.doctor')}<span className="text-red-500"> *</span></label>
          <select id="img-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
            <option value="">{t('img.order.chooseDoctor')}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
    </DialogShell>
  );
}

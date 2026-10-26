'use client';

import { useLanguage } from '@/context/language-context';
import { ATTACHMENT_CATEGORY_STYLE, PROBLEM_STATUS_STYLE, type AttachmentCategory, type ProblemStatus } from '@/lib/clinical-docs';

export { DialogShell, ErrorBox, cardClass, inputClass, labelClass, cancelBtn, primaryBtn, dangerBtn, smallBtn, messageOf } from '@/components/inpatient/ui';

export function CategoryChip({ category }: { category: AttachmentCategory }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${ATTACHMENT_CATEGORY_STYLE[category] ?? ATTACHMENT_CATEGORY_STYLE.OTHER}`}>{t(`cdoc.att.cat.${category}`)}</span>;
}

export function ProblemStatusChip({ status }: { status: ProblemStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${PROBLEM_STATUS_STYLE[status] ?? PROBLEM_STATUS_STYLE.active}`}>{t(`cdoc.prob.status.${status}`)}</span>;
}

/** Calendar day of a date or timestamp */
export const dayOf = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

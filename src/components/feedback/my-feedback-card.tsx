'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type MyFeedbackItem } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

/** "Votre avis": surveys still open for the record being viewed (hidden when there are none) */
export function MyFeedbackCard() {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();
  const [pending, setPending] = useState<MyFeedbackItem[]>([]);

  useEffect(() => {
    if (user?.role !== 'PATIENT') return;
    let live = true;
    api
      .getMyFeedback()
      .then((data) => live && setPending(data.pending.filter((f) => f.token && !(f.expiresAt && new Date(f.expiresAt) < new Date()))))
      .catch(() => live && setPending([]));
    return () => {
      live = false;
    };
  }, [user?.role]);

  if (pending.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <h2 className="font-semibold text-amber-900 dark:text-amber-200">{t('fb.card.title')}</h2>
      <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">{t('fb.card.help')}</p>
      <ul className="mt-3 space-y-2">
        {pending.map((item) => (
          <li key={item.token} className="flex flex-col gap-2 rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-800/60 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-800 dark:text-gray-200">
              {t(item.visit?.kind === 'STAY' ? 'fb.card.stay' : 'fb.card.consultation', {
                date: item.visit?.date ? formatDate(item.visit.date) : '—',
              })}
              {item.visit?.department ? ` · ${item.visit.department}` : ''}
              {item.visit?.doctorName ? ` · ${item.visit.doctorName}` : ''}
            </span>
            <Link href={`/feedback/${item.token}`} className="self-start rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 sm:self-auto">
              {t('fb.card.give')}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

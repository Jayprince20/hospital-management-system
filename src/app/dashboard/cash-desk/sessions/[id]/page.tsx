'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import type { CashierSessionDetail } from '@/lib/cash-desk';
import { DepositDialog } from '@/components/cash-desk/dialogs';
import { SessionDetailView } from '@/components/cash-desk/session-view';
import { ErrorBox, SessionStatusBadge, cancelBtn, messageOf, primaryBtn, useCashDeskPdf } from '@/components/cash-desk/ui';

export default function CashierSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, formatDateTime, formatCurrency } = useLanguage();
  const toast = useToast();
  const pdf = useCashDeskPdf();
  const [session, setSession] = useState<CashierSessionDetail | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(() => {
    api
      .getCashierSession(id)
      .then((s) => {
        setSession(s);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('cd.loadFailed'))));
  }, [id, t]);
  useEffect(() => load(), [load]);

  const back = isAdmin ? '/dashboard/cash-desk/supervision' : '/dashboard/cash-desk';
  if (!session) {
    return (
      <div className="space-y-3">
        <Link href={back} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('cd.back')}</Link>
        {error ? <ErrorBox message={error} /> : <p className="text-gray-500">{t('cd.loading')}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={back} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('cd.back')}</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {session.number} <SessionStatusBadge status={session.status} />
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('cd.sessionLine', { name: session.cashier.name, opened: formatDateTime(session.openedAt), float: formatCurrency(session.openingFloat) })}
            {session.closedAt ? ` · ${t('cd.closedAt', { date: formatDateTime(session.closedAt) })}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cancelBtn} onClick={() => pdf.report(session.id, session.number)}>{session.status === 'OPEN' ? t('cd.xReport') : t('cd.zReport')}</button>
          {isAdmin && session.status === 'CLOSED' && !session.depositReceivedAt && (
            <button type="button" className={primaryBtn} onClick={() => setConfirming(true)}>{t('cd.deposit.confirm')}</button>
          )}
        </div>
      </div>
      <ErrorBox message={error} />
      <SessionDetailView session={session} />
      {confirming && (
        <DepositDialog
          session={session}
          onClose={() => setConfirming(false)}
          onDone={() => {
            setConfirming(false);
            toast.success(t('cd.deposit.savedToast', { number: session.number }));
            load();
          }}
        />
      )}
    </div>
  );
}

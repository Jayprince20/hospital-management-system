'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import type { PurchaseOrderDetail } from '@/lib/purchasing';
import { OrderForm } from '@/components/purchasing/order-form';
import { ErrorBox, cancelBtn, messageOf } from '@/components/purchasing/ui';

export default function EditPurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPurchaseOrder(id).then(setOrder).catch((err) => setError(messageOf(err, t('pur.loadFailed'))));
  }, [id, t]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order ? t('pur.form.editTitle', { number: order.orderNumber }) : t('pur.loading')}</h1>
      </div>
      <ErrorBox message={error} />
      {order && order.status !== 'DRAFT' && (
        <div className="space-y-3">
          <ErrorBox message={t('pur.form.notDraft')} />
          <Link href={`/dashboard/purchasing/${order.id}`} className={cancelBtn}>{t('pur.backToOrder')}</Link>
        </div>
      )}
      {order && order.status === 'DRAFT' && <OrderForm order={order} />}
    </div>
  );
}

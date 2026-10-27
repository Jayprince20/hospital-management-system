'use client';

import { useLanguage } from '@/context/language-context';
import { OrderForm } from '@/components/purchasing/order-form';

export default function NewPurchaseOrderPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pur.form.newTitle')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('pur.form.newSubtitle')}</p>
      </div>
      <OrderForm />
    </div>
  );
}

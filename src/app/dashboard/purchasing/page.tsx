'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/language-context';
import { InvoicesTab, OrdersTab, PayablesTab, PerformanceTab, SuggestionsTab } from '@/components/purchasing/tabs';
import { primaryBtn } from '@/components/purchasing/ui';

type Tab = 'orders' | 'suggestions' | 'invoices' | 'payables' | 'performance';
const TABS: Tab[] = ['orders', 'suggestions', 'invoices', 'payables', 'performance'];

export default function PurchasingPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('orders');
  // Bumped when the suggestions tab creates drafts, so the orders list reloads
  const [ordersKey, setOrdersKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pur.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('pur.subtitle')}</p>
        </div>
        <Link href="/dashboard/purchasing/new" className={primaryBtn}>{t('pur.newOrder')}</Link>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-lime-600 text-lime-700 dark:text-lime-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
          >
            {t(`pur.tab.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab key={ordersKey} />}
      {tab === 'suggestions' && <SuggestionsTab onOrdersCreated={() => setOrdersKey((k) => k + 1)} />}
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'payables' && <PayablesTab />}
      {tab === 'performance' && <PerformanceTab />}
    </div>
  );
}

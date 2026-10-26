'use client';

import { useLanguage } from '@/context/language-context';

/** Shown by the service worker when a page was never opened online on this device */
export default function OfflinePage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas dark:bg-gray-900 p-6">
      <div className="max-w-md w-full rounded-2xl border border-line bg-white dark:bg-gray-800 dark:border-gray-700 p-8 text-center space-y-4">
        <div aria-hidden="true" className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.8a15 15 0 0 1 4.2-2.6M9.6 5.2A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 4.3-2.3M14.7 10.6A10 10 0 0 1 19 12.9M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M2 2l20 20" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink dark:text-white">{t('off.page.title')}</h1>
        <p className="text-sm text-ink-muted dark:text-gray-300 leading-relaxed">{t('off.page.body')}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {/* Plain links: they work even when the page's scripts could not load */}
          <a href="/dashboard" className="inline-flex items-center px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold">
            {t('off.page.back')}
          </a>
          <a href="" className="inline-flex items-center px-4 py-2 rounded-lg border border-line dark:border-gray-600 text-sm text-ink dark:text-gray-200">
            {t('off.page.retry')}
          </a>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { Modal } from '@/components/ui';
import { api } from '@/lib/api';

const MFA_REQUIRED_ROLES = ['ADMIN', 'DOCTOR'];

/** Two-factor status for the signed-in user: set it up, or turn it off when the role allows */
export function TwoFactorSettings() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [showDisable, setShowDisable] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const enabled = !!user?.mfaEnabled;
  const required = MFA_REQUIRED_ROLES.includes(user?.role ?? '');

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.disableMfa(code);
      await refreshUser();
      toast.success(t('security.settings.disabledToast'));
      setShowDisable(false);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('security.login.verifyFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white">{t('security.settings.title')}</h3>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            enabled
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {enabled ? t('security.settings.enabled') : t('security.settings.disabled')}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {enabled ? t('security.settings.enabledDesc') : t('security.settings.disabledDesc')}
      </p>
      {required && enabled && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('security.settings.mandatory')}</p>}

      <div className="mt-4">
        {!enabled ? (
          <button
            type="button"
            onClick={() => router.push('/setup-2fa')}
            className="px-4 py-2 text-sm text-lime-600 border border-lime-600 rounded-lg hover:bg-lime-50 dark:hover:bg-lime-900/50"
          >
            {t('security.settings.setUp')}
          </button>
        ) : (
          !required && (
            <button
              type="button"
              onClick={() => setShowDisable(true)}
              className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              {t('security.settings.disable')}
            </button>
          )
        )}
      </div>
      {enabled && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('security.settings.lostPhone')}</p>}

      <Modal isOpen={showDisable} onClose={() => setShowDisable(false)} size="sm">
        <Modal.Header>{t('security.settings.disableTitle')}</Modal.Header>
        <Modal.Body>
        <form onSubmit={disable} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="disable-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('security.settings.disableCodeLabel')}
            </label>
            <input
              id="disable-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono tracking-[0.4em] text-center focus:ring-2 focus:ring-lime-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowDisable(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              {t('security.settings.cancel')}
            </button>
            <button type="submit" disabled={busy || code.length !== 6} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg">
              {t('security.settings.disableConfirm')}
            </button>
          </div>
        </form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

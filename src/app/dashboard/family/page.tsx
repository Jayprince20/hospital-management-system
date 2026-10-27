'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type GrantedToLink, type MyProxies, type ProxyAccessLevel, type ProxyRelationship } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useActingPatient } from '@/context/acting-patient-context';
import { useToast } from '@/components/toast';
import { LoadingState } from '@/components/ui';
import { ErrorBox, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';
import { contactKind, lastAccessDay, maskEmail, maskPhone, PROXY_ACCESS_LEVELS } from '@/lib/patient-extras';

// The owner names how the other person relates to them
const GRANT_RELATIONSHIPS: ProxyRelationship[] = ['SPOUSE', 'CHILD', 'PARENT', 'CAREGIVER', 'OTHER'];

/** "Ma famille": relatives I manage, and who may see my own record */
export default function FamilyPage() {
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const { setActing, refreshLinks } = useActingPatient();
  const [data, setData] = useState<MyProxies | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.getMyProxies());
      setLoadError('');
    } catch (err) {
      setLoadError(messageOf(err, t('fam.loadFailed')));
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async (link: GrantedToLink) => {
    if (!window.confirm(t('fam.mine.revokeConfirm', { name: `${link.proxyUser.firstName} ${link.proxyUser.lastName}` }))) return;
    setBusyId(link.linkId);
    try {
      await api.removeMyProxyLink(link.linkId);
      toast.success(t('fam.mine.revoked'));
      await load();
    } catch (err) {
      toast.error(t('fam.actionFailed'), messageOf(err, ''));
    } finally {
      setBusyId(null);
    }
  };

  const leave = async (linkId: string, name: string) => {
    if (!window.confirm(t('fam.actingFor.leaveConfirm', { name }))) return;
    setBusyId(linkId);
    try {
      await api.removeMyProxyLink(linkId);
      toast.success(t('fam.actingFor.left'));
      await Promise.all([load(), refreshLinks()]);
    } catch (err) {
      toast.error(t('fam.actionFailed'), messageOf(err, ''));
    } finally {
      setBusyId(null);
    }
  };

  if (!data && !loadError) return <LoadingState label={t('common.loading')} minHeight="h-64" />;

  const activeGranted = (data?.grantedTo ?? []).filter((l) => l.status === 'ACTIVE');
  const pastGranted = (data?.grantedTo ?? []).filter((l) => l.status !== 'ACTIVE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('fam.page.title')}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">{t('fam.page.subtitle')}</p>
      </div>
      <ErrorBox message={loadError} />

      {/* Relatives I act for */}
      <section className={`${cardClass} p-5`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('fam.actingFor.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('fam.actingFor.help')}</p>
        {(data?.actingFor.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('fam.actingFor.none')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
            {data?.actingFor.map((link) => {
              const name = `${link.patient.firstName} ${link.patient.lastName}`;
              return (
                <li key={link.linkId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t(`fam.relativeCap.${link.relationship}`)} · {t(`fam.level.${link.accessLevel}`)}
                      {link.validUntil ? ` · ${t('fam.until', { date: formatDate(lastAccessDay(link.validUntil) ?? link.validUntil) })}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActing(link);
                        router.push('/dashboard');
                      }}
                      className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
                    >
                      {t('fam.actingFor.open')}
                    </button>
                    <button type="button" disabled={busyId === link.linkId} onClick={() => leave(link.linkId, name)} className={smallBtn}>
                      {t('fam.actingFor.leave')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t('fam.actingFor.minorsAtDesk')}</p>
      </section>

      {/* Who may see my record */}
      <section className={`${cardClass} p-5`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('fam.mine.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('fam.mine.help')}</p>
        {activeGranted.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('fam.mine.none')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
            {activeGranted.map((link) => (
              <li key={link.linkId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {link.proxyUser.firstName} {link.proxyUser.lastName}
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      {[maskEmail(link.proxyUser.email), maskPhone(link.proxyUser.phone)].filter(Boolean).join(' · ')}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t(`fam.relationship.${link.relationship}`)} · {t(`fam.level.${link.accessLevel}`)} ·{' '}
                    {link.grantedBy === 'STAFF' ? t('fam.grantedBy.STAFF') : t('fam.grantedBy.PATIENT')} · {formatDate(link.createdAt)}
                    {link.validUntil ? ` · ${t('fam.until', { date: formatDate(lastAccessDay(link.validUntil) ?? link.validUntil) })}` : ''}
                  </p>
                </div>
                <button type="button" disabled={busyId === link.linkId} onClick={() => remove(link)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30">
                  {t('fam.mine.revoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {pastGranted.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-gray-600 dark:text-gray-400">{t('fam.mine.past', { count: pastGranted.length })}</summary>
            <ul className="mt-2 space-y-1 text-gray-500 dark:text-gray-400">
              {pastGranted.map((link) => (
                <li key={link.linkId}>
                  {link.proxyUser.firstName} {link.proxyUser.lastName} · {t(`fam.status.${link.status}`)}
                </li>
              ))}
            </ul>
          </details>
        )}
        <GrantAccessForm onGranted={load} />
      </section>
    </div>
  );
}

function GrantAccessForm({ onGranted }: { onGranted: () => Promise<void> }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [contact, setContact] = useState('');
  const [relationship, setRelationship] = useState<ProxyRelationship>('SPOUSE');
  const [level, setLevel] = useState<ProxyAccessLevel>('FULL');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kind = contactKind(contact);
    if (!kind) return setError(t('fam.grant.badContact'));
    setSaving(true);
    setError('');
    try {
      await api.grantMyRecordAccess({
        ...(kind === 'email' ? { email: contact.trim() } : { phone: contact.trim() }),
        relationship,
        accessLevel: level,
      });
      toast.success(t('fam.grant.done'));
      setContact('');
      await onGranted();
    } catch (err) {
      setError(messageOf(err, t('fam.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-white">{t('fam.grant.title')}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('fam.grant.help')}</p>
      <div>
        <label htmlFor="grant-contact" className={labelClass}>
          {t('fam.grant.contact')}
        </label>
        <input id="grant-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('fam.grant.contactPlaceholder')} autoComplete="off" className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="grant-relationship" className={labelClass}>
            {t('fam.grant.relationship')}
          </label>
          <select id="grant-relationship" value={relationship} onChange={(e) => setRelationship(e.target.value as ProxyRelationship)} className={inputClass}>
            {GRANT_RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {t(`fam.relationship.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className={labelClass}>{t('fam.grant.level')}</legend>
          <div className="space-y-2">
            {PROXY_ACCESS_LEVELS.map((l) => (
              <label key={l} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" name="grant-level" checked={level === l} onChange={() => setLevel(l)} className="mt-1" />
                <span>
                  <span className="font-medium">{t(`fam.level.${l}`)}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{t(`fam.levelHelp.${l}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <ErrorBox message={error} />
      <button type="submit" disabled={saving || !contact.trim()} className={primaryBtn}>
        {saving ? t('fam.saving') : t('fam.grant.submit')}
      </button>
    </form>
  );
}

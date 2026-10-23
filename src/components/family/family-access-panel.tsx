'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Patient, type ProxyAccessLevel, type ProxyLink, type ProxyRelationship } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';
import { eighteenthBirthday, isMinor, lastAccessDay, maskPhone, PROXY_ACCESS_LEVELS, PROXY_RELATIONSHIPS } from '@/lib/patient-extras';

/**
 * Staff view of a patient's family access: who may act for this record. The desk adds a parent
 * or guardian after checking an identity document (acte de naissance, jugement de tutelle).
 */
export function PatientFamilyAccessPanel({ patient }: { patient: { id: string; name: string; dateOfBirth?: string | null } }) {
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const [links, setLinks] = useState<ProxyLink[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<ProxyLink | null>(null);

  const load = useCallback(async () => {
    try {
      setLinks(await api.getProxyLinks({ patientId: patient.id }));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('fam.loadFailed')));
    }
  }, [patient.id, t]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const minor = isMinor(patient.dateOfBirth);

  return (
    <div className={`${cardClass} p-5 space-y-4`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('fam.staff.title')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{minor ? t('fam.staff.helpMinor') : t('fam.staff.helpAdult')}</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className={primaryBtn}>
          {t('fam.staff.add')}
        </button>
      </div>
      <ErrorBox message={error} />
      {links && links.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('fam.staff.none')}</p>}
      {links && links.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">{t('fam.staff.col.person')}</th>
                <th className="px-3 py-2">{t('fam.staff.col.relationship')}</th>
                <th className="px-3 py-2">{t('fam.staff.col.level')}</th>
                <th className="px-3 py-2">{t('fam.staff.col.status')}</th>
                <th className="px-3 py-2">{t('fam.staff.col.granted')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {links.map((link) => (
                <tr key={link.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {link.proxyUser.firstName} {link.proxyUser.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{link.proxyUser.email ?? maskPhone(link.proxyUser.phone ?? link.proxyUser.phoneNumber)}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t(`fam.relationship.${link.relationship}`)}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t(`fam.level.${link.accessLevel}`)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${link.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {t(`fam.status.${link.status}`)}
                    </span>
                    {link.validUntil && link.status === 'ACTIVE' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('fam.until', { date: formatDate(lastAccessDay(link.validUntil) ?? link.validUntil) })}</p>}
                    {link.revokeReason && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{link.revokeReason}</p>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {link.grantedBy === 'STAFF' ? t('fam.grantedBy.STAFF') : t('fam.grantedBy.PATIENT')} · {formatDate(link.createdAt)}
                    {link.verificationNote && <p className="mt-0.5 italic">{link.verificationNote}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {link.status === 'ACTIVE' && (
                      <button type="button" onClick={() => setRevoking(link)} className={smallBtn}>
                        {t('fam.staff.revoke')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddGuardianDialog
          patient={patient}
          onClose={() => setAdding(false)}
          onDone={async () => {
            setAdding(false);
            toast.success(t('fam.staff.added'));
            await load();
          }}
        />
      )}
      {revoking && (
        <RevokeDialog
          link={revoking}
          onClose={() => setRevoking(null)}
          onDone={async () => {
            setRevoking(null);
            toast.success(t('fam.staff.revoked'));
            await load();
          }}
        />
      )}
    </div>
  );
}

function AddGuardianDialog({
  patient,
  onClose,
  onDone,
}: {
  patient: { id: string; name: string; dateOfBirth?: string | null };
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const minor = isMinor(patient.dateOfBirth);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [person, setPerson] = useState<Patient | null>(null);
  const [relationship, setRelationship] = useState<ProxyRelationship>(minor ? 'PARENT' : 'CAREGIVER');
  const [level, setLevel] = useState<ProxyAccessLevel>('FULL');
  const [note, setNote] = useState('');
  const [validUntil, setValidUntil] = useState(minor ? eighteenthBirthday(patient.dateOfBirth) ?? '' : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  const query = search.trim();
  useEffect(() => {
    if (person || query.length < 2) return;
    const current = ++seq.current;
    const timer = setTimeout(() => {
      api
        .getPatients({ search: query, limit: 8 })
        .then((res) => current === seq.current && setResults(res.data.filter((p) => p.id !== patient.id)))
        .catch(() => current === seq.current && setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, person, patient.id]);

  const submit = async () => {
    if (!person) return setError(t('fam.staff.pickPerson'));
    if (!note.trim()) return setError(t('fam.staff.noteRequired'));
    setSaving(true);
    setError('');
    try {
      await api.createProxyLink({
        patientId: patient.id,
        ...(person.userId ? { proxyUserId: person.userId } : {}),
        proxyPatientId: person.id,
        relationship,
        accessLevel: level,
        verificationNote: note.trim(),
        validUntil: validUntil || null,
      });
      await onDone();
    } catch (err) {
      setError(messageOf(err, t('fam.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('fam.staff.addTitle')}
      subtitle={patient.name}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>
            {t('fam.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>
            {saving ? t('fam.saving') : t('fam.staff.addSubmit')}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="proxy-search" className={labelClass}>
          {t('fam.staff.person')}
        </label>
        {person ? (
          <div className="flex items-center justify-between rounded-lg border border-lime-300 bg-lime-50 px-3 py-2 text-sm dark:border-lime-700 dark:bg-lime-900/20">
            <span className="text-gray-900 dark:text-white">
              {person.firstName} {person.lastName} · {person.patientId}
            </span>
            <button type="button" onClick={() => setPerson(null)} className="text-lime-700 hover:underline dark:text-lime-400">
              {t('fam.change')}
            </button>
          </div>
        ) : (
          <>
            <input id="proxy-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('fam.staff.searchPlaceholder')} className={inputClass} autoComplete="off" />
            {query.length >= 2 && (
              <ul className="mt-2 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                {results.length === 0 && <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('fam.staff.noResults')}</li>}
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPerson(p);
                        setResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="ml-2 text-gray-500 dark:text-gray-400">
                        {p.patientId} · {maskPhone(p.phoneNumber)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('fam.staff.searchHelp')}</p>
          </>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="proxy-relationship" className={labelClass}>
            {t('fam.staff.relationship')}
          </label>
          <select id="proxy-relationship" value={relationship} onChange={(e) => setRelationship(e.target.value as ProxyRelationship)} className={inputClass}>
            {PROXY_RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {t(`fam.relationship.${r}`)}
              </option>
            ))}
          </select>
          {!minor && relationship === 'PARENT' && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t('fam.staff.parentAdult')}</p>}
        </div>
        <div>
          <label htmlFor="proxy-level" className={labelClass}>
            {t('fam.staff.level')}
          </label>
          <select id="proxy-level" value={level} onChange={(e) => setLevel(e.target.value as ProxyAccessLevel)} className={inputClass}>
            {PROXY_ACCESS_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`fam.level.${l}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="proxy-note" className={labelClass}>
          {t('fam.staff.note')}
        </label>
        <input id="proxy-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('fam.staff.notePlaceholder')} className={inputClass} />
      </div>
      <div>
        <label htmlFor="proxy-until" className={labelClass}>
          {t('fam.staff.validUntil')}
        </label>
        <input id="proxy-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
        {minor && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('fam.staff.validUntilMinor')}</p>}
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}

function RevokeDialog({ link, onClose, onDone }: { link: ProxyLink; onClose: () => void; onDone: () => Promise<void> }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return setError(t('fam.staff.reasonRequired'));
    setSaving(true);
    setError('');
    try {
      await api.revokeProxyLink(link.id, reason.trim());
      await onDone();
    } catch (err) {
      setError(messageOf(err, t('fam.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t('fam.staff.revokeTitle')}
      subtitle={`${link.proxyUser.firstName} ${link.proxyUser.lastName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>
            {t('fam.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={saving} className={dangerBtn}>
            {t('fam.staff.revoke')}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="revoke-reason" className={labelClass}>
          {t('fam.staff.reason')}
        </label>
        <textarea id="revoke-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { PermissionGate } from '@/components/permission-gate';
import { ConfirmModal } from '@/components/confirm-modal';
import { DialogShell, ErrorBox, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';
import {
  FHIR_RESOURCES,
  buildScopes,
  fhirUrls,
  parseScopes,
  scopeSummary,
  summarizeCapability,
  type CapabilitySummary,
  type FhirClient,
  type FhirUsageEntry,
  type ScopeSelection,
} from '@/lib/fhir';

const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase';
const td = 'px-3 py-2 text-sm text-gray-700 dark:text-gray-300 align-top';
const mono = 'font-mono text-xs break-all';

function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused (insecure origin): the value stays selectable
    }
  };
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="flex items-center gap-2">
        <code className={`${mono} flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 select-all`}>{value}</code>
        <button type="button" onClick={copy} className={smallBtn} aria-label={`${t('fhir.copy')} — ${label}`}>
          {copied ? t('fhir.copied') : t('fhir.copy')}
        </button>
      </div>
    </div>
  );
}

/** Create or edit a client: name + SMART system scopes per resource (read / search) */
function ClientDialog({ client, onClose, onSaved }: { client: FhirClient | null; onClose: () => void; onSaved: (result: { client: FhirClient; secret?: string }) => void }) {
  const { t } = useLanguage();
  const initial = useMemo(() => parseScopes(client?.scopes ?? []), [client]);
  const [name, setName] = useState(client?.name ?? '');
  const [all, setAll] = useState(client ? initial.all : false);
  const [selection, setSelection] = useState<ScopeSelection>(initial.selection);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const scopes = buildScopes(selection, all);

  const toggle = (resource: (typeof FHIR_RESOURCES)[number], key: 'read' | 'search') =>
    setSelection((s) => ({ ...s, [resource]: { ...s[resource], [key]: !s[resource][key] } }));

  const save = async () => {
    if (!name.trim()) return setError(t('fhir.dialog.nameRequired'));
    if (scopes.length === 0) return setError(t('fhir.dialog.scopeRequired'));
    setBusy(true);
    setError('');
    try {
      if (client) {
        onSaved({ client: await api.updateFhirClient(client.id, { name: name.trim(), scopes }) });
      } else {
        const created = await api.createFhirClient({ name: name.trim(), scopes });
        onSaved({ client: created.client, secret: created.clientSecret });
      }
    } catch (err) {
      setError(messageOf(err, t('fhir.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={client ? t('fhir.dialog.editTitle', { name: client.name }) : t('fhir.dialog.createTitle')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('fhir.dialog.cancel')}</button>
          <button type="button" onClick={save} disabled={busy} className={primaryBtn}>{client ? t('fhir.dialog.save') : t('fhir.dialog.create')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="space-y-4">
        <label className="block">
          <span className={labelClass}>{t('fhir.dialog.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('fhir.dialog.namePlaceholder')} className={inputClass} maxLength={120} autoFocus />
        </label>
        <fieldset>
          <legend className={labelClass}>{t('fhir.dialog.scopes')}</legend>
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 mb-3">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            {t('fhir.dialog.all')}
          </label>
          <div className={`overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 ${all ? 'opacity-50' : ''}`}>
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className={th}>{t('fhir.cap.resource')}</th>
                  <th className={`${th} text-center`}>{t('fhir.dialog.read')}</th>
                  <th className={`${th} text-center`}>{t('fhir.dialog.search')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {FHIR_RESOURCES.map((r) => (
                  <tr key={r}>
                    <td className={td}>{r}</td>
                    {(['read', 'search'] as const).map((k) => (
                      <td key={k} className={`${td} text-center`}>
                        <input
                          type="checkbox"
                          disabled={all}
                          checked={all || selection[r][k]}
                          onChange={() => toggle(r, k)}
                          aria-label={`${r} — ${k === 'read' ? t('fhir.dialog.read') : t('fhir.dialog.search')}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <div>
          <p className={labelClass}>{t('fhir.dialog.preview')}</p>
          <p className={`${mono} text-gray-600 dark:text-gray-300`}>{scopes.length ? scopes.join(' ') : '—'}</p>
        </div>
      </div>
    </DialogShell>
  );
}

/** Shown once after creating a client or rotating its secret */
function SecretPanel({ clientId, secret, onDone }: { clientId: string; secret: string; onDone: () => void }) {
  const { t } = useLanguage();
  return (
    <DialogShell title={t('fhir.secret.title')} onClose={onDone} footer={<button type="button" onClick={onDone} className={primaryBtn}>{t('fhir.secret.done')}</button>}>
      <div className="space-y-4">
        <p role="alert" className="p-3 rounded-lg text-sm bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">{t('fhir.secret.warning')}</p>
        <CopyField label={t('fhir.secret.clientId')} value={clientId} />
        <CopyField label={t('fhir.secret.secret')} value={secret} />
      </div>
    </DialogShell>
  );
}

export default function FhirSettingsPage() {
  const { t, formatDateTime } = useLanguage();
  const toast = useToast();
  const urls = useMemo(() => fhirUrls(api.getApiOrigin()), []);
  const [capability, setCapability] = useState<CapabilitySummary | null>(null);
  const [capError, setCapError] = useState('');
  const [clients, setClients] = useState<FhirClient[] | null>(null);
  const [usage, setUsage] = useState<FhirUsageEntry[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FhirClient | 'new' | null>(null);
  const [secret, setSecret] = useState<{ clientId: string; secret: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'revoke' | 'rotate'; client: FhirClient } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, recent] = await Promise.all([api.getFhirClients(), api.getFhirUsage(20)]);
      setClients(list);
      setUsage(recent);
      setError('');
    } catch (err) {
      setClients((c) => c ?? []);
      setUsage((u) => u ?? []);
      setError(messageOf(err, t('fhir.loadFailed')));
    }
  }, [t]);

  useEffect(() => {
    void load();
    api
      .getFhirCapability()
      .then((cs) => setCapability(summarizeCapability(cs)))
      .catch((err) => setCapError(messageOf(err, 'HTTP')));
  }, [load]);

  const setActive = async (client: FhirClient, active: boolean) => {
    setBusy(true);
    try {
      await api.updateFhirClient(client.id, { active });
      toast.success(active ? t('fhir.clients.reactivated.toast') : t('fhir.clients.revoked.toast'), client.name);
      await load();
    } catch (err) {
      toast.error(t('fhir.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const rotate = async (client: FhirClient) => {
    setBusy(true);
    try {
      const { clientSecret } = await api.rotateFhirClientSecret(client.id);
      setSecret({ clientId: client.clientId, secret: clientSecret });
    } catch (err) {
      toast.error(t('fhir.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const scopeText = (scopes: string[]) => {
    const s = scopeSummary(scopes);
    if (s.all) return t('fhir.clients.allScope');
    return s.resources.length ? s.resources.join(', ') : t('fhir.clients.noScope');
  };

  return (
    <PermissionGate permission="settings:manage_system">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('fhir.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('fhir.subtitle')}</p>
        </div>

        <ErrorBox message={error} />

        <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="fhir-endpoint">
          <h2 id="fhir-endpoint" className="text-lg font-semibold text-gray-900 dark:text-white">{t('fhir.endpoint.title')}</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <CopyField label={t('fhir.endpoint.base')} value={urls.base} />
            <CopyField label={t('fhir.endpoint.smart')} value={urls.smart} />
            <CopyField label={t('fhir.endpoint.token')} value={urls.token} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('fhir.endpoint.help')}</p>
        </section>

        <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="fhir-cap">
          <h2 id="fhir-cap" className="text-lg font-semibold text-gray-900 dark:text-white">{t('fhir.cap.title')}</h2>
          {capError && <p className="text-sm text-red-600 dark:text-red-400">{t('fhir.cap.unavailable', { error: capError })}</p>}
          {capability && (
            <>
              <dl className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">{t('fhir.cap.version')}</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">{capability.fhirVersion ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">{t('fhir.cap.software')}</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">{capability.software ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">{t('fhir.cap.smart')}</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">{capability.smart ? t('fhir.cap.yes') : t('fhir.cap.no')}</dd>
                </div>
              </dl>
              {capability.resources.length === 0 ? (
                <p className="text-sm text-gray-500">{t('fhir.cap.empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className={th}>{t('fhir.cap.resource')}</th>
                        <th className={th}>{t('fhir.cap.interactions')}</th>
                        <th className={th}>{t('fhir.cap.searchParams')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {capability.resources.map((r) => (
                        <tr key={r.type}>
                          <td className={`${td} font-medium text-gray-900 dark:text-white`}>{r.type}</td>
                          <td className={td}>{[...r.interactions, ...r.operations].join(', ') || '—'}</td>
                          <td className={`${td} ${mono}`}>{r.searchParams.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {!capability && !capError && <p className="text-sm text-gray-500">…</p>}
        </section>

        <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="fhir-clients">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="fhir-clients" className="text-lg font-semibold text-gray-900 dark:text-white">{t('fhir.clients.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('fhir.clients.subtitle')}</p>
            </div>
            <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>{t('fhir.clients.new')}</button>
          </div>
          {clients && clients.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('fhir.clients.empty')}</p>}
          {clients && clients.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className={th}>{t('fhir.clients.name')}</th>
                    <th className={th}>{t('fhir.clients.clientId')}</th>
                    <th className={th}>{t('fhir.clients.scopes')}</th>
                    <th className={th}>{t('fhir.clients.lastUsed')}</th>
                    <th className={th}>{t('fhir.clients.status')}</th>
                    <th className={th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {clients.map((c) => (
                    <tr key={c.id} className={c.active ? '' : 'opacity-60'}>
                      <td className={td}>
                        <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                        {c.createdBy && <p className="text-xs text-gray-500">{t('fhir.clients.createdBy', { name: c.createdBy.name })}</p>}
                      </td>
                      <td className={`${td} ${mono}`}>{c.clientId}</td>
                      <td className={td}>
                        <span title={c.scopes.join(' ')}>{scopeText(c.scopes)}</span>
                      </td>
                      <td className={td}>{c.lastUsedAt ? formatDateTime(c.lastUsedAt) : t('fhir.clients.never')}</td>
                      <td className={td}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {c.active ? t('fhir.clients.active') : t('fhir.clients.revoked')}
                        </span>
                      </td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          <button type="button" className={smallBtn} onClick={() => setEditing(c)} disabled={busy}>{t('fhir.clients.edit')}</button>
                          {c.active && (
                            <button type="button" className={smallBtn} onClick={() => setConfirm({ kind: 'rotate', client: c })} disabled={busy}>{t('fhir.clients.rotate')}</button>
                          )}
                          {c.active ? (
                            <button type="button" className={`${smallBtn} text-red-700 dark:text-red-400`} onClick={() => setConfirm({ kind: 'revoke', client: c })} disabled={busy}>{t('fhir.clients.revoke')}</button>
                          ) : (
                            <button type="button" className={smallBtn} onClick={() => setActive(c, true)} disabled={busy}>{t('fhir.clients.reactivate')}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="fhir-usage">
          <h2 id="fhir-usage" className="text-lg font-semibold text-gray-900 dark:text-white">{t('fhir.usage.title')}</h2>
          {usage && usage.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('fhir.usage.empty')}</p>}
          {usage && usage.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className={th}>{t('fhir.usage.when')}</th>
                    <th className={th}>{t('fhir.usage.who')}</th>
                    <th className={th}>{t('fhir.usage.resource')}</th>
                    <th className={`${th} text-right`}>{t('fhir.usage.count')}</th>
                    <th className={th}>{t('fhir.usage.path')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {usage.map((u, i) => (
                    <tr key={`${u.at}-${i}`}>
                      <td className={td}>{formatDateTime(u.at)}</td>
                      <td className={td}>{u.clientName ?? (u.userName ? t(u.userRole === 'PATIENT' ? 'fhir.usage.patient' : 'fhir.usage.staff', { name: u.userName }) : '—')}</td>
                      <td className={td}>{u.resourceType}</td>
                      <td className={`${td} text-right tabular-nums`}>{u.count}</td>
                      <td className={`${td} ${mono}`}>{u.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {editing && (
          <ClientDialog
            client={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={({ client, secret: newSecret }) => {
              setEditing(null);
              if (newSecret) setSecret({ clientId: client.clientId, secret: newSecret });
              else toast.success(t('fhir.clients.saved'), client.name);
              void load();
            }}
          />
        )}

        {secret && <SecretPanel clientId={secret.clientId} secret={secret.secret} onDone={() => setSecret(null)} />}

        <ConfirmModal
          isOpen={confirm !== null}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (!confirm) return;
            if (confirm.kind === 'revoke') void setActive(confirm.client, false);
            else void rotate(confirm.client);
          }}
          title={confirm?.kind === 'revoke' ? t('fhir.clients.revoke') : t('fhir.clients.rotate')}
          message={confirm ? t(confirm.kind === 'revoke' ? 'fhir.clients.revokeConfirm' : 'fhir.clients.rotateConfirm', { name: confirm.client.name }) : ''}
          confirmText={confirm?.kind === 'revoke' ? t('fhir.clients.revoke') : t('fhir.clients.rotate')}
          cancelText={t('fhir.dialog.cancel')}
          variant={confirm?.kind === 'revoke' ? 'danger' : 'warning'}
          isLoading={busy}
        />
      </div>
    </PermissionGate>
  );
}

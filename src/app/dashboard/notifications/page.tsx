'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Notification, NotificationType, NotificationTargetRole } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { TableSkeleton, ErrorState, NoResults, Modal } from '@/components/ui';
import { ButtonSpinner } from '@/components/ui/loading-spinner';
import { useLanguage } from '@/context/language-context';

interface NotificationFormData {
  title: string;
  message: string;
  type: NotificationType;
  targetRole: NotificationTargetRole;
}

const initialFormData: NotificationFormData = {
  title: '',
  message: '',
  type: 'system',
  targetRole: 'ALL',
};

const notificationTypes: { value: NotificationType; label: string; color: string }[] = [
  { value: 'appointment', label: 'Appointment', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' },
  { value: 'lab_result', label: 'Lab Result', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400' },
  { value: 'payment', label: 'Payment', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400' },
  { value: 'prescription', label: 'Prescription', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' },
  { value: 'system', label: 'System', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
  { value: 'promotion', label: 'Promotion', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-400' },
];

const targetRoles: { value: NotificationTargetRole; label: string }[] = [
  { value: 'ALL', label: 'All Users' },
  { value: 'PATIENT', label: 'Patients Only' },
  { value: 'DOCTOR', label: 'Doctors Only' },
  { value: 'NURSE', label: 'Nurses Only' },
  { value: 'ADMIN', label: 'Admins Only' },
  { value: 'STAFF', label: 'All Staff' },
];

const getTypeConfig = (type: NotificationType) => {
  return notificationTypes.find((t) => t.value === type) || notificationTypes[4];
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const toast = useToast();
  const { t, formatDate } = useLanguage();
  const typeLabel = (type: string) => t(`admin.notif.type.${type}`);
  const audienceLabel = (role: string) => t(`admin.notif.audience.${role}`);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [formData, setFormData] = useState<NotificationFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getNotifications({
        type: typeFilter || undefined,
        unread: unreadOnly || undefined,
        page,
        limit: 20,
      });
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, unreadOnly, page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, unreadOnly]);

  const openCreateModal = () => {
    setFormData(initialFormData);
    setError('');
    setShowCreateModal(true);
  };

  const openDeleteModal = (notification: Notification) => {
    setSelectedNotification(notification);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      setError(t('admin.notif.requiredFields'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createNotification({
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        targetRole: formData.targetRole,
      });
      setShowCreateModal(false);
      setFormData(initialFormData);
      toast.success(t('admin.notif.sent'), t('admin.notif.sentMsg', { audience: audienceLabel(formData.targetRole) }));
      fetchNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create notification');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNotification) return;

    try {
      setSaving(true);
      await api.deleteNotification(selectedNotification.id);
      setShowDeleteModal(false);
      setSelectedNotification(null);
      toast.success(t('admin.notif.deleted'), t('admin.notif.deletedMsg'));
      fetchNotifications();
    } catch (err) {
      toast.error(t('admin.notif.deleteFailed'), err instanceof Error ? err.message : t('admin.notif.deleteError'));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast.error(t('admin.notif.error'), t('admin.notif.markReadError'));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await api.markAllNotificationsAsRead();
      toast.success(t('admin.notif.success'), t('admin.notif.markedAll', { count: result.count }));
      fetchNotifications();
    } catch (err) {
      toast.error(t('admin.notif.error'), t('admin.notif.markAllError'));
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all notifications?')) return;
    try {
      const result = await api.deleteAllNotifications(true);
      toast.success(t('admin.notif.success'), t('admin.notif.deletedAll', { count: result.count }));
      fetchNotifications();
    } catch (err) {
      toast.error(t('admin.notif.error'), t('admin.notif.deleteAllError'));
    }
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowDeleteModal(false);
    setSelectedNotification(null);
    setFormData(initialFormData);
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.notif.notifications')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('admin.notif.sendAndManageSystemNotifications')}
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('admin.notif.markAllRead')}
            </button>
          )}
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('admin.notif.sendNotification')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl p-4 border cursor-pointer transition-colors ${
            typeFilter === '' && !unreadOnly ? 'border-lime-500 ring-2 ring-lime-200 dark:ring-lime-800' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
          }`}
          onClick={() => { setTypeFilter(''); setUnreadOnly(false); }}
        >
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{notifications.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.notif.all')}</p>
        </div>
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl p-4 border cursor-pointer transition-colors ${
            unreadOnly ? 'border-lime-500 ring-2 ring-lime-200 dark:ring-lime-800' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
          }`}
          onClick={() => { setTypeFilter(''); setUnreadOnly(true); }}
        >
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{unreadCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.notif.unread')}</p>
        </div>
        {notificationTypes.map((type) => (
          <div
            key={type.value}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border cursor-pointer transition-colors ${
              typeFilter === type.value ? 'border-lime-500 ring-2 ring-lime-200 dark:ring-lime-800' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
            }`}
            onClick={() => { setTypeFilter(type.value); setUnreadOnly(false); }}
          >
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>
              {typeLabel(type.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Notifications Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Table Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {typeFilter ? t('admin.notif.typeHeading', { type: typeLabel(getTypeConfig(typeFilter).value) }) : unreadOnly ? t('admin.notif.unreadHeading') : t('admin.notif.allHeading')}
          </h2>
          {notifications.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              {t('admin.notif.deleteAll')}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {fetchError ? (
            <ErrorState message={fetchError} onRetry={fetchNotifications} />
          ) : loading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : notifications.length === 0 ? (
            <NoResults searchTerm="" onClear={() => { setTypeFilter(''); setUnreadOnly(false); }} />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3">{t('admin.notif.status')}</th>
                  <th className="px-6 py-3">{t('admin.notif.type')}</th>
                  <th className="px-6 py-3">{t('admin.notif.title')}</th>
                  <th className="px-6 py-3">{t('admin.notif.message')}</th>
                  <th className="px-6 py-3">{t('admin.notif.created')}</th>
                  <th className="px-6 py-3">{t('admin.notif.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((notification) => {
                  const typeConfig = getTypeConfig(notification.type);
                  return (
                    <tr
                      key={notification.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <td className="px-6 py-4">
                        {notification.isRead ? (
                          <span className="flex items-center gap-1 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                            </svg>
                            <span className="text-xs">{t('admin.notif.read')}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                            <span className="text-xs font-medium">{t('admin.notif.new')}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${typeConfig.color}`}>
                          {typeLabel(typeConfig.value)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                          {notification.title}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[300px]">
                          {notification.message}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(notification.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                              title={t('admin.notif.markAsRead')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteModal(notification)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                            title={t('admin.notif.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('admin.notif.previous')}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('admin.notif.pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('admin.notif.next')}
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={closeModals} size="lg">
        <Modal.Header>{t('admin.notif.sendNotification')}</Modal.Header>
        <Modal.Body>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form id="create-notification-form" onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.notif.title')}</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('admin.notif.enterNotificationTitle')}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.notif.message')}</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={t('admin.notif.enterNotificationMessage')}
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.notif.type')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as NotificationType })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                >
                  {notificationTypes.map((type) => (
                    <option key={type.value} value={type.value}>{typeLabel(type.value)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.notif.recipients')}</label>
                <select
                  value={formData.targetRole}
                  onChange={(e) => setFormData({ ...formData, targetRole: e.target.value as NotificationTargetRole })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                >
                  {targetRoles.map((role) => (
                    <option key={role.value} value={role.value}>{t(`admin.notif.target.${role.value}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{t('admin.notif.notePrefix')}</strong>{' '}
                {t('admin.notif.noteBody', { audience: audienceLabel(formData.targetRole) })}
              </p>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            {t('admin.notif.cancel')}
          </button>
          <button type="submit" form="create-notification-form" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <ButtonSpinner />}
            {saving ? t('admin.notif.sending') : t('admin.notif.sendNotification')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal && !!selectedNotification} onClose={closeModals} size="md">
        <Modal.Body className="text-center pt-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin.notif.deleteNotification')}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('admin.notif.areYouSureYouWantTo')}
          </p>
        </Modal.Body>
        <Modal.Footer className="justify-center">
          <button onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            {t('admin.notif.cancel')}
          </button>
          <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <ButtonSpinner />}
            {saving ? t('admin.notif.deleting') : t('admin.notif.delete')}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

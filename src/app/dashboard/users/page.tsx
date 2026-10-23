'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, UserDetail, Department } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { useLanguage } from '@/context/language-context';
import { TableSkeleton, ErrorState, NoResults, Modal } from '@/components/ui';
import { ButtonSpinner } from '@/components/ui/loading-spinner';
import { getRoleColorClasses, getActiveStatusColorClasses } from '@/lib/formatters';
import { PermissionGate } from '@/components/permission-gate';

interface UserFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
}

const initialFormData: UserFormData = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  role: 'PATIENT',
  isActive: true,
};

const ROLE_VALUES = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH', 'PATIENT'];

export default function UsersPage() {
  const { t, tEnum, formatDate } = useLanguage();
  const roleOptions = ROLE_VALUES.map((value) => ({ value, label: tEnum(value) }));
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [role, setRole] = useState('');

  const toast = useToast();
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetPasswordResult, setResetPasswordResult] = useState<{ temporaryPassword: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getUsers({
        search: debouncedSearch || undefined,
        role,
        isActive: isActiveFilter,
        page,
        limit: 10,
      });
      setUsers(response.users);
      setRoleCounts(response.roleCounts);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching users:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, role, isActiveFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const openCreateModal = () => {
    setFormData(initialFormData);
    setError('');
    setShowCreateModal(true);
  };

  // Dashboard quick actions link here with ?new=1 to open the create dialog directly
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      openCreateModal();
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEditModal = (user: UserDetail) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isActive: user.isActive,
    });
    setError('');
    setShowEditModal(true);
  };

  const openDeleteModal = (user: UserDetail) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const openResetPasswordModal = (user: UserDetail) => {
    setSelectedUser(user);
    setResetPasswordResult(null);
    setCopiedPassword(false);
    setError('');
    setShowResetPasswordModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password || !formData.firstName.trim() || !formData.lastName.trim()) {
      setError(t('admin.users.requiredCreate'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createUser({
        email: formData.email.trim(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        role: formData.role,
        isActive: formData.isActive,
      });
      setShowCreateModal(false);
      setFormData(initialFormData);
      toast.success(t('admin.users.created'), t('admin.users.createdMsg', { name: `${formData.firstName} ${formData.lastName}` }));
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.users.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !formData.firstName.trim() || !formData.lastName.trim()) {
      setError(t('admin.users.requiredNames'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      const updateData: Partial<typeof formData> = {
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        role: formData.role,
        isActive: formData.isActive,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      await api.updateUser(selectedUser.id, updateData);
      setShowEditModal(false);
      setSelectedUser(null);
      setFormData(initialFormData);
      toast.success(t('admin.users.updated'), t('admin.users.updatedMsg', { name: `${formData.firstName} ${formData.lastName}` }));
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.users.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      const userName = `${selectedUser.firstName} ${selectedUser.lastName}`;
      await api.deactivateUser(selectedUser.id);
      setShowDeleteModal(false);
      setSelectedUser(null);
      toast.success(t('admin.users.deactivated'), t('admin.users.deactivatedMsg', { name: userName }));
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.users.deactivateError'));
      toast.error(t('admin.users.deactivationFailed'), err instanceof Error ? err.message : t('admin.users.deactivateError'));
    } finally {
      setSaving(false);
    }
  };

  // Generate a random secure password
  const generateTemporaryPassword = (): string => {
    const length = 12;
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const special = '@#$%&*!';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      setError('');

      // Try to use the API endpoint first
      try {
        const result = await api.resetUserPassword(selectedUser.id);
        setResetPasswordResult(result);
      } catch {
        // Fallback: Generate password locally and update user
        const temporaryPassword = generateTemporaryPassword();
        await api.updateUser(selectedUser.id, { password: temporaryPassword });
        setResetPasswordResult({ temporaryPassword });
      }

      toast.success(t('admin.users.passwordReset'), t('admin.users.passwordResetMsg', { name: `${selectedUser.firstName} ${selectedUser.lastName}` }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.users.resetError'));
      toast.error(t('admin.users.resetFailed'), err instanceof Error ? err.message : t('admin.users.resetError'));
    } finally {
      setSaving(false);
    }
  };

  const copyPasswordToClipboard = async () => {
    if (resetPasswordResult?.temporaryPassword) {
      try {
        await navigator.clipboard.writeText(resetPasswordResult.temporaryPassword);
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowResetPasswordModal(false);
    setSelectedUser(null);
    setFormData(initialFormData);
    setError('');
    setResetPasswordResult(null);
    setCopiedPassword(false);
  };

  const totalUsers = Object.values(roleCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('users.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('users.subtitle')}</p>
        </div>
        <PermissionGate permission="users:create">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('users.new')}
          </button>
        </PermissionGate>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl p-4 border cursor-pointer transition-colors ${
            role === '' ? 'border-lime-500 ring-2 ring-lime-200 dark:ring-lime-800' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setRole('')}
        >
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('users.allUsers')}</p>
        </div>
        {roleOptions.map((opt) => (
          <div
            key={opt.value}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border cursor-pointer transition-colors ${
              role === opt.value ? 'border-lime-500 ring-2 ring-lime-200 dark:ring-lime-800' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setRole(opt.value)}
          >
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{roleCounts[opt.value] || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t(`admin.users.rolePlural.${opt.value}`)}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('users.searchPlaceholder')}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value); setPage(1); }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('users.allRoles')}</option>
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={isActiveFilter === undefined ? '' : isActiveFilter ? 'true' : 'false'}
              onChange={(e) => {
                if (e.target.value === '') setIsActiveFilter(undefined);
                else setIsActiveFilter(e.target.value === 'true');
                setPage(1);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('filter.allStatus')}</option>
              <option value="true">{t('common.active')}</option>
              <option value="false">{t('common.inactive')}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {fetchError ? (
            <ErrorState message={fetchError} onRetry={fetchUsers} />
          ) : loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : users.length === 0 ? (
            <NoResults searchTerm={search} onClear={() => setSearch('')} />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3">{t('users.user')}</th>
                  <th className="px-6 py-3">{t('users.role')}</th>
                  <th className="px-6 py-3">{t('users.department')}</th>
                  <th className="px-6 py-3">{t('users.hospitalId')}</th>
                  <th className="px-6 py-3">{t('common.status')}</th>
                  <th className="px-6 py-3">{t('users.lastLogin')}</th>
                  <th className="px-6 py-3">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          {user.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-lg font-medium text-gray-600 dark:text-gray-400">
                              {user.firstName[0]}{user.lastName[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColorClasses(user.role)}`}>
                        {tEnum(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        {user.hospitalId || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActiveStatusColorClasses(user.isActive)}`}>
                          {user.isActive ? t('common.active') : t('common.inactive')}
                        </span>
                        {user.isEmailVerified && (
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : t('users.never')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <PermissionGate permission="users:edit">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                            title={t('admin.users.editUser')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </PermissionGate>
                        <PermissionGate permission="users:edit">
                          <button
                            onClick={() => openResetPasswordModal(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                            title={t('admin.users.resetPassword')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                          </button>
                        </PermissionGate>
                        <PermissionGate permission="users:delete">
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                            title={t('admin.users.deactivateUser')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
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
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              {t('common.previous')}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('users.pageOf', { page, totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={closeModals} size="lg">
        <Modal.Header>{t('users.createUser')}</Modal.Header>
        <Modal.Body>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form id="create-user-form" onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.firstName')}</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.lastName')}</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.password')}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.phoneNumberRequired')}</label>
              <input
                type="tel"
                required
                minLength={10}
                placeholder="+237 6XX XX XX XX"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.role')}</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-lime-600 rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">{t('admin.users.active')}</label>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" form="create-user-form" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <ButtonSpinner />}
            {saving ? t('form.creating') : t('users.createUser')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal && !!selectedUser} onClose={closeModals} size="lg">
        <Modal.Header>{t('users.editUser')}</Modal.Header>
        <Modal.Body>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form id="edit-user-form" onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.firstName')}</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.lastName')}</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.newPasswordLeaveEmptyToKeep')}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.phoneNumber')}</label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.users.role')}</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-lime-600 rounded"
              />
              <label htmlFor="editIsActive" className="text-sm text-gray-700 dark:text-gray-300">{t('admin.users.active')}</label>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" form="edit-user-form" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <ButtonSpinner />}
            {saving ? t('form.saving') : t('form.saveChanges')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Deactivate Modal */}
      <Modal isOpen={showDeleteModal && !!selectedUser} onClose={closeModals} size="md">
        <Modal.Body className="text-center pt-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('users.deactivate')}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('users.deactivateConfirm', { name: `${selectedUser?.firstName} ${selectedUser?.lastName}` })}
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="justify-center">
          <button onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving && <ButtonSpinner />}
            {saving ? t('users.deactivating') : t('users.deactivate')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={showResetPasswordModal && !!selectedUser} onClose={closeModals} size="md">
        <Modal.Header>{t('admin.users.resetPassword')}</Modal.Header>
        <Modal.Body>
          {!resetPasswordResult ? (
            <>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('admin.users.resetConfirm', { name: `${selectedUser?.firstName ?? ''} ${selectedUser?.lastName ?? ''}`.trim() })}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  {t('admin.users.aNewTemporaryPasswordWillBe')}
                </p>
              </div>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin.users.passwordResetSuccessfully')}</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('admin.users.resetDone', { name: `${selectedUser?.firstName ?? ''} ${selectedUser?.lastName ?? ''}`.trim() })}
                </p>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t('admin.users.pleaseShareThisPasswordSecurelyWith')}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.users.temporaryPassword')}</p>
                    <p className="text-xl font-mono font-bold text-gray-900 dark:text-white">
                      {resetPasswordResult.temporaryPassword}
                    </p>
                  </div>
                  <button
                    onClick={copyPasswordToClipboard}
                    className="p-2 text-gray-500 hover:text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/30 rounded-lg transition-colors"
                    title={t('admin.users.copyPassword')}
                  >
                    {copiedPassword ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="justify-center">
          {!resetPasswordResult ? (
            <>
              <button onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleResetPassword} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                {saving && <ButtonSpinner />}
                {saving ? t('admin.users.resetting') : t('admin.users.resetPassword')}
              </button>
            </>
          ) : (
            <button onClick={closeModals} className="px-6 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors">
              {t('admin.users.done')}
            </button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

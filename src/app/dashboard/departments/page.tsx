'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Department } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { useLanguage } from '@/context/language-context';
import { CardSkeleton, ErrorState, NoData, SimplePagination, Modal } from '@/components/ui';
import { ButtonSpinner } from '@/components/ui/loading-spinner';
import { getActiveStatusColorClasses } from '@/lib/formatters';
import { PermissionGate } from '@/components/permission-gate';

interface DepartmentFormData {
  name: string;
  description: string;
  isActive: boolean;
}

const initialFormData: DepartmentFormData = {
  name: '',
  description: '',
  isActive: true,
};

export default function DepartmentsPage() {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);

  const toast = useToast();
  const [totalPages, setTotalPages] = useState(1);
  const [showInactive, setShowInactive] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState<DepartmentFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getDepartments({
        search: debouncedSearch || undefined,
        isActive: showInactive ? undefined : true,
        page,
        limit: 10,
      });
      setDepartments(response.departments);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setFetchError(error instanceof Error ? error.message : t('clinical.departments.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, showInactive]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const openCreateModal = () => {
    setFormData(initialFormData);
    setError('');
    setShowCreateModal(true);
  };

  const openEditModal = (dept: Department, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedDepartment(dept);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      isActive: dept.isActive,
    });
    setError('');
    setShowEditModal(true);
  };

  const openDeleteModal = (dept: Department, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedDepartment(dept);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError(t('clinical.departments.nameRequired'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createDepartment({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
      });
      setShowCreateModal(false);
      setFormData(initialFormData);
      toast.success(t('clinical.departments.created'), t('clinical.departments.createdMessage', { name: formData.name }));
      fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.departments.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepartment || !formData.name.trim()) {
      setError(t('clinical.departments.nameRequired'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.updateDepartment(selectedDepartment.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
      });
      setShowEditModal(false);
      setSelectedDepartment(null);
      setFormData(initialFormData);
      toast.success(t('clinical.departments.updated'), t('clinical.departments.updatedMessage', { name: formData.name }));
      fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.departments.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDepartment) return;

    try {
      setSaving(true);
      const deptName = selectedDepartment.name;
      await api.deleteDepartment(selectedDepartment.id);
      setShowDeleteModal(false);
      setSelectedDepartment(null);
      toast.success(t('clinical.departments.deleted'), t('clinical.departments.deletedMessage', { name: deptName }));
      fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.departments.deleteFailed'));
      toast.error(t('clinical.doctors.deleteFailed'), err instanceof Error ? err.message : t('clinical.departments.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedDepartment(null);
    setFormData(initialFormData);
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('departments.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('departments.subtitle')}</p>
        </div>
        <PermissionGate permission="departments:create">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('departments.new')}
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filter.searchDepartments')}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 text-lime-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('filter.showInactive')}</span>
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {t('common.search')}
          </button>
        </form>
      </div>

      {/* Departments Grid */}
      {fetchError ? (
        <ErrorState message={fetchError} onRetry={fetchDepartments} />
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <NoData
          title={t('empty.noDepartments')}
          description={t('departments.getStarted')}
          actionLabel={t('departments.new')}
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-lime-100 dark:bg-lime-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-lime-600 dark:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{dept.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActiveStatusColorClasses(dept.isActive)}`}>
                      {dept.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  <PermissionGate permission="departments:edit">
                    <button
                      onClick={(e) => openEditModal(dept, e)}
                      className="p-2 text-gray-500 hover:text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                      title={t('clinical.departments.editTitle')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </PermissionGate>
                  <PermissionGate permission="departments:delete">
                    <button
                      onClick={(e) => openDeleteModal(dept, e)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                      title={t('clinical.departments.deleteTitle')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </PermissionGate>
                </div>
              </div>

              {dept.description && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {dept.description}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{dept.doctorCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('departments.doctorCount')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{dept.nurseCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('departments.nurseCount')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{dept.staffCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('departments.staffCount')}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <SimplePagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={closeModals} size="lg">
        <Modal.Header>{t('departments.create')}</Modal.Header>
        <Modal.Body>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form id="create-department-form" onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('departments.name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                placeholder={t('departments.placeholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('departments.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                placeholder={t('departments.descPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-lime-600 rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                {t('common.active')}
              </label>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={closeModals}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="create-department-form"
            disabled={saving}
            className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving && <ButtonSpinner />}
            {saving ? t('form.creating') : t('departments.create')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal && !!selectedDepartment} onClose={closeModals} size="lg">
        <Modal.Header>{t('departments.edit')}</Modal.Header>
        <Modal.Body>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form id="edit-department-form" onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('departments.name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                placeholder={t('departments.placeholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('departments.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                placeholder={t('departments.descPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-lime-600 rounded"
              />
              <label htmlFor="editIsActive" className="text-sm text-gray-700 dark:text-gray-300">
                {t('common.active')}
              </label>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={closeModals}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="edit-department-form"
            disabled={saving}
            className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving && <ButtonSpinner />}
            {saving ? t('form.saving') : t('form.saveChanges')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal && !!selectedDepartment} onClose={closeModals} size="md">
        <Modal.Body className="text-center pt-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('departments.delete')}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('departments.deleteConfirm', { name: selectedDepartment?.name || '' })}
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="justify-center">
          <button
            onClick={closeModals}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving && <ButtonSpinner />}
            {saving ? t('form.deleting') : t('common.delete')}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

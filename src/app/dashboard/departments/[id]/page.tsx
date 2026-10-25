'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api, DepartmentDetail } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useLanguage } from '@/context/language-context';

export default function DepartmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useLanguage();
  const [department, setDepartment] = useState<DepartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'doctors' | 'nurses' | 'staff'>('doctors');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '', isActive: true });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const toast = useToast();

  const fetchDepartment = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDepartment(params.id as string);
      setDepartment(data);
      setEditData({ name: data.name, description: data.description || '', isActive: data.isActive });
    } catch (err) {
      setError(t('clinical.departments.loadFailed'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchDepartment();
  }, [fetchDepartment]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateDepartment(params.id as string, editData);
      toast.success(t('clinical.departments.updated'), t('clinical.departments.updatedMessage', { name: editData.name }));
      await fetchDepartment();
      setIsEditing(false);
    } catch (err) {
      toast.error(t('clinical.departments.updateFailedTitle'), err instanceof Error ? err.message : t('clinical.departments.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const name = department?.name || 'Department';
      await api.deleteDepartment(params.id as string);
      toast.success(t('clinical.departments.deleted'), t('clinical.departments.deletedMessage', { name }));
      router.push('/dashboard/departments');
    } catch (err) {
      toast.error(t('clinical.doctors.deleteFailed'), err instanceof Error ? err.message : t('clinical.departments.deleteFailed'));
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-red-600 mb-4">{error || t('clinical.departments.notFound')}</p>
        <Link href="/dashboard/departments" className="px-4 py-2 bg-lime-600 text-white rounded-lg">
          {t('clinical.departments.backToDepartments')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/departments"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{department.name}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                department.isActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {department.isActive ? t('clinical.departments.badgeActive') : t('clinical.departments.badgeInactive')}
              </span>
            </div>
            {department.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">{department.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('clinical.departments.edit')}
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            {t('clinical.common.delete')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-lime-600">{department.stats.totalDoctors}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.departments.totalDoctors')}</p>
          <p className="text-xs text-green-600">{t('clinical.departments.nAvailable', { count: department.stats.activeDoctors })}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-blue-600">{department.stats.totalNurses}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.departments.totalNurses')}</p>
          <p className="text-xs text-green-600">{t('clinical.departments.nActive', { count: department.stats.activeNurses })}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-purple-600">{department.stats.totalStaff}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.departments.otherStaff')}</p>
          <p className="text-xs text-green-600">{t('clinical.departments.nActive', { count: department.stats.activeStaff })}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{department.stats.totalDoctors + department.stats.totalNurses + department.stats.totalStaff}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.departments.totalMembers')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            {(['doctors', 'nurses', 'staff'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-lime-600 text-lime-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {t(`clinical.departments.tab.${tab}`)} ({tab === 'doctors' ? department.doctors.length : tab === 'nurses' ? department.nurses.length : department.staff.length})
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'doctors' && (
            <div className="space-y-4">
              {department.doctors.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('clinical.departments.noDoctorsInThisDepartment')}</p>
              ) : (
                department.doctors.map((doctor) => (
                  <Link
                    key={doctor.id}
                    href={`/dashboard/doctors/${doctor.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Dr. {doctor.firstName} {doctor.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{doctor.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doctor.specializations.slice(0, 3).map((spec) => (
                          <span key={spec} className="px-2 py-0.5 bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300 rounded text-xs">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      doctor.isAvailable
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {doctor.isAvailable ? t('clinical.departments.badgeAvailable') : t('clinical.departments.badgeUnavailable')}
                    </span>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'nurses' && (
            <div className="space-y-4">
              {department.nurses.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('clinical.departments.noNursesInThisDepartment')}</p>
              ) : (
                department.nurses.map((nurse) => (
                  <div
                    key={nurse.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {nurse.firstName} {nurse.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{nurse.email}</p>
                      {nurse.specialization && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
                          {nurse.specialization}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{nurse.nurseId}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-4">
              {department.staff.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('clinical.departments.noOtherStaffInThisDepartment')}</p>
              ) : (
                department.staff.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {s.firstName} {s.lastName}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs">
                        {s.position}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{s.staffId}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('clinical.departments.editDepartment')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clinical.departments.name')}</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clinical.departments.description')}</label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editData.isActive}
                  onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                  className="w-4 h-4 text-lime-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('enum.ACTIVE')}</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('clinical.common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50"
              >
                {isSaving ? t('clinical.common.saving') : t('clinical.common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('clinical.departments.deleteDepartment')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('clinical.departments.deleteConfirm', { name: department.name })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('clinical.common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('clinical.common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

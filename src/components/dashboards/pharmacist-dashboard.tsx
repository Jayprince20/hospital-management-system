'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { api, Medication, Prescription } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui';
import { useLanguage } from '@/context/language-context';

interface PendingPrescription {
  id: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  medications: { name: string; dosage: string; quantity: number }[];
  status: string;
  createdAt: string;
}

interface LowStockMedication {
  id: string;
  name: string;
  stockQuantity: number;
  reorderLevel: number;
  category: string;
}

interface PharmacistStats {
  pendingPrescriptions: number;
  dispensedToday: number;
  lowStockItems: number;
  totalMedications: number;
}

export function PharmacistDashboard() {
  useAuth();
  const { t, formatDate, language } = useLanguage();
  const plural = (key: string, count: number) =>
    t(`${key}_${count === 1 || (language === 'fr' && count === 0) ? 'one' : 'other'}`, { count });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PharmacistStats>({
    pendingPrescriptions: 0,
    dispensedToday: 0,
    lowStockItems: 0,
    totalMedications: 0,
  });
  const [pendingPrescriptions, setPendingPrescriptions] = useState<PendingPrescription[]>([]);
  const [lowStockMedications, setLowStockMedications] = useState<LowStockMedication[]>([]);

  const fetchPharmacistData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch pending prescriptions
      try {
        const rxRes = await api.getPrescriptions({ status: 'ACTIVE', limit: 10 });
        // The list endpoint returns flattened names (patientName, doctorName, items[].medication)
        setPendingPrescriptions((rxRes.prescriptions || []).map((rx: Prescription) => ({
          id: rx.id,
          patientName: rx.patientName || '',
          patientId: rx.patientHospitalId || '',
          doctorName: rx.doctorName || '',
          medications: (rx.items || []).map((item) => ({
            name: item.medication,
            dosage: item.dosage,
            quantity: item.quantity,
          })),
          status: rx.status,
          createdAt: rx.createdAt,
        })));

        setStats(prev => ({
          ...prev,
          pendingPrescriptions: (rxRes.statusCounts?.ACTIVE || 0) + (rxRes.statusCounts?.PARTIALLY_DISPENSED || 0),
          dispensedToday: rxRes.statusCounts?.DISPENSED || 0,
        }));
      } catch {
        setPendingPrescriptions([]);
      }

      // Fetch low stock medications
      try {
        const medsRes = await api.getMedications({ lowStock: true, limit: 10 });
        setLowStockMedications((medsRes.medications || []).map((med: Medication) => ({
          id: med.id,
          name: med.name,
          stockQuantity: med.stockQuantity,
          reorderLevel: med.reorderLevel,
          category: med.category,
        })));

        setStats(prev => ({
          ...prev,
          lowStockItems: medsRes.stats?.lowStockCount || medsRes.medications?.length || 0,
          totalMedications: medsRes.stats?.totalMedications || 0,
        }));
      } catch {
        setLowStockMedications([]);
      }

    } catch (err) {
      setError(t('ph.dash.loadFailed'));
      console.error('Pharmacist dashboard error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPharmacistData();
    const interval = setInterval(fetchPharmacistData, 60000);
    return () => clearInterval(interval);
  }, [fetchPharmacistData]);

  if (loading) {
    return <LoadingState label={t('ph.dash.loading')} minHeight="h-96" />;
  }

  if (error) {
    return <ErrorState title={t('ph.common.error')} message={error} onRetry={fetchPharmacistData} />;
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('ph.dash.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {plural('ph.dash.waiting', stats.pendingPrescriptions)}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingPrescriptions}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.pendingRx')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.dispensedToday}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.dispensedTotal')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.lowStockItems}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.lowStockAlerts')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalMedications}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.totalMedications')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Prescriptions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ph.dash.pendingRx')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.awaiting')}</p>
            </div>
            <Link href="/dashboard/prescriptions" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
              {t('ph.common.viewAll')}
            </Link>
          </div>

          {pendingPrescriptions.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">{t('ph.dash.noPending')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {pendingPrescriptions.map((rx) => (
                <div key={rx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {rx.patientName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{rx.patientName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{[rx.patientId, rx.doctorName].filter(Boolean).join(' • ')}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rx.medications.slice(0, 3).map((med, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">
                            {med.name} x{med.quantity}
                          </span>
                        ))}
                        {rx.medications.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">
                            {t('ph.common.more', { count: rx.medications.length - 3 })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(rx.createdAt)}</span>
                      <Link
                        href={`/dashboard/prescriptions/${rx.id}`}
                        className="px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        {t('ph.rx.dispense')}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ph.dash.lowStockAlerts')}</h2>
            <Link href="/dashboard/pharmacy" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
              {t('ph.common.viewAll')}
            </Link>
          </div>

          {lowStockMedications.length === 0 ? (
            <div className="p-6 text-center">
              <svg className="w-12 h-12 mx-auto text-green-300 dark:text-green-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">{t('ph.dash.wellStocked')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {lowStockMedications.map((med) => (
                <div key={med.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{med.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{med.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">{med.stockQuantity}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('ph.dash.reorder', { level: med.reorderLevel })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/prescriptions?status=ACTIVE"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-lime-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{t('ph.dash.dispenseMeds')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.processPending')}</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-lime-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{t('ph.dash.manageInventory')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.updateStockLevels')}</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/prescriptions"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-lime-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{t('ph.dash.viewAllRx')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.dash.searchHistory')}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

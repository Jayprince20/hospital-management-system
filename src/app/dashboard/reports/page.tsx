'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ReportData } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { toLocalDateString } from '@/lib/formatters';

// Matches the file names the export endpoint uses for French documents
const FRENCH_REPORT_FILE_NAMES: Record<string, string> = {
  overview: 'general',
  financial: 'financier',
  appointments: 'rendez-vous',
  pharmacy: 'pharmacie',
  laboratory: 'laboratoire',
};

type ReportType = 'overview' | 'financial' | 'appointments' | 'pharmacy' | 'laboratory';

export default function ReportsPage() {
  const { t, tEnum, formatCurrency, formatDate, language } = useLanguage();
  const [activeReport, setActiveReport] = useState<ReportType>('overview');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        type: activeReport,
        format,
        lang: language,
      });
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reports/export?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        language === 'fr'
          ? `rapport-${FRENCH_REPORT_FILE_NAMES[activeReport] || activeReport}-${toLocalDateString()}.${format}`
          : `${activeReport}-report-${toLocalDateString()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert(t('admin.reports.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getReports(activeReport, {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [activeReport, dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const reportTabs: { id: ReportType; label: string; icon: string }[] = [
    { id: 'overview', label: t('admin.reports.tab.overview'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'financial', label: t('admin.reports.tab.financial'), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'appointments', label: t('admin.reports.tab.appointments'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'pharmacy', label: t('admin.reports.tab.pharmacy'), icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { id: 'laboratory', label: t('admin.reports.tab.laboratory'), icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ];

  // Pick the singular or plural form of a counted label
  const plural = (count: number, key: string) =>
    t(`admin.reports.${key}${count === 1 ? 'One' : 'Other'}`, { count });

  const renderOverviewReport = () => {
    if (!reportData) return null;
    const data = reportData as unknown as {
      patients: { total: number };
      doctors: { total: number };
      appointments: { total: number; breakdown: Record<string, number> };
      revenue: { totalBilled: number; totalCollected: number; outstanding: number };
      recentAppointments: Array<{ id: string; patientName: string; doctorName: string; date: string; status: string }>;
      topDoctors: Array<{ id: string; name: string; department: string; completedAppointments: number }>;
      departments: Array<{ id: string; name: string; doctors: number; nurses: number; total: number }>;
    };

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <p className="text-3xl font-bold text-lime-600">{data.patients?.total || 0}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.reports.totalPatients')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <p className="text-3xl font-bold text-blue-600">{data.doctors?.total || 0}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.reports.activeDoctors')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <p className="text-3xl font-bold text-green-600">{data.appointments?.total || 0}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.reports.appointments')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(data.revenue?.totalCollected || 0)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.reports.revenueCollected')}</p>
          </div>
        </div>

        {/* Top Doctors & Departments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.topPerformingDoctors')}</h3>
            <div className="space-y-4">
              {(data.topDoctors || []).map((doctor, index) => (
                <div key={doctor.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-lime-100 dark:bg-lime-900/50 rounded-full flex items-center justify-center text-lime-600 dark:text-lime-400 font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{doctor.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{doctor.department}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {plural(doctor.completedAppointments, 'appointments')}
                  </span>
                </div>
              ))}
              {(!data.topDoctors || data.topDoctors.length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('admin.reports.noDataAvailable')}</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.departmentOverview')}</h3>
            <div className="space-y-4">
              {(data.departments || []).slice(0, 5).map((dept) => (
                <div key={dept.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{dept.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {plural(dept.doctors, 'doctors')}, {plural(dept.nurses, 'nurses')}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{dept.total}</span>
                </div>
              ))}
              {(!data.departments || data.departments.length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('admin.reports.noDataAvailable')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFinancialReport = () => {
    if (!reportData) return null;
    const data = reportData as unknown as {
      invoicesByStatus: Array<{ status: string; count: number; total: number }>;
      paymentsByMethod: Array<{ method: string; count: number; total: number }>;
      topPatients: Array<{ id: string; name: string; totalBilled: number; totalPaid: number }>;
    };

    return (
      <div className="space-y-6">
        {/* Invoice Status Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.invoicesByStatus')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(data.invoicesByStatus || []).map((item) => (
              <div key={item.status} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.count}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{tEnum(item.status)}</p>
                <p className="text-sm font-medium text-lime-600">{formatCurrency(item.total)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.paymentsByMethod')}</h3>
          <div className="space-y-4">
            {(data.paymentsByMethod || []).map((item) => (
              <div key={item.method} className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">{tEnum(item.method)}</span>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.total)}</p>
                  <p className="text-sm text-gray-500">{plural(item.count, 'transactions')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAppointmentsReport = () => {
    if (!reportData) return null;
    const data = reportData as unknown as {
      byStatus: Array<{ status: string; count: number }>;
      byType: Array<{ type: string; count: number }>;
      byDepartment: Array<{ department: string; count: number }>;
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.byStatus')}</h3>
            <div className="space-y-3">
              {(data.byStatus || []).map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{tEnum(item.status)}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.byType')}</h3>
            <div className="space-y-3">
              {(data.byType || []).map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{tEnum(item.type)}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.byDepartment')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(data.byDepartment || []).map((item) => (
              <div key={item.department} className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-lime-600">{item.count}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.department}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPharmacyReport = () => {
    if (!reportData) return null;
    const data = reportData as unknown as {
      lowStockMedications: Array<{ id: string; name: string; stockQuantity: number; reorderLevel: number }>;
      expiringMedications: Array<{ id: string; name: string; expiryDate: string }>;
      topPrescribedMedications: Array<{ name: string; count: number; quantity: number }>;
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-red-600 mb-4">{t('admin.reports.lowStockAlert')}</h3>
            <div className="space-y-3">
              {(data.lowStockMedications || []).slice(0, 5).map((med) => (
                <div key={med.id} className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-white">{med.name}</span>
                  <span className="text-red-600 font-medium">{med.stockQuantity} / {med.reorderLevel}</span>
                </div>
              ))}
              {(!data.lowStockMedications || data.lowStockMedications.length === 0) && (
                <p className="text-green-600 text-center py-4">{t('admin.reports.noLowStockItems')}</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-orange-600 mb-4">{t('admin.reports.expiringSoon')}</h3>
            <div className="space-y-3">
              {(data.expiringMedications || []).slice(0, 5).map((med) => (
                <div key={med.id} className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-white">{med.name}</span>
                  <span className="text-orange-600">{formatDate(med.expiryDate)}</span>
                </div>
              ))}
              {(!data.expiringMedications || data.expiringMedications.length === 0) && (
                <p className="text-green-600 text-center py-4">{t('admin.reports.noMedicationsExpiringSoon')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.topPrescribedMedications')}</h3>
          <div className="space-y-3">
            {(data.topPrescribedMedications || []).map((med, index) => (
              <div key={med.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-lime-100 dark:bg-lime-900/50 rounded-full flex items-center justify-center text-lime-600 font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-900 dark:text-white">{med.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">{plural(med.count, 'prescriptions')}</p>
                  <p className="text-sm text-gray-500">{plural(med.quantity, 'units')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderLaboratoryReport = () => {
    if (!reportData) return null;
    const data = reportData as unknown as {
      ordersByStatus: Array<{ status: string; count: number }>;
      ordersByPriority: Array<{ priority: string; count: number }>;
      topOrderedTests: Array<{ name: string; count: number }>;
      pendingOrders: Array<{ id: string; patientName: string; status: string; testCount: number }>;
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.ordersByStatus')}</h3>
            <div className="space-y-3">
              {(data.ordersByStatus || []).map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{tEnum(item.status)}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.ordersByPriority')}</h3>
            <div className="space-y-3">
              {(data.ordersByPriority || []).map((item) => (
                <div key={item.priority} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{tEnum(item.priority)}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reports.mostOrderedTests')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(data.topOrderedTests || []).map((test) => (
              <div key={test.name} className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-lime-600">{test.count}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{test.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.reports.reportsAnalytics')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('admin.reports.viewInsightsAndAnalyticsAcrossThe')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="flex flex-wrap items-end gap-3">
            <legend className="sr-only">{t('admin.reports.dateRange')}</legend>
            <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
              {t('admin.reports.from')}
              <input
                type="date"
                value={dateRange.startDate}
                max={dateRange.endDate || undefined}
                onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                className="mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>
            <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
              {t('admin.reports.to')}
              <input
                type="date"
                value={dateRange.endDate}
                min={dateRange.startDate || undefined}
                onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                className="mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>
            {(dateRange.startDate || dateRange.endDate) && (
              <button
                type="button"
                onClick={() => setDateRange({ startDate: '', endDate: '' })}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {t('admin.reports.clearDates')}
              </button>
            )}
          </fieldset>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? t('admin.reports.exporting') : 'PDF'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              {exporting ? t('admin.reports.exporting') : 'CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-2">
        {reportTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeReport === tab.id
                ? 'bg-lime-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
        </div>
      ) : (
        <>
          {activeReport === 'overview' && renderOverviewReport()}
          {activeReport === 'financial' && renderFinancialReport()}
          {activeReport === 'appointments' && renderAppointmentsReport()}
          {activeReport === 'pharmacy' && renderPharmacyReport()}
          {activeReport === 'laboratory' && renderLaboratoryReport()}
        </>
      )}
    </div>
  );
}

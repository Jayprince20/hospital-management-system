'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api, Medication, Prescription } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { PermissionGate } from '@/components/permission-gate';
import { useLanguage } from '@/context/language-context';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { toLocalDateString } from '@/lib/formatters';

interface MedicationFormData {
  name: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;
  unitPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  expiryDate: string;
  isActive: boolean;
  requiresRx: boolean;
  contraindications: string;
  sideEffects: string;
}

const initialFormData: MedicationFormData = {
  name: '',
  genericName: '',
  category: '',
  dosageForm: '',
  strength: '',
  manufacturer: '',
  unitPrice: 0,
  stockQuantity: 0,
  reorderLevel: 10,
  expiryDate: '',
  isActive: true,
  requiresRx: true,
  contraindications: '',
  sideEffects: '',
};

const dosageForms = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Patch', 'Suppository'];

// Same window the API uses for its "expiring soon" count
const EXPIRY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

type ExpiryState = 'expired' | 'expiring' | 'ok';

const getExpiryState = (med: Medication): ExpiryState => {
  if (!med.expiryDate) return 'ok';
  const expiry = new Date(med.expiryDate).getTime();
  const now = Date.now();
  if (expiry < now) return 'expired';
  if (expiry <= now + EXPIRY_WINDOW_MS) return 'expiring';
  return 'ok';
};

const isLowStock = (med: Medication) => med.stockQuantity <= med.reorderLevel;

// Aggregates the API computes over every active medication (not just the table page)
interface MedicationChartStats {
  byCategory?: Record<string, number>;
  stockStatus?: { normal: number; lowStock: number; expiringSoon: number; expired: number };
  topByStock?: { name: string; stock: number; reorderLevel: number }[];
}

const CHART_COLORS = ['#84cc16', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6'];
const PRESCRIPTION_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#3b82f6',
  DISPENSED: '#22c55e',
  PARTIALLY_DISPENSED: '#f59e0b',
  CANCELLED: '#ef4444',
  EXPIRED: '#6b7280',
};

export default function PharmacyPage() {
  const { t, tEnum, formatDate, formatCurrency, formatNumber } = useLanguage();
  const dosageFormLabel = (form?: string) => {
    if (!form) return '';
    const key = `ph.form.${form}`;
    const label = t(key);
    return label === key ? form : label;
  };
  const rxStatus = (status: string) => {
    const key = `ph.rxStatus.${status}`;
    const label = t(key);
    return label === key ? tEnum(status) : label;
  };
  const [activeTab, setActiveTab] = useState<'medications' | 'prescriptions'>('medications');
  const [medications, setMedications] = useState<Medication[]>([]);
  // Charts use server-side aggregates over every active medication, not just the visible table page
  const [chartStats, setChartStats] = useState<MedicationChartStats>({});
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState('');

  const toast = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalMedications: 0, totalStock: 0, lowStockCount: 0, expiringCount: 0 });
  const [prescriptionStats, setPrescriptionStats] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showLowStock, setShowLowStock] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [formData, setFormData] = useState<MedicationFormData>(initialFormData);
  const [stockAdjustment, setStockAdjustment] = useState({ quantity: 0, reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Chart data computations
  const categoryData = useMemo(
    () => Object.entries(chartStats.byCategory || {}).map(([name, value]) => ({ name: name || t('ph.pharmacy.uncategorized'), value })),
    [chartStats, t]
  );

  // Each medication lands in exactly one slice: expired > expiring soon > low stock > normal.
  // "Expiring soon" therefore matches the stat card (which excludes already-expired stock).
  const stockStatusData = useMemo(() => {
    const counts = chartStats.stockStatus || { normal: 0, lowStock: 0, expiringSoon: 0, expired: 0 };
    return [
      { name: t('ph.pharmacy.normal'), value: counts.normal, color: '#22c55e' },
      { name: tEnum('LOW_STOCK'), value: counts.lowStock, color: '#f59e0b' },
      { name: tEnum('EXPIRING_SOON'), value: counts.expiringSoon, color: '#ef4444' },
      { name: t('ph.common.expired'), value: counts.expired, color: '#6b7280' },
    ].filter((d) => d.value > 0);
  }, [chartStats, t, tEnum]);

  const prescriptionStatusData = useMemo(() => {
    return Object.entries(prescriptionStats).map(([status, count]) => ({
      name: rxStatus(status),
      value: count,
      color: PRESCRIPTION_STATUS_COLORS[status] || '#6b7280',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescriptionStats, t]);

  const topMedicationsByStock = useMemo(
    () =>
      (chartStats.topByStock || []).slice(0, 8).map((med) => ({
        name: med.name.length > 15 ? med.name.slice(0, 15) + '...' : med.name,
        stock: med.stock,
        reorderLevel: med.reorderLevel,
      })),
    [chartStats]
  );

  const fetchPrescriptionStats = useCallback(async () => {
    try {
      const response = await api.getPrescriptions({ page: 1, limit: 1 });
      setPrescriptionStats(response.statusCounts);
    } catch (error) {
      console.error('Error fetching prescription stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptionStats();
  }, [fetchPrescriptionStats]);

  const fetchMedications = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getMedications({
        search: debouncedSearch || undefined,
        category,
        lowStock: showLowStock,
        page,
        limit: 10,
      });
      setMedications(response.medications);
      setCategories(response.categories);
      setStats(response.stats);
      setChartStats(response.stats as typeof response.stats & MedicationChartStats);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching medications:', error);
      setFetchError(error instanceof Error ? error.message : t('ph.pharmacy.loadFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, showLowStock, page]);

  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getPrescriptions({ search: debouncedSearch || undefined, page, limit: 10 });
      setPrescriptions(response.prescriptions);
      setPrescriptionStats(response.statusCounts);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      setFetchError(error instanceof Error ? error.message : t('ph.pharmacy.loadRxFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page]);

  useEffect(() => {
    if (activeTab === 'medications') {
      fetchMedications();
    } else {
      fetchPrescriptions();
    }
  }, [activeTab, fetchMedications, fetchPrescriptions]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      case 'DISPENSED': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'PARTIALLY_DISPENSED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'EXPIRED': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const refreshMedications = () => {
    fetchMedications();
  };

  const openCreateModal = () => {
    setFormData(initialFormData);
    setError('');
    setShowCreateModal(true);
  };

  const openEditModal = (med: Medication) => {
    setSelectedMedication(med);
    setFormData({
      name: med.name,
      genericName: med.genericName,
      category: med.category,
      dosageForm: med.dosageForm,
      strength: med.strength,
      manufacturer: med.manufacturer,
      unitPrice: med.unitPrice,
      stockQuantity: med.stockQuantity,
      reorderLevel: med.reorderLevel,
      expiryDate: med.expiryDate ? toLocalDateString(med.expiryDate) : '',
      isActive: med.isActive,
      requiresRx: med.requiresRx,
      contraindications: med.contraindications?.join(', ') || '',
      sideEffects: med.sideEffects?.join(', ') || '',
    });
    setError('');
    setShowEditModal(true);
  };

  const openDeleteModal = (med: Medication) => {
    setSelectedMedication(med);
    setShowDeleteModal(true);
  };

  const openStockModal = (med: Medication) => {
    setSelectedMedication(med);
    setStockAdjustment({ quantity: 0, reason: '' });
    setError('');
    setShowStockModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.genericName.trim()) {
      setError(t('ph.pharmacy.nameGenericRequired'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createMedication({
        name: formData.name.trim(),
        genericName: formData.genericName.trim(),
        category: formData.category.trim(),
        dosageForm: formData.dosageForm,
        strength: formData.strength.trim(),
        manufacturer: formData.manufacturer.trim(),
        unitPrice: formData.unitPrice,
        stockQuantity: formData.stockQuantity,
        reorderLevel: formData.reorderLevel,
        expiryDate: formData.expiryDate || undefined,
        isActive: formData.isActive,
        requiresRx: formData.requiresRx,
        contraindications: formData.contraindications ? formData.contraindications.split(',').map(s => s.trim()).filter(Boolean) : [],
        sideEffects: formData.sideEffects ? formData.sideEffects.split(',').map(s => s.trim()).filter(Boolean) : [],
      });
      setShowCreateModal(false);
      setFormData(initialFormData);
      toast.success(t('ph.pharmacy.created'), t('ph.pharmacy.createdDesc', { name: formData.name }));
      refreshMedications();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ph.common.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedication || !formData.name.trim()) {
      setError(t('ph.common.nameRequired'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.updateMedication(selectedMedication.id, {
        name: formData.name.trim(),
        genericName: formData.genericName.trim(),
        category: formData.category.trim(),
        dosageForm: formData.dosageForm,
        strength: formData.strength.trim(),
        manufacturer: formData.manufacturer.trim(),
        unitPrice: formData.unitPrice,
        stockQuantity: formData.stockQuantity,
        reorderLevel: formData.reorderLevel,
        expiryDate: formData.expiryDate || undefined,
        isActive: formData.isActive,
        requiresRx: formData.requiresRx,
        contraindications: formData.contraindications ? formData.contraindications.split(',').map(s => s.trim()).filter(Boolean) : [],
        sideEffects: formData.sideEffects ? formData.sideEffects.split(',').map(s => s.trim()).filter(Boolean) : [],
      });
      setShowEditModal(false);
      setSelectedMedication(null);
      setFormData(initialFormData);
      toast.success(t('ph.pharmacy.updated'), t('ph.pharmacy.updatedDesc', { name: formData.name }));
      refreshMedications();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ph.common.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMedication) return;

    try {
      setSaving(true);
      const medName = selectedMedication.name;
      await api.deleteMedication(selectedMedication.id);
      setShowDeleteModal(false);
      setSelectedMedication(null);
      toast.success(t('ph.pharmacy.deleted'), t('ph.pharmacy.deletedDesc', { name: medName }));
      refreshMedications();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ph.common.genericError'));
      toast.error(t('ph.common.deleteFailed'), err instanceof Error ? err.message : t('ph.common.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedication) return;

    try {
      setSaving(true);
      setError('');
      const newQuantity = selectedMedication.stockQuantity + stockAdjustment.quantity;
      if (newQuantity < 0) {
        setError(t('ph.common.stockCannotBeNegative'));
        setSaving(false);
        return;
      }
      await api.updateMedication(selectedMedication.id, {
        stockQuantity: newQuantity,
      });
      setShowStockModal(false);
      setSelectedMedication(null);
      setStockAdjustment({ quantity: 0, reason: '' });
      toast.success(
        t('ph.common.stockUpdated'),
        t('ph.common.stockAdjusted', {
          name: selectedMedication.name,
          delta: `${stockAdjustment.quantity > 0 ? '+' : ''}${stockAdjustment.quantity}`,
        })
      );
      refreshMedications();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ph.common.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowStockModal(false);
    setSelectedMedication(null);
    setFormData(initialFormData);
    setStockAdjustment({ quantity: 0, reason: '' });
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ph.pharmacy.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ph.pharmacy.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/pharmacy/pos" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            {t('nav.pharmacyPos')}
          </Link>
          <Link href="/dashboard/pharmacy/stock" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            {t('nav.pharmacyStock')}
          </Link>
          <PermissionGate permission="pharmacy:edit_medications">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('ph.pharmacy.addMedication')}
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-lime-600">{stats.totalMedications}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.pharmacy.totalMedications')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-green-600">{formatNumber(stats.totalStock)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.pharmacy.totalStockUnits')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-orange-600">{stats.lowStockCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.pharmacy.lowStockItems')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-red-600">{stats.expiringCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.pharmacy.expiringSoon')}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medication Categories Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('ph.pharmacy.byCategory')}</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t('ph.pharmacy.noMedData')}
            </div>
          )}
        </div>

        {/* Stock Status Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('ph.pharmacy.stockStatus')}</h3>
          {stockStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stockStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stockStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t('ph.pharmacy.noStockData')}
            </div>
          )}
        </div>

        {/* Top Medications by Stock */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('ph.pharmacy.topByStock')}</h3>
          {topMedicationsByStock.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topMedicationsByStock} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Bar dataKey="stock" fill="#84cc16" name={t('ph.pharmacy.currentStock')} radius={[0, 4, 4, 0]} />
                <Bar dataKey="reorderLevel" fill="#f59e0b" name={t('ph.common.reorderLevel')} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t('ph.pharmacy.noMedData')}
            </div>
          )}
        </div>

        {/* Prescription Status Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('ph.pharmacy.rxStatus')}</h3>
          {prescriptionStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={prescriptionStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Bar dataKey="value" name={t('ph.pharmacy.prescriptionsSeries')} radius={[4, 4, 0, 0]}>
                  {prescriptionStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t('ph.pharmacy.noRxData')}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => { setActiveTab('medications'); setPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'medications'
                  ? 'border-lime-600 text-lime-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {t('ph.pharmacy.tabMedications')}
            </button>
            <button
              onClick={() => { setActiveTab('prescriptions'); setPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'prescriptions'
                  ? 'border-lime-600 text-lime-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {t('ph.pharmacy.tabPrescriptions')}
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === 'medications' ? t('ph.pharmacy.searchMedications') : t('ph.pharmacy.searchPrescriptions')}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            {activeTab === 'medications' && (
              <>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('ph.common.allCategories')}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showLowStock}
                    onChange={(e) => setShowLowStock(e.target.checked)}
                    className="w-4 h-4 text-lime-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t('ph.common.lowStockOnly')}</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {fetchError ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-600 dark:text-red-400 mb-2">{fetchError}</p>
              <button
                onClick={activeTab === 'medications' ? fetchMedications : fetchPrescriptions}
                className="text-lime-600 dark:text-lime-400 hover:underline"
              >
                {t('ph.common.tryAgain')}
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">{t('ph.common.loading')}</span>
            </div>
          ) : activeTab === 'medications' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3">{t('ph.pharmacy.colMedication')}</th>
                    <th className="px-4 py-3">{t('ph.common.category')}</th>
                    <th className="px-4 py-3">{t('ph.common.stock')}</th>
                    <th className="px-4 py-3">{t('ph.common.price')}</th>
                    <th className="px-4 py-3">{t('ph.common.status')}</th>
                    <th className="px-4 py-3">{t('ph.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {medications.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{med.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{med.genericName} - {med.strength}{med.dosageForm ? ` · ${dosageFormLabel(med.dosageForm)}` : ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{med.category}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isLowStock(med) ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                          {formatNumber(med.stockQuantity)}
                        </span>
                        {isLowStock(med) && (
                          <span className="ml-2 text-xs text-red-600">({t('ph.common.low')})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(med.unitPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {med.isActive ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400 rounded text-xs">{tEnum('ACTIVE')}</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400 rounded text-xs">{tEnum('INACTIVE')}</span>
                          )}
                          {getExpiryState(med) === 'expiring' && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400 rounded text-xs">{tEnum('EXPIRING_SOON')}</span>
                          )}
                          {getExpiryState(med) === 'expired' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400 rounded text-xs">{t('ph.common.expired')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PermissionGate permission="pharmacy:edit_medications">
                            <button
                              onClick={() => openStockModal(med)}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                              title={t('ph.pharmacy.adjustTooltip')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="pharmacy:edit_medications">
                            <button
                              onClick={() => openEditModal(med)}
                              className="p-1.5 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                              title={t('ph.pharmacy.editTooltip')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="pharmacy:manage_all">
                            <button
                              onClick={() => openDeleteModal(med)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                              title={t('ph.pharmacy.deleteTooltip')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {medications.length === 0 && (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">{t('ph.pharmacy.noMedications')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">{t('ph.pharmacy.noPrescriptions')}</p>
              ) : (
                prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{rx.patientName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t('ph.pharmacy.prescribedByOn', { doctor: rx.doctorName, date: formatDate(rx.createdAt) })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(rx.status)}`}>
                          {rxStatus(rx.status)}
                        </span>
                        <Link
                          href={`/dashboard/prescriptions/${rx.id}`}
                          className="px-3 py-1.5 text-sm text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                        >
                          {rx.status === 'ACTIVE' || rx.status === 'PARTIALLY_DISPENSED' ? t('ph.rx.dispense') : t('ph.common.view')}
                        </Link>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rx.items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className={`px-2 py-1 rounded text-xs ${
                            item.isDispensed
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {item.medication} x{item.quantity}
                        </span>
                      ))}
                      {rx.items.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400 rounded text-xs">
                          {t('ph.common.more', { count: rx.items.length - 3 })}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
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
              {t('ph.common.previous')}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('ph.common.pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('ph.common.next')}
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-2xl sm:w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ph.pharmacy.addMedication')}</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.name')} *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.genericName')} *</label>
                    <input
                      type="text"
                      value={formData.genericName}
                      onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.category')} *</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder={t('ph.pharmacy.categoryPlaceholder')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.dosageForm')} *</label>
                    <select
                      value={formData.dosageForm}
                      onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    >
                      <option value="">{t('ph.pharmacy.selectForm')}</option>
                      {dosageForms.map((form) => (
                        <option key={form} value={form}>{dosageFormLabel(form)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.strength')} *</label>
                    <input
                      type="text"
                      value={formData.strength}
                      onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                      placeholder={t('ph.pharmacy.strengthPlaceholder')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.manufacturer')} *</label>
                    <input
                      type="text"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.unitPrice')} *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.initialStock')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.reorderLevel')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorderLevel}
                      onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.expiryDate')}</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.contraindications')}</label>
                  <input
                    type="text"
                    value={formData.contraindications}
                    onChange={(e) => setFormData({ ...formData, contraindications: e.target.value })}
                    placeholder={t('ph.pharmacy.contraPlaceholder')}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.sideEffects')}</label>
                  <input
                    type="text"
                    value={formData.sideEffects}
                    onChange={(e) => setFormData({ ...formData, sideEffects: e.target.value })}
                    placeholder={t('ph.pharmacy.sideEffectsPlaceholder')}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-lime-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('ph.pharmacy.active')}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requiresRx}
                      onChange={(e) => setFormData({ ...formData, requiresRx: e.target.checked })}
                      className="w-4 h-4 text-lime-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('ph.pharmacy.requiresRx')}</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    {t('ph.common.cancel')}
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors">
                    {saving ? t('ph.common.creating') : t('ph.pharmacy.createMedication')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedMedication && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-2xl sm:w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ph.pharmacy.editMedication')}</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.name')} *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.genericName')} *</label>
                    <input
                      type="text"
                      value={formData.genericName}
                      onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.category')} *</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.dosageForm')} *</label>
                    <select
                      value={formData.dosageForm}
                      onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    >
                      <option value="">{t('ph.pharmacy.selectForm')}</option>
                      {dosageForms.map((form) => (
                        <option key={form} value={form}>{dosageFormLabel(form)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.strength')} *</label>
                    <input
                      type="text"
                      value={formData.strength}
                      onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.manufacturer')} *</label>
                    <input
                      type="text"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.unitPrice')} *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.stockQuantity')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.reorderLevel')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorderLevel}
                      onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.common.expiryDate')}</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.contraindications')}</label>
                  <input
                    type="text"
                    value={formData.contraindications}
                    onChange={(e) => setFormData({ ...formData, contraindications: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ph.pharmacy.sideEffects')}</label>
                  <input
                    type="text"
                    value={formData.sideEffects}
                    onChange={(e) => setFormData({ ...formData, sideEffects: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-lime-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('ph.pharmacy.active')}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requiresRx}
                      onChange={(e) => setFormData({ ...formData, requiresRx: e.target.checked })}
                      className="w-4 h-4 text-lime-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('ph.pharmacy.requiresRx')}</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    {t('ph.common.cancel')}
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors">
                    {saving ? t('ph.common.saving') : t('ph.common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && selectedMedication && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-md sm:w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ph.common.adjustStock')}</h3>
                <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white">{selectedMedication.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.common.currentStock', { qty: formatNumber(selectedMedication.stockQuantity) })}</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleStockUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('ph.common.adjustmentLabel')}
                  </label>
                  <input
                    type="number"
                    value={stockAdjustment.quantity}
                    onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {t('ph.common.newStock', { qty: formatNumber(selectedMedication.stockQuantity + stockAdjustment.quantity) })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                  <input
                    type="text"
                    value={stockAdjustment.reason}
                    onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                    placeholder={t('ph.pharmacy.reasonPlaceholder')}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    {t('ph.common.cancel')}
                  </button>
                  <button type="submit" disabled={saving || stockAdjustment.quantity === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                    {saving ? t('ph.common.updating') : t('ph.common.updateStock')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedMedication && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-md sm:w-full p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('ph.pharmacy.deleteMedication')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('ph.common.deleteConfirm', { name: selectedMedication.name })}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  {t('ph.common.cancel')}
                </button>
                <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {saving ? t('ph.common.deleting') : t('ph.common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

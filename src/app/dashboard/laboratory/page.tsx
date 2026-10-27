'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api, LabTest, LabOrder, LabOrderStatus } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { PermissionGate } from '@/components/permission-gate';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { LabWorklist } from '@/components/lab/worklist';
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

interface LabTestFormData {
  code: string;
  name: string;
  category: string;
  description: string;
  sampleType: string;
  normalRange: string;
  unit: string;
  processingTime: number;
  price: number;
  isActive: boolean;
}

const initialFormData: LabTestFormData = {
  code: '',
  name: '',
  category: '',
  description: '',
  sampleType: '',
  normalRange: '',
  unit: '',
  processingTime: 24,
  price: 0,
  isActive: true,
};

const sampleTypes = ['Blood', 'Urine', 'Stool', 'Sputum', 'Swab', 'Tissue', 'Fluid', 'Other'];

const CHART_COLORS = ['#84cc16', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = {
  ORDERED: '#3b82f6',
  SAMPLE_COLLECTED: '#f59e0b',
  PROCESSING: '#8b5cf6',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
};

export default function LaboratoryPage() {
  const { user } = useAuth();
  // Lab staff start on the bench worklist; others (doctors, desk) on the order history
  const [view, setView] = useState<'worklist' | 'overview'>(user?.role === 'LAB_TECH' || user?.role === 'ADMIN' ? 'worklist' : 'overview');
  const [activeTab, setActiveTab] = useState<'orders' | 'tests'>('orders');
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<LabOrderStatus | ''>('');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  // Totals per priority across all orders (from the API, not just the current page)
  const [priorityCounts, setPriorityCounts] = useState<Record<string, number>>({});

  const toast = useToast();
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  // Full catalog for the charts; the paginated `labTests` only holds the visible page of the Test Catalog tab
  const [catalogTests, setCatalogTests] = useState<LabTest[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [formData, setFormData] = useState<LabTestFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Chart data computations
  const orderStatusData = useMemo(() => {
    return Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: tEnum(status),
        value: count,
        color: STATUS_COLORS[status] || '#6b7280',
      }));
  }, [statusCounts, tEnum]);

  const testCategoryData = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    catalogTests.forEach((test) => {
      const cat = test.category || t('lab.uncategorized');
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    return Object.entries(categoryCount).map(([cat, value]) => {
      const key = `lab.category.${cat}`;
      const label = t(key);
      return { name: label === key ? cat : label, value };
    });
  }, [catalogTests, t]);

  const sampleTypeData = useMemo(() => {
    const sampleCount: Record<string, number> = {};
    catalogTests.forEach((test) => {
      const sample = test.sampleType || 'Other';
      sampleCount[sample] = (sampleCount[sample] || 0) + 1;
    });
    return Object.entries(sampleCount).map(([sample, value]) => {
      const key = `lab.sample.${sample}`;
      const label = t(key);
      return { name: label === key ? sample : label, value };
    });
  }, [catalogTests, t]);

  const priorityData = useMemo(() => {
    return [
      { name: tEnum('ROUTINE'), value: priorityCounts.ROUTINE || 0, color: '#6b7280' },
      { name: tEnum('URGENT'), value: priorityCounts.URGENT || 0, color: '#f59e0b' },
      { name: tEnum('STAT'), value: priorityCounts.STAT || 0, color: '#ef4444' },
    ].filter((d) => d.value > 0);
  }, [priorityCounts, tEnum]);

  // Load the whole active catalog once so the category/sample charts reflect every test
  useEffect(() => {
    api.getLabTests({ limit: 500 })
      .then((response) => setCatalogTests(response.labTests))
      .catch((err) => console.error('Error fetching lab test catalog:', err));
  }, []);

  const fetchLabOrders = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getLabOrders({
        search: debouncedSearch || undefined,
        status: status || undefined,
        page,
        limit: 10,
      });
      setLabOrders(response.labOrders);
      setStatusCounts(response.statusCounts);
      setPriorityCounts((response as typeof response & { priorityCounts?: Record<string, number> }).priorityCounts || {});
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching lab orders:', error);
      setFetchError(error instanceof Error ? error.message : t('lab.error.fetchOrders'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, page]);

  const fetchLabTests = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getLabTests({
        search: debouncedSearch || undefined,
        category,
        page,
        limit: 10,
      });
      setLabTests(response.labTests);
      setCategories(response.categories);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching lab tests:', error);
      setFetchError(error instanceof Error ? error.message : t('lab.error.fetchTests'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, page]);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchLabOrders();
    } else {
      fetchLabTests();
    }
  }, [activeTab, fetchLabOrders, fetchLabTests]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const getStatusColor = (status: LabOrderStatus) => {
    switch (status) {
      case 'ORDERED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      case 'SAMPLE_COLLECTED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'PROCESSING': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400';
      case 'COMPLETED': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'STAT': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'URGENT': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const statusOptions: { value: LabOrderStatus | ''; label: string }[] = [
    { value: '', label: t('lab.filters.allStatuses') },
    ...(['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as LabOrderStatus[]).map((value) => ({
      value,
      label: tEnum(value),
    })),
  ];

  const categoryLabel = (cat: string) => {
    const key = `lab.category.${cat}`;
    const label = t(key);
    return label === key ? cat : label;
  };

  const sampleLabel = (sample: string) => {
    const key = `lab.sample.${sample}`;
    const label = t(key);
    return label === key ? sample : label;
  };

  const openCreateModal = () => {
    setFormData(initialFormData);
    setError('');
    setShowCreateModal(true);
  };

  const openEditModal = (test: LabTest) => {
    setSelectedTest(test);
    setFormData({
      code: test.code,
      name: test.name,
      category: test.category,
      description: test.description || '',
      sampleType: test.sampleType,
      normalRange: test.normalRange || '',
      unit: test.unit || '',
      processingTime: test.processingTime,
      price: test.price,
      isActive: test.isActive,
    });
    setError('');
    setShowEditModal(true);
  };

  const openDeleteModal = (test: LabTest) => {
    setSelectedTest(test);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.category.trim()) {
      setError(t('lab.form.requiredCodeNameCategory'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createLabTest({
        code: formData.code.trim(),
        name: formData.name.trim(),
        category: formData.category.trim(),
        description: formData.description.trim() || undefined,
        sampleType: formData.sampleType,
        normalRange: formData.normalRange.trim() || undefined,
        unit: formData.unit.trim() || undefined,
        processingTime: formData.processingTime,
        price: formData.price,
        isActive: formData.isActive,
      });
      setShowCreateModal(false);
      setFormData(initialFormData);
      toast.success(t('lab.toast.testCreated'), t('lab.toast.testCreatedMsg', { name: formData.name }));
      fetchLabTests();
      refreshCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lab.error.createTest'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTest || !formData.name.trim() || !formData.category.trim()) {
      setError(t('lab.form.requiredNameCategory'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.updateLabTest(selectedTest.id, {
        name: formData.name.trim(),
        category: formData.category.trim(),
        description: formData.description.trim() || undefined,
        sampleType: formData.sampleType,
        normalRange: formData.normalRange.trim() || undefined,
        unit: formData.unit.trim() || undefined,
        processingTime: formData.processingTime,
        price: formData.price,
        isActive: formData.isActive,
      });
      setShowEditModal(false);
      setSelectedTest(null);
      setFormData(initialFormData);
      toast.success(t('lab.toast.testUpdated'), t('lab.toast.testUpdatedMsg', { name: formData.name }));
      fetchLabTests();
      refreshCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lab.error.updateTest'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTest) return;

    try {
      setSaving(true);
      const testName = selectedTest.name;
      await api.deleteLabTest(selectedTest.id);
      setShowDeleteModal(false);
      setSelectedTest(null);
      toast.success(t('lab.toast.testDeleted'), t('lab.toast.testDeletedMsg', { name: testName }));
      fetchLabTests();
      refreshCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lab.error.deleteTest'));
      toast.error(t('lab.toast.deleteFailed'), err instanceof Error ? err.message : t('lab.error.deleteTest'));
    } finally {
      setSaving(false);
    }
  };

  const refreshCatalog = () => {
    api.getLabTests({ limit: 500 })
      .then((response) => setCatalogTests(response.labTests))
      .catch((err) => console.error('Error fetching lab test catalog:', err));
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedTest(null);
    setFormData(initialFormData);
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('lab.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('lab.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <PermissionGate permission="laboratory:create_orders">
            <Link
              href="/dashboard/laboratory/orders/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('lab.newOrder')}
            </Link>
          </PermissionGate>
          <PermissionGate permission="laboratory:manage_tests">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('lab.addTest')}
            </button>
          </PermissionGate>
        </div>
      </div>

      <div role="tablist" className="flex gap-2">
        {(['worklist', 'overview'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              view === v ? 'bg-brand border-lime-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t(`labw.view.${v}`)}
          </button>
        ))}
        <Link href="/dashboard/laboratory/tests" className="ml-auto px-4 py-2 text-sm text-lime-700 dark:text-lime-400 hover:underline">
          {t('labw.catalogue.link')}
        </Link>
      </div>

      {view === 'worklist' ? (
        <LabWorklist />
      ) : (
        <>
      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statusOptions.slice(1).map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatus(opt.value); setPage(1); setActiveTab('orders'); }}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border transition-colors ${
              status === opt.value
                ? 'border-lime-500 ring-2 ring-lime-200 dark:ring-lime-800'
                : 'border-gray-100 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {statusCounts[opt.value] || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{opt.label}</p>
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('lab.charts.orderStatus')}</h3>
          {orderStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {orderStatusData.map((entry, index) => (
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
              {t('lab.charts.noOrderData')}
            </div>
          )}
        </div>

        {/* Order Priority Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('lab.charts.byPriority')}</h3>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Bar dataKey="value" name={t('lab.charts.orders')} radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t('lab.charts.noOrderData')}
            </div>
          )}
        </div>

        {/* Tests by Category */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('lab.charts.byCategory')}</h3>
          {testCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={testCategoryData} layout="vertical" margin={{ left: 20 }}>
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
                <Bar dataKey="value" fill="#84cc16" name={t('lab.charts.tests')} radius={[0, 4, 4, 0]}>
                  {testCategoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              {t('lab.charts.noTestData')}
            </div>
          )}
        </div>

        {/* Tests by Sample Type */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('lab.charts.bySampleType')}</h3>
          {sampleTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sampleTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {sampleTypeData.map((_, index) => (
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
              {t('lab.charts.noTestData')}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => { setActiveTab('orders'); setPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'orders'
                  ? 'border-lime-600 text-lime-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {t('lab.tabs.orders')}
            </button>
            <button
              onClick={() => { setActiveTab('tests'); setPage(1); }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tests'
                  ? 'border-lime-600 text-lime-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {t('lab.tabs.catalog')}
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
                placeholder={activeTab === 'orders' ? t('lab.filters.searchPatients') : t('lab.filters.searchTests')}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            {activeTab === 'orders' ? (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LabOrderStatus | '')}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t('lab.filters.allCategories')}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                ))}
              </select>
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
                onClick={activeTab === 'orders' ? fetchLabOrders : fetchLabTests}
                className="text-lime-600 dark:text-lime-400 hover:underline"
              >
                {t('lab.tryAgain')}
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">{t('lab.loading')}</span>
            </div>
          ) : activeTab === 'orders' ? (
            <div className="space-y-4">
              {labOrders.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">{t('lab.noOrders')}</p>
              ) : (
                labOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/laboratory/orders/${order.id}`}
                    className="block p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{order.patientName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{order.patientHospitalId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(order.priority)}`}>
                          {tEnum(order.priority)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                          {tEnum(order.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.tests.map((test) => (
                        <span
                          key={test.id}
                          className={`px-2 py-1 rounded text-xs ${
                            test.result
                              ? test.isAbnormal
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {test.name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>{t('lab.orderedBy', { doctor: order.doctorName })}</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3">{t('lab.table.code')}</th>
                    <th className="px-4 py-3">{t('lab.table.name')}</th>
                    <th className="px-4 py-3">{t('lab.table.category')}</th>
                    <th className="px-4 py-3">{t('lab.table.sampleType')}</th>
                    <th className="px-4 py-3">{t('lab.table.processingTime')}</th>
                    <th className="px-4 py-3">{t('lab.table.price')}</th>
                    <th className="px-4 py-3">{t('lab.table.status')}</th>
                    <th className="px-4 py-3">{t('lab.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {labTests.map((test) => (
                    <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-mono text-sm text-lime-600 dark:text-lime-400">{test.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{test.name}</p>
                        {test.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{test.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{categoryLabel(test.category)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{sampleLabel(test.sampleType)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t('lab.hours', { count: test.processingTime })}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatCurrency(test.price)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          test.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {tEnum(test.isActive ? 'ACTIVE' : 'INACTIVE')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PermissionGate permission="laboratory:manage_tests">
                            <button
                              onClick={() => openEditModal(test)}
                              className="p-1.5 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                              title={t('lab.editTest')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="laboratory:manage_tests">
                            <button
                              onClick={() => openDeleteModal(test)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                              title={t('lab.deleteTest')}
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
              {labTests.length === 0 && (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">{t('lab.noTests')}</p>
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
              {t('lab.pagination.previous')}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('lab.pagination.pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('lab.pagination.next')}
            </button>
          </div>
        )}
      </div>

        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('lab.modal.addTitle')}</h3>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.code')} *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder={t('lab.form.codePlaceholder')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.category')} *</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder={t('lab.form.categoryPlaceholder')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.name')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.description')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.sampleType')} *</label>
                    <select
                      value={formData.sampleType}
                      onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    >
                      <option value="">{t('lab.form.selectSampleType')}</option>
                      {sampleTypes.map((type) => (
                        <option key={type} value={type}>{sampleLabel(type)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.processingTime')} *</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.processingTime}
                      onChange={(e) => setFormData({ ...formData, processingTime: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.normalRange')}</label>
                    <input
                      type="text"
                      value={formData.normalRange}
                      onChange={(e) => setFormData({ ...formData, normalRange: e.target.value })}
                      placeholder={t('lab.form.normalRangePlaceholder')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.unit')}</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder={t('lab.form.unitPlaceholder')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.price')} *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
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
                    {t('lab.form.active')}
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    {t('lab.form.cancel')}
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors">
                    {saving ? t('lab.form.creating') : t('lab.form.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('lab.modal.editTitle')}</h3>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.code')}</label>
                    <input
                      type="text"
                      value={formData.code}
                      disabled
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.category')} *</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.name')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.description')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.sampleType')} *</label>
                    <select
                      value={formData.sampleType}
                      onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    >
                      {sampleTypes.map((type) => (
                        <option key={type} value={type}>{sampleLabel(type)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.processingTime')} *</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.processingTime}
                      onChange={(e) => setFormData({ ...formData, processingTime: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.normalRange')}</label>
                    <input
                      type="text"
                      value={formData.normalRange}
                      onChange={(e) => setFormData({ ...formData, normalRange: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.unit')}</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.form.price')} *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
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
                    {t('lab.form.active')}
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    {t('lab.form.cancel')}
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors">
                    {saving ? t('lab.form.saving') : t('lab.form.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedTest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModals}></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl transform transition-all sm:max-w-md sm:w-full p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('lab.modal.deleteTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('lab.modal.deleteConfirm', { name: selectedTest.name })}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button onClick={closeModals} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  {t('lab.form.cancel')}
                </button>
                <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {saving ? t('lab.form.deleting') : t('lab.form.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Invoice, InvoiceStatus, PaymentMethod, Patient } from '@/lib/api';
import { PermissionGate } from '@/components/permission-gate';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  category: 'consultation' | 'medication' | 'lab' | 'procedure' | 'other';
}

interface InvoiceFormData {
  patientId: string;
  items: InvoiceItem[];
  tax: number;
  discount: number;
  dueDate: string;
  notes: string;
}

interface PaymentFormData {
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  notes: string;
}

const initialInvoiceForm: InvoiceFormData = {
  patientId: '',
  items: [{ description: '', quantity: 1, unitPrice: 0, category: 'consultation' }],
  tax: 0,
  discount: 0,
  dueDate: '',
  notes: '',
};

const initialPaymentForm: PaymentFormData = {
  amount: 0,
  method: 'CASH',
  referenceNumber: '',
  notes: '',
};

export default function BillingPage() {
  const { user } = useAuth();
  const { t, tEnum, formatCurrency, formatDate , language } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [statusCounts, setStatusCounts] = useState<Record<string, { count: number; total: number }>>({});
  const [totals, setTotals] = useState({ totalBilled: 0, totalPaid: 0, totalOutstanding: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData>(initialInvoiceForm);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(initialPaymentForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Patient search states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // PDF Download handler
  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      setDownloadingId(invoice.id);

      // Get auth token
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert(t('admin.billing.loginAgain'));
        return;
      }

      // Fetch PDF with auth header
      const response = await fetch(`${API_URL}/api/invoices/${invoice.id}/pdf?lang=${language}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = language === 'fr' ? `facture-${invoice.invoiceNumber}.pdf` : `Invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(t('admin.billing.downloadFailed'));
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getInvoices({
        search,
        status: status || undefined,
        page,
        limit: 10,
      });
      setInvoices(response.invoices);
      setStatusCounts(response.statusCounts);
      setTotals(response.totals);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Fetch patients for invoice creation
  const fetchPatients = useCallback(async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setPatients([]);
      return;
    }
    try {
      setLoadingPatients(true);
      const response = await api.getPatients({ search: searchTerm, limit: 10 });
      setPatients(response.data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPatients(patientSearch);
    }, 300);
    return () => clearTimeout(debounce);
  }, [patientSearch, fetchPatients]);

  // Modal handlers
  const openCreateModal = () => {
    setInvoiceForm(initialInvoiceForm);
    setSelectedPatient(null);
    setPatientSearch('');
    setPatients([]);
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

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      ...initialPaymentForm,
      amount: invoice.balance,
    });
    setError('');
    setShowPaymentModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setError('');
  };

  // Invoice item handlers
  const addItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...invoiceForm.items, { description: '', quantity: 1, unitPrice: 0, category: 'consultation' }],
    });
  };

  const removeItem = (index: number) => {
    if (invoiceForm.items.length > 1) {
      setInvoiceForm({
        ...invoiceForm,
        items: invoiceForm.items.filter((_, i) => i !== index),
      });
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...invoiceForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setInvoiceForm({ ...invoiceForm, items: newItems });
  };

  // Calculation helpers
  const calculateSubtotal = () => {
    return invoiceForm.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + invoiceForm.tax - invoiceForm.discount;
  };

  // Select patient
  const selectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setInvoiceForm({ ...invoiceForm, patientId: patient.id });
    setPatients([]);
    setPatientSearch('');
  };

  // Create invoice handler
  const handleCreateInvoice = async () => {
    if (!invoiceForm.patientId) {
      setError(t('admin.billing.selectPatient'));
      return;
    }
    if (invoiceForm.items.some(item => !item.description || item.unitPrice <= 0)) {
      setError(t('admin.billing.fillItems'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createInvoice({
        patientId: invoiceForm.patientId,
        items: invoiceForm.items,
        tax: invoiceForm.tax,
        discount: invoiceForm.discount,
        dueDate: invoiceForm.dueDate || undefined,
        notes: invoiceForm.notes || undefined,
      });
      closeModals();
      fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.billing.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Add payment handler
  const handleAddPayment = async () => {
    if (!selectedInvoice) return;
    if (paymentForm.amount <= 0) {
      setError(t('admin.billing.amountPositive'));
      return;
    }
    if (paymentForm.amount > selectedInvoice.balance) {
      setError(t('admin.billing.amountExceeds'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.addPayment(selectedInvoice.id, {
        amount: paymentForm.amount,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
        notes: paymentForm.notes || undefined,
        processedBy: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
      });
      closeModals();
      fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.billing.recordFailed'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'PAID': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'PARTIALLY_PAID': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      case 'OVERDUE': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      case 'REFUNDED': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const statusOptions: { value: InvoiceStatus | ''; label: string }[] = [
    { value: '', label: t('admin.billing.allStatus') },
    ...(['DRAFT', 'PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'] as InvoiceStatus[]).map(
      (value) => ({ value, label: tEnum(value) })
    ),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.billing.billingInvoices')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('admin.billing.managePatientInvoicesAndPayments')}</p>
        </div>
        <PermissionGate permission="billing:create">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('admin.billing.newInvoice')}
          </button>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.billing.totalBilled')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totals.totalBilled)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.billing.totalCollected')}</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalPaid)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.billing.outstanding')}</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totals.totalOutstanding)}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.billing.searchByInvoiceOrPatientName')}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as InvoiceStatus | ''); setPage(1); }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-center py-12 text-gray-500 dark:text-gray-400">{t('admin.billing.noInvoicesFound')}</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3">{t('admin.billing.invoice')}</th>
                  <th className="px-6 py-3">{t('admin.billing.patient')}</th>
                  <th className="px-6 py-3">{t('admin.billing.date')}</th>
                  <th className="px-6 py-3">{t('admin.billing.total')}</th>
                  <th className="px-6 py-3">{t('admin.billing.paid')}</th>
                  <th className="px-6 py-3">{t('admin.billing.balance')}</th>
                  <th className="px-6 py-3">{t('admin.billing.status')}</th>
                  <th className="px-6 py-3">{t('admin.billing.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-lime-600 dark:text-lime-400">
                        {invoice.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{invoice.patientName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.patientHospitalId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-6 py-4 text-sm text-green-600">
                      {formatCurrency(invoice.paidAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-orange-600">
                      {formatCurrency(invoice.balance)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {tEnum(invoice.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/billing/${invoice.id}`}
                          className="text-lime-600 hover:text-lime-800 text-sm font-medium"
                        >
                          {t('admin.billing.view')}
                        </Link>
                        <button
                          onClick={() => handleDownloadPdf(invoice)}
                          disabled={downloadingId === invoice.id}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                          title={t('admin.billing.downloadPdf')}
                        >
                          {downloadingId === invoice.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                          PDF
                        </button>
                        {invoice.balance > 0 && (
                          <PermissionGate permission="billing:process_payments">
                            <button
                              onClick={() => openPaymentModal(invoice)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              {t('admin.billing.pay')}
                            </button>
                          </PermissionGate>
                        )}
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
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('admin.billing.previous')}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('admin.billing.pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              {t('admin.billing.next')}
            </button>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('admin.billing.createNewInvoice')}</h2>
            </div>
            <div className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin.billing.patient')}
                </label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedPatient.patientId}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPatient(null);
                        setInvoiceForm({ ...invoiceForm, patientId: '' });
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder={t('admin.billing.searchPatientsByNameOrId')}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    {loadingPatients && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-lime-600"></div>
                      </div>
                    )}
                    {patients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                        {patients.map((patient) => (
                          <button
                            key={patient.id}
                            onClick={() => selectPatient(patient)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <p className="font-medium text-gray-900 dark:text-white">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{patient.patientId}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invoice Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.billing.invoiceItems')}
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-lime-600 hover:text-lime-800 font-medium"
                  >
                    {t('admin.billing.addItem')}
                  </button>
                </div>
                <div className="space-y-3">
                  {invoiceForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder={t('admin.billing.description')}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(index, 'category', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        >
                          {(['consultation', 'medication', 'lab', 'procedure', 'other'] as const).map((cat) => (
                            <option key={cat} value={cat}>{t(`admin.billing.cat.${cat}`)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          min="1"
                          placeholder={t('admin.billing.qty')}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="1"
                          placeholder={t('admin.billing.price')}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="col-span-1 text-right text-sm text-gray-700 dark:text-gray-300 py-2">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={invoiceForm.items.length === 1}
                          className="p-2 text-red-600 hover:text-red-800 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax, Discount, Due Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.billing.tax')}
                  </label>
                  <input
                    type="number"
                    value={invoiceForm.tax}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, tax: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.billing.discount')}
                  </label>
                  <input
                    type="number"
                    value={invoiceForm.discount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.billing.dueDate')}
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.billing.notes')}
                </label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Totals */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.billing.subtotal')}</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.billing.tax')}</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(invoiceForm.tax)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.billing.discount')}</span>
                  <span className="text-red-600">-{formatCurrency(invoiceForm.discount)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">{t('admin.billing.total')}</span>
                  <span className="font-bold text-lg text-lime-600">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeModals}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('admin.billing.cancel')}
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={saving}
                className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                {t('admin.billing.createInvoice')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('admin.billing.recordPayment')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('admin.billing.invoiceNumber', { number: selectedInvoice.invoiceNumber })}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Invoice Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.billing.patient')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{selectedInvoice.patientName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.billing.totalAmount')}</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(selectedInvoice.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.billing.alreadyPaid')}</span>
                  <span className="text-green-600">{formatCurrency(selectedInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{t('admin.billing.balanceDue')}</span>
                  <span className="font-bold text-orange-600">{formatCurrency(selectedInvoice.balance)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.billing.paymentAmount')}
                </label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  max={selectedInvoice.balance}
                  min="1"
                  step="1"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.billing.paymentMethod')}
                </label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="CASH">{tEnum('CASH')}</option>
                  <option value="CARD">{tEnum('CARD')}</option>
                  <option value="BANK_TRANSFER">{tEnum('BANK_TRANSFER')}</option>
                  <option value="MTN_MOMO">{tEnum('MTN_MOMO')}</option>
                  <option value="ORANGE_MONEY">{tEnum('ORANGE_MONEY')}</option>
                  <option value="MOBILE_WALLET">{tEnum('MOBILE_WALLET')}</option>
                  <option value="INSURANCE">{tEnum('INSURANCE')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.billing.referenceNumber')}
                </label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  placeholder={t('admin.billing.transactionIdReceiptNumberEtc')}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.billing.notes')}
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeModals}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('admin.billing.cancel')}
              </button>
              <button
                onClick={handleAddPayment}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                {t('admin.billing.recordPayment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, CoveragePreview, Invoice, InvoiceStatus, Payer, PaymentMethod, Patient } from '@/lib/api';
import { InvoiceCoveragePanel, CoverageChoice, initialCoverageChoice, coverageRequestFields } from '@/components/insurance/invoice-coverage-panel';
import { isInsured, patientDue } from '@/lib/insurance';
import { PermissionGate } from '@/components/permission-gate';
import { MobileMoneyPayment, MobileMoneyReconciliationPanel } from '@/components/payments';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { NoTillBanner, ReceiptReadyBanner, useMyTill } from '@/components/cash-desk/ui';
import { InvoiceLinesEditor } from '@/components/price-list/invoice-lines';
import { emptyLine, lineProblem, lineToInput, type InvoiceLineDraft } from '@/lib/price-list';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface InvoiceFormData {
  patientId: string;
  items: InvoiceLineDraft[];
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

const initialInvoiceForm = (): InvoiceFormData => ({
  patientId: '',
  items: [emptyLine()],
  tax: 0,
  discount: 0,
  dueDate: '',
  notes: '',
});

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
  // '' = all, 'insured' = any payer, 'self' = patient pays everything, else a payer id
  const [payerFilter, setPayerFilter] = useState('');
  const [payers, setPayers] = useState<Payer[]>([]);
  const [coverageChoice, setCoverageChoice] = useState<CoverageChoice>(initialCoverageChoice);
  const [coveragePreview, setCoveragePreview] = useState<CoveragePreview | null>(null);
  // Payer whose prices apply: kept when a preview fails (e.g. a price awaiting its reason) so lines don't jump back to list prices
  const [pricingPayerId, setPricingPayerId] = useState<string | null>(null);
  const handlePreview = (preview: CoveragePreview | null) => {
    setCoveragePreview(preview);
    if (preview) setPricingPayerId(preview.coverage?.payerId ?? null);
  };

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [mobileMoneyInvoice, setMobileMoneyInvoice] = useState<Invoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData>(initialInvoiceForm);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(initialPaymentForm);
  // Cash desk: payments go into the cashier's open till and get a numbered receipt
  const { session: till, loading: tillLoading } = useMyTill();
  const [lastReceipt, setLastReceipt] = useState<{ paymentId: string; receiptNumber: string | null; amount: number } | null>(null);
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
        insured: payerFilter === 'insured' ? true : payerFilter === 'self' ? false : undefined,
        payerId: payerFilter && payerFilter !== 'insured' && payerFilter !== 'self' ? payerFilter : undefined,
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
  }, [search, status, page, payerFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    api.getPayers().then(setPayers).catch(() => setPayers([]));
  }, []);

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
    setInvoiceForm(initialInvoiceForm());
    setSelectedPatient(null);
    setPatientSearch('');
    setPatients([]);
    setCoverageChoice(initialCoverageChoice);
    setCoveragePreview(null);
    setPricingPayerId(null);
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
      amount: patientDue(invoice),
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
    setCoverageChoice(initialCoverageChoice);
    setCoveragePreview(null);
    setPricingPayerId(null);
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
    const lines = invoiceForm.items.filter((item) => item.tariff || item.description.trim() || item.unitPrice > 0);
    if (lines.length === 0) {
      setError(t('admin.billing.fillItems'));
      return;
    }
    const problemIndex = lines.findIndex((item) => lineProblem(item, user?.role));
    if (problemIndex !== -1) {
      setError(`${t('pl.lines.lineN', { n: problemIndex + 1 })} ${t(lineProblem(lines[problemIndex], user?.role)!)}`);
      return;
    }
    const coverageFields = coverageRequestFields(coverageChoice);
    if (coverageFields.useCoverage && coveragePreview?.coverage && coveragePreview.preAuthRequired && !coverageChoice.preAuthId) {
      setError(t('ins.invoice.preAuthMissing'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.createInvoice({
        patientId: invoiceForm.patientId,
        items: lines.map(lineToInput),
        tax: invoiceForm.tax,
        discount: invoiceForm.discount,
        dueDate: invoiceForm.dueDate || undefined,
        notes: invoiceForm.notes || undefined,
        ...coverageFields,
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
    if (!selectedInvoice || !till) return;
    if (paymentForm.amount <= 0) {
      setError(t('admin.billing.amountPositive'));
      return;
    }
    if (paymentForm.amount > patientDue(selectedInvoice)) {
      setError(t('admin.billing.amountExceeds'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      const { payment } = await api.addPayment(selectedInvoice.id, {
        amount: paymentForm.amount,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
        notes: paymentForm.notes || undefined,
      });
      setLastReceipt({ paymentId: payment.id, receiptNumber: payment.receiptNumber ?? null, amount: Number(payment.amount) });
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

      {lastReceipt && <ReceiptReadyBanner {...lastReceipt} onDismiss={() => setLastReceipt(null)} />}

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
            <select
              value={payerFilter}
              onChange={(e) => { setPayerFilter(e.target.value); setPage(1); }}
              aria-label={t('ins.filter.label')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('ins.filter.all')}</option>
              <option value="insured">{t('ins.filter.insured')}</option>
              <option value="self">{t('ins.filter.self')}</option>
              {payers.map((payer) => (
                <option key={payer.id} value={payer.id}>{payer.name}</option>
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
                        {isInsured(invoice) && invoice.payer && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300" title={invoice.payer.name}>
                            {invoice.payer.code}
                          </span>
                        )}
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
                      {isInsured(invoice) && invoice.balance > 0 && (
                        <p className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          {t('ins.list.patientDue', { amount: formatCurrency(patientDue(invoice)) })}
                        </p>
                      )}
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
                        {patientDue(invoice) > 0 && (
                          <PermissionGate permission="billing:process_payments">
                            <button
                              onClick={() => openPaymentModal(invoice)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              {t('admin.billing.pay')}
                            </button>
                            <button
                              onClick={() => setMobileMoneyInvoice(invoice)}
                              className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                            >
                              {t('pay.action')}
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
                        setCoveragePreview(null);
                        setPricingPayerId(null);
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

              {/* Invoice Items: picked from the price list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin.billing.invoiceItems')}
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('pl.lines.hint')}</span>
                </div>
                <InvoiceLinesEditor
                  lines={invoiceForm.items}
                  onChange={(items) => setInvoiceForm((prev) => ({ ...prev, items }))}
                  payerId={coverageChoice.coverage === 'none' ? null : pricingPayerId}
                  role={user?.role}
                />
              </div>

              {/* Tiers payant: who pays what */}
              {selectedPatient && (
                <InvoiceCoveragePanel
                  patientId={selectedPatient.id}
                  items={invoiceForm.items.filter((item) => item.tariff || item.description.trim()).map(lineToInput)}
                  tax={invoiceForm.tax}
                  discount={invoiceForm.discount}
                  value={coverageChoice}
                  onChange={setCoverageChoice}
                  onPreview={handlePreview}
                />
              )}

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
                {coverageChoice.coverage !== 'none' && coveragePreview?.coverage && (
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-600 dark:text-gray-400">{t('ins.patientPays')}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(coveragePreview.patientShare)}</span>
                  </div>
                )}
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

      {mobileMoneyInvoice && (
        <MobileMoneyPayment
          isOpen
          invoice={{
            id: mobileMoneyInvoice.id,
            invoiceNumber: mobileMoneyInvoice.invoiceNumber,
            balance: patientDue(mobileMoneyInvoice),
            patientName: mobileMoneyInvoice.patientName,
          }}
          canSimulate={user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST'}
          onFinished={() => fetchInvoices()}
          onClose={() => setMobileMoneyInvoice(null)}
        />
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
              {!tillLoading && !till && <NoTillBanner />}
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
                {isInsured(selectedInvoice) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('ins.insurerShare')}</span>
                    <span className="text-blue-700 dark:text-blue-400">{formatCurrency(selectedInvoice.insurerShare ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{isInsured(selectedInvoice) ? t('ins.patientBalance') : t('admin.billing.balanceDue')}</span>
                  <span className="font-bold text-orange-600">{formatCurrency(patientDue(selectedInvoice))}</span>
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
                  max={patientDue(selectedInvoice)}
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
                disabled={saving || !till}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                {t('admin.billing.recordPayment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The cash desk reconciles the day's mobile money here (admins also see it under Paiements) */}
      {user?.role === 'RECEPTIONIST' && <MobileMoneyReconciliationPanel />}
    </div>
  );
}

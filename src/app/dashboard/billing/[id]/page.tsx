'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, InvoiceDetail, PaymentMethod } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { MobileMoneyPayment, MobileMoneyHistory } from '@/components/payments';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PaymentFormData {
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  notes: string;
}

const initialPaymentForm: PaymentFormData = {
  amount: 0,
  method: 'CASH',
  referenceNumber: '',
  notes: '',
};

export default function BillingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t, tEnum, formatCurrency, formatDate, formatDateTime , language } = useLanguage();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMobileMoney, setShowMobileMoney] = useState(false);
  const [mobileMoneyRefresh, setMobileMoneyRefresh] = useState(0);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(initialPaymentForm);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  // The spinner only covers the first load: later refreshes (after a payment) keep the page,
  // and any open payment dialog, on screen
  const fetchInvoice = async () => {
    try {
      if (!invoice) setLoading(true);
      setError('');
      const data = await api.getInvoice(invoiceId);
      setInvoice(data);
    } catch (err) {
      console.error('Error fetching invoice:', err);
      setError(t('admin.invoice.failedToLoadInvoiceDetails'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setDownloadingPdf(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        alert(t('admin.billing.loginAgain'));
        return;
      }

      const response = await fetch(`${API_URL}/api/invoices/${invoice.id}/pdf?lang=${language}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

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
      setDownloadingPdf(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !user) return;

    try {
      setSubmitting(true);
      await api.addPayment(invoice.id, {
        amount: paymentForm.amount,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
        notes: paymentForm.notes || undefined,
        processedBy: `${user.firstName} ${user.lastName}`,
      });
      setShowPaymentModal(false);
      setPaymentForm(initialPaymentForm);
      fetchInvoice(); // Refresh data
    } catch (err) {
      console.error('Error adding payment:', err);
      alert(t('admin.invoice.addPaymentFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
      case 'PARTIALLY_PAID':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'OVERDUE':
        return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.invoice.loadingInvoice')}</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">{t('admin.invoice.invoiceNotFound')}</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'The requested invoice could not be found.'}</p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('admin.invoice.backToBilling')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/billing"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('admin.invoice.title', { number: invoice.invoiceNumber })}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('admin.invoice.createdOn', { date: formatDate(invoice.createdAt) })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${getStatusColor(invoice.status)}`}>
            {tEnum(invoice.status)}
          </span>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {downloadingPdf ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {t('admin.invoice.downloadPdf')}
          </button>
          {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.balance > 0 && (
            <button
              onClick={() => setShowMobileMoney(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-amber-400 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              {t('pay.title')}
            </button>
          )}
          {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
            <button
              onClick={() => {
                setPaymentForm({ ...initialPaymentForm, amount: invoice.balance });
                setShowPaymentModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {t('admin.invoice.recordPayment')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.invoice.patientInformation')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.invoice.name')}</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {invoice.patient.firstName} {invoice.patient.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.invoice.patientId')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{invoice.patient.patientId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.invoice.email')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{invoice.patient.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.invoice.phone')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{invoice.patient.phoneNumber}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.invoice.address')}</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {invoice.patient.address}, {invoice.patient.city}, {invoice.patient.state} {invoice.patient.zipCode}
                </p>
              </div>
              {invoice.patient.insurance && (
                <div className="sm:col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('admin.invoice.insuranceInformation')}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {invoice.patient.insurance.provider} - {invoice.patient.insurance.policyNumber} ({invoice.patient.insurance.coverageType})
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.invoice.invoiceItems')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.description')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.category')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.qty')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.unitPrice')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 ">{t(`admin.billing.cat.${item.category}`)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.invoice.paymentHistory')}</h2>
            </div>
            {invoice.payments.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{t('admin.invoice.noPaymentsRecordedYet')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.date')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.method')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.reference')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.processedBy')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{formatDateTime(payment.processedAt)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{tEnum(payment.method)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{payment.referenceNumber || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{payment.processedBy}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400 text-right">+{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <MobileMoneyHistory invoiceId={invoice.id} refreshKey={mobileMoneyRefresh} />
        </div>

        {/* Sidebar - Invoice Summary */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.invoice.invoiceSummary')}</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t('admin.invoice.subtotal')}</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.invoice.tax')}</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              {invoice.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('admin.invoice.discount')}</span>
                  <span className="text-red-600 dark:text-red-400">-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900 dark:text-white">{t('admin.invoice.total')}</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(invoice.total)}</span>
                </div>
              </div>
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>{t('admin.invoice.paid')}</span>
                <span>{formatCurrency(invoice.paidAmount)}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                <div className="flex justify-between font-bold text-lg">
                  <span className={invoice.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                    {t('admin.invoice.balanceDue')}
                  </span>
                  <span className={invoice.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                    {formatCurrency(invoice.balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Due Date */}
          {invoice.dueDate && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin.invoice.dueDate')}</h2>
              <p className={`text-lg font-medium ${
                new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {formatDate(invoice.dueDate)}
              </p>
              {new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID' && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{t('admin.invoice.overdue')}</p>
              )}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin.invoice.notes')}</h2>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {showMobileMoney && (
        <MobileMoneyPayment
          isOpen
          invoice={{
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            balance: invoice.balance,
            patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
            patientPhone: invoice.patient.phoneNumber,
          }}
          canSimulate={user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST'}
          onFinished={() => {
            fetchInvoice();
            setMobileMoneyRefresh((n) => n + 1);
          }}
          onClose={() => setShowMobileMoney(false)}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.invoice.recordPayment')}</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.invoice.amount')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max={invoice.balance}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('admin.invoice.balanceDueValue', { amount: formatCurrency(invoice.balance) })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.invoice.paymentMethod')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
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
                  {t('admin.invoice.referenceNumber')}
                </label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  placeholder={t('admin.invoice.transactionIdCheckNumberEtc')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.invoice.notes')}
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('admin.invoice.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || paymentForm.amount <= 0}
                  className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? t('admin.invoice.processing') : t('admin.invoice.recordPayment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, InvoiceDetail, PaymentMethod } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { MobileMoneyPayment, MobileMoneyHistory } from '@/components/payments';
import { isInsured, patientDue } from '@/lib/insurance';
import type { InvoiceRefund } from '@/lib/cash-desk';
import { NoTillBanner, ReceiptReadyBanner, RefundStatusBadge, smallBtn, useCashDeskPdf, useMyTill } from '@/components/cash-desk/ui';
import { RefundRequestDialog } from '@/components/cash-desk/dialogs';
import { useToast } from '@/components/toast';

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
  const [paymentError, setPaymentError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  // Cash desk: payments go into the cashier's open till and get a numbered receipt
  const { session: till, loading: tillLoading } = useMyTill();
  const cashDeskPdf = useCashDeskPdf();
  const toast = useToast();
  const [lastReceipt, setLastReceipt] = useState<{ paymentId: string; receiptNumber: string | null; amount: number } | null>(null);
  const [refunds, setRefunds] = useState<InvoiceRefund[]>([]);
  const [requestingRefund, setRequestingRefund] = useState(false);

  useEffect(() => {
    fetchInvoice();
    fetchRefunds();
  }, [invoiceId]);

  const fetchRefunds = async () => {
    try {
      setRefunds(await api.getRefunds({ invoiceId }));
    } catch {
      setRefunds([]);
    }
  };

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
    if (!invoice || !user || !till) return;

    try {
      setSubmitting(true);
      setPaymentError('');
      const { payment } = await api.addPayment(invoice.id, {
        amount: paymentForm.amount,
        method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber || undefined,
        notes: paymentForm.notes || undefined,
      });
      setShowPaymentModal(false);
      setPaymentForm(initialPaymentForm);
      setLastReceipt({ paymentId: payment.id, receiptNumber: payment.receiptNumber ?? null, amount: Number(payment.amount) });
      fetchInvoice(); // Refresh data
    } catch (err) {
      console.error('Error adding payment:', err);
      setPaymentError(err instanceof Error && err.message ? err.message : t('admin.invoice.addPaymentFailed'));
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


  const insured = invoice ? isInsured(invoice) : false;
  const dueFromPatient = invoice ? patientDue(invoice) : 0;
  const canTakePatientPayment = Boolean(invoice) && invoice!.status !== 'PAID' && invoice!.status !== 'CANCELLED' && dueFromPatient > 0;
  // What the patient paid (desk and mobile money) less refunds still standing: the most that can be given back
  const patientPayments = invoice ? invoice.payments.filter((p) => p.source !== 'INSURER') : [];
  const refundable = Math.max(
    0,
    patientPayments.reduce((sum, p) => sum + Number(p.amount), 0) - refunds.filter((r) => r.status !== 'REJECTED').reduce((sum, r) => sum + r.amount, 0)
  );

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
          {canTakePatientPayment && (
            <button
              onClick={() => setShowMobileMoney(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-amber-400 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              {t('pay.title')}
            </button>
          )}
          {canTakePatientPayment && (
            <button
              onClick={() => {
                setPaymentForm({ ...initialPaymentForm, amount: dueFromPatient });
                setPaymentError('');
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

      {lastReceipt && <ReceiptReadyBanner {...lastReceipt} onDismiss={() => setLastReceipt(null)} />}

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

          {/* Tiers payant */}
          {insured && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ins.invoice.title')}</h2>
                  {invoice.payer && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {invoice.payer.name}
                      {invoice.coverage ? ` · ${t('ins.coverage.member')} ${invoice.coverage.memberNumber}` : ''}
                      {invoice.preAuth ? ` · ${t('ins.preAuth.short')} ${invoice.preAuth.number}` : ''}
                    </p>
                  )}
                </div>
                {invoice.claim ? (
                  <Link href={`/dashboard/claims/${invoice.claim.id}`} className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline">
                    {t('ins.invoice.onClaim', { number: invoice.claim.number, status: t(`ins.claimStatus.${invoice.claim.status}`) })}
                  </Link>
                ) : (
                  (invoice.insurerBalance ?? 0) > 0 && (
                    <span className="text-sm text-amber-700 dark:text-amber-400">{t('ins.invoice.notClaimed')}</span>
                  )
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.insurerShare')}</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-400">{formatCurrency(invoice.insurerShare ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.insurerPaid')}</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(invoice.insurerPaid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.insurerBalance')}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(invoice.insurerBalance ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.patientShare')}</p>
                  <p className="font-semibold text-lime-700 dark:text-lime-400">{formatCurrency(invoice.patientShare ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.patientPaid')}</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(invoice.patientPaid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.patientBalance')}</p>
                  <p className={`font-semibold ${dueFromPatient > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{formatCurrency(dueFromPatient)}</p>
                </div>
              </div>
            </div>
          )}

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
                    {insured && (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('ins.insurerShare')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('ins.patientShare')}</th>
                      </>
                    )}
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
                      {insured && (
                        <>
                          <td className="px-4 py-3 text-sm text-blue-700 dark:text-blue-400 text-right">{formatCurrency(item.coveredAmount ?? 0)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(item.patientAmount ?? item.total)}</td>
                        </>
                      )}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('cd.receiptNumber')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.method')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.reference')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.processedBy')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.invoice.amount')}</th>
                      <th className="px-4 py-3"><span className="sr-only">{t('cd.receipt')}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{formatDateTime(payment.processedAt)}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">{payment.receiptNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {tEnum(payment.method)}
                          {payment.source === 'INSURER' && (
                            <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                              {payment.claimId ? (
                                <Link href={`/dashboard/claims/${payment.claimId}`} className="hover:underline">{t('ins.payment.insurer')}</Link>
                              ) : t('ins.payment.insurer')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{payment.referenceNumber || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{payment.processedBy}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400 text-right">+{formatCurrency(payment.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          {payment.receiptNumber && (
                            <button type="button" className={smallBtn} onClick={() => cashDeskPdf.receipt(payment.id, payment.receiptNumber)}>{t('cd.printReceipt')}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <MobileMoneyHistory invoiceId={invoice.id} refreshKey={mobileMoneyRefresh} />

          {/* Refunds to the patient (approved by an admin, paid at a till) */}
          {(refunds.length > 0 || refundable > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('cd.refunds')}</h2>
                {refundable > 0 && (
                  <button type="button" className={smallBtn} onClick={() => setRequestingRefund(true)}>{t('cd.refund.requestButton')}</button>
                )}
              </div>
              {refunds.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{t('cd.refund.none')}</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {refunds.map((r) => (
                    <li key={r.id} className="p-4 flex flex-wrap items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          <span className="font-mono text-xs">{r.number}</span> · {formatCurrency(r.amount)} · {t(`cd.method.${r.method}`)}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400">{r.reason}</p>
                        <p className="text-xs text-gray-500">
                          {t('cd.refund.requestedLine', { name: r.requestedBy?.name ?? '—', date: formatDateTime(r.requestedAt) })}
                          {r.decisionNote ? ` · ${r.decisionNote}` : ''}
                          {r.paidAt ? ` · ${t('cd.refund.paidLine', { name: r.paidBy?.name ?? '—', date: formatDateTime(r.paidAt) })}` : ''}
                        </p>
                      </div>
                      <RefundStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
              {insured && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('ins.insurerBalance')}</span>
                  <span className="text-blue-700 dark:text-blue-400">{formatCurrency(invoice.insurerBalance ?? 0)}</span>
                </div>
              )}
              {insured && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('ins.patientBalance')}</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(dueFromPatient)}</span>
                </div>
              )}
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
            balance: dueFromPatient,
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

      {requestingRefund && (
        <RefundRequestDialog
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          refundable={refundable}
          payments={patientPayments.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber, amount: Number(p.amount), method: p.method, processedAt: p.processedAt }))}
          onClose={() => setRequestingRefund(false)}
          onDone={(refund) => {
            setRequestingRefund(false);
            toast.success(t('cd.refund.requestedToast', { number: refund.number }));
            fetchRefunds();
          }}
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
              {!tillLoading && !till && <NoTillBanner />}
              {paymentError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{paymentError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.invoice.amount')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max={dueFromPatient}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {insured
                    ? t('ins.payment.patientDueValue', { amount: formatCurrency(dueFromPatient) })
                    : t('admin.invoice.balanceDueValue', { amount: formatCurrency(invoice.balance) })}
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
                  disabled={submitting || paymentForm.amount <= 0 || !till}
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

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, PrescriptionDetail } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { PermissionGate } from '@/components/permission-gate';

export default function PrescriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [prescription, setPrescription] = useState<PrescriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispensing, setDispensing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const prescriptionId = params.id as string;

  useEffect(() => {
    const fetchPrescription = async () => {
      try {
        setLoading(true);
        const data = await api.getPrescriptionDetail(prescriptionId);
        setPrescription(data);
      } catch (err) {
        console.error('Error fetching prescription:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch prescription');
      } finally {
        setLoading(false);
      }
    };

    if (prescriptionId) {
      fetchPrescription();
    }
  }, [prescriptionId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      case 'DISPENSED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'PARTIALLY_DISPENSED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (!prescription) return;
    const pendingItems = prescription.items
      .filter((item) => !item.isDispensed)
      .map((item) => item.id);
    setSelectedItems(pendingItems);
  };

  const handleDispense = async () => {
    if (selectedItems.length === 0) {
      toast.error('No items selected', 'Please select items to dispense');
      return;
    }

    try {
      setDispensing(true);
      await api.dispensePrescription(prescriptionId, {
        itemIds: selectedItems,
        dispensedBy: `${user?.firstName} ${user?.lastName}`,
      });
      toast.success('Items dispensed', 'Selected medications have been dispensed successfully');

      // Refresh prescription data
      const data = await api.getPrescriptionDetail(prescriptionId);
      setPrescription(data);
      setSelectedItems([]);
    } catch (err) {
      console.error('Error dispensing:', err);
      toast.error('Dispense failed', err instanceof Error ? err.message : 'Failed to dispense items');
    } finally {
      setDispensing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this prescription? This action cannot be undone.')) {
      return;
    }

    try {
      await api.cancelPrescription(prescriptionId);
      toast.success('Prescription cancelled', 'The prescription has been cancelled');
      router.push('/dashboard/prescriptions');
    } catch (err) {
      console.error('Error cancelling:', err);
      toast.error('Cancel failed', err instanceof Error ? err.message : 'Failed to cancel prescription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading prescription...</p>
        </div>
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Prescription not found'}</p>
          <Link
            href="/dashboard/prescriptions"
            className="text-lime-600 hover:text-lime-700 font-medium"
          >
            Back to Prescriptions
          </Link>
        </div>
      </div>
    );
  }

  const canDispense = prescription.status === 'ACTIVE' || prescription.status === 'PARTIALLY_DISPENSED';
  const canCancel = prescription.status === 'ACTIVE' && prescription.dispensedItemCount === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/prescriptions"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prescription Details</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Created on {formatDate(prescription.createdAt)}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(prescription.status)}`}>
          {prescription.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Medications */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Medications</h2>
              <PermissionGate permission="prescriptions:dispense">
                {canDispense && prescription.pendingItemCount > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-lime-600 hover:text-lime-700"
                  >
                    Select All Pending
                  </button>
                )}
              </PermissionGate>
            </div>

            <div className="space-y-4">
              {prescription.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${
                    item.isDispensed
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <PermissionGate permission="prescriptions:dispense">
                        {!item.isDispensed && canDispense && (
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleItemSelect(item.id)}
                            className="mt-1 w-4 h-4 text-lime-600 rounded"
                          />
                        )}
                      </PermissionGate>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{item.medication.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.medication.genericName} - {item.medication.strength}
                        </p>
                        <div className="mt-2 text-sm">
                          <p><span className="font-medium">Dosage:</span> {item.dosage}</p>
                          <p><span className="font-medium">Frequency:</span> {item.frequency}</p>
                          <p><span className="font-medium">Duration:</span> {item.duration}</p>
                          <p><span className="font-medium">Quantity:</span> {item.quantity} units</p>
                          {item.instructions && (
                            <p className="mt-1 text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Instructions:</span> {item.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.itemTotal)}</p>
                      {item.isDispensed ? (
                        <span className="text-xs text-green-600 dark:text-green-400">Dispensed</span>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Stock: {item.medication.stockQuantity}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Warnings */}
                  {(item.medication.contraindications.length > 0 || item.medication.sideEffects.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      {item.medication.contraindications.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Contraindications</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {item.medication.contraindications.join(', ')}
                          </p>
                        </div>
                      )}
                      {item.medication.sideEffects.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Side Effects</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {item.medication.sideEffects.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total and Actions */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium text-gray-900 dark:text-white">Total Cost</span>
                <span className="text-xl font-bold text-lime-600">{formatCurrency(prescription.totalCost)}</span>
              </div>

              <PermissionGate permission="prescriptions:dispense">
                {canDispense && selectedItems.length > 0 && (
                  <button
                    onClick={handleDispense}
                    disabled={dispensing}
                    className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {dispensing ? 'Dispensing...' : `Dispense ${selectedItems.length} Item(s)`}
                  </button>
                )}
              </PermissionGate>
            </div>
          </div>

          {/* Notes */}
          {prescription.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Notes</h2>
              <p className="text-gray-600 dark:text-gray-400">{prescription.notes}</p>
            </div>
          )}

          {/* Consultation Reference */}
          {prescription.consultation && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Related Consultation</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-medium">Chief Complaint:</span> {prescription.consultation.chiefComplaint}
              </p>
              {prescription.consultation.diagnosis.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Diagnosis:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {prescription.consultation.diagnosis.map((d, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Link
                href={`/dashboard/records/${prescription.consultation.id}`}
                className="inline-block mt-3 text-sm text-lime-600 hover:text-lime-700"
              >
                View Full Consultation
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Patient</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {prescription.patient.firstName} {prescription.patient.lastName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{prescription.patient.patientId}</p>
              </div>
              <div className="text-sm">
                <p className="text-gray-600 dark:text-gray-400">{prescription.patient.email}</p>
                <p className="text-gray-600 dark:text-gray-400">{prescription.patient.phoneNumber}</p>
              </div>
              {prescription.patient.allergies.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Allergies</p>
                  <div className="flex flex-wrap gap-1">
                    {prescription.patient.allergies.map((allergy, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Link
                href={`/dashboard/patients/${prescription.patient.id}`}
                className="inline-block text-sm text-lime-600 hover:text-lime-700"
              >
                View Patient Profile
              </Link>
            </div>
          </div>

          {/* Doctor Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Prescribing Doctor</h2>
            <div className="space-y-2">
              <p className="font-medium text-gray-900 dark:text-white">
                Dr. {prescription.doctor.firstName} {prescription.doctor.lastName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{prescription.doctor.department}</p>
              {prescription.doctor.specializations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {prescription.doctor.specializations.map((spec, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status Info */}
          {prescription.dispensedAt && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dispensing Info</h2>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Dispensed at:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formatDate(prescription.dispensedAt)}</span>
                </p>
                {prescription.dispensedBy && (
                  <p>
                    <span className="text-gray-500 dark:text-gray-400">Dispensed by:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{prescription.dispensedBy}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <PermissionGate permission="prescriptions:edit">
            {canCancel && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
                <button
                  onClick={handleCancel}
                  className="w-full py-2 text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  Cancel Prescription
                </button>
              </div>
            )}
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  type CashSessionSummary,
  type PendingPrescription,
  type PharmacySale,
  type SaleQuote,
  type StockMedication,
} from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { PrescriptionSafetyInfo } from '@/components/clinical-safety/safety';
import { useToast } from '@/components/toast';
import {
  CloseTillDialog,
  ErrorBox,
  ExpiryBadge,
  OpenTillDialog,
  PatientPicker,
  PaymentDialog,
  RxBadge,
  TillBar,
  cancelBtn,
  cardClass,
  inputClass,
  labelClass,
  messageOf,
  primaryBtn,
  smallBtn,
  useMethodLabel,
  usePharmacyPdf,
  useTillToasts,
  type PaymentChoice,
  type PickedPatient,
} from '@/components/pharmacy';
import { addToCart, cartTotals, discountNeedsAdmin, externalRxProblem, localDateString } from '@/lib/pharmacy-pos';

interface CartItem {
  medicationId: string;
  name: string;
  unitPrice: number;
  requiresRx: boolean;
  sellable: number;
  quantity: number;
  prescriptionItemId?: string;
}

type CustomerMode = 'walkin' | 'patient';
type RxMode = 'hospital' | 'external';

// useSearchParams needs a Suspense boundary for static rendering
export default function PharmacyPosPage() {
  return (
    <Suspense fallback={null}>
      <PharmacyPos />
    </Suspense>
  );
}

function PharmacyPos() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tillToasts = useTillToasts();
  const openPdf = usePharmacyPdf();
  const methodLabel = useMethodLabel();

  // Till
  const [session, setSession] = useState<CashSessionSummary | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [tillDialog, setTillDialog] = useState<'open' | 'close' | null>(null);
  const refreshSession = useCallback(() => {
    api
      .getCurrentCashSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setSessionLoading(false));
  }, []);
  useEffect(() => refreshSession(), [refreshSession]);

  // Medication search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockMedication[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const mine = ++searchSeq.current;
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .getPharmacyStock({ search: q })
        .then((meds) => mine === searchSeq.current && setResults(meds.slice(0, 8)))
        .catch(() => mine === searchSeq.current && setResults([]))
        .finally(() => mine === searchSeq.current && setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const visibleResults = q.length >= 2 ? results : [];

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [allergyReason, setAllergyReason] = useState('');
  const [quote, setQuote] = useState<SaleQuote | null>(null);

  // Customer & prescription
  const [customerMode, setCustomerMode] = useState<CustomerMode>('walkin');
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [rxMode, setRxMode] = useState<RxMode>('hospital');
  const [pending, setPending] = useState<PendingPrescription[]>([]);
  const [prescription, setPrescription] = useState<PendingPrescription | null>(null);
  const [extPrescriber, setExtPrescriber] = useState('');
  const [extDate, setExtDate] = useState('');
  const [extRef, setExtRef] = useState('');

  // Payment
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<PharmacySale | null>(null);

  const addMedication = useCallback(
    (med: StockMedication) => {
      if (med.sellableQuantity <= 0) {
        toast.warning(t('pos.cart.outOfStock', { name: med.name }));
        return;
      }
      setCart((prev) =>
        addToCart(
          prev,
          { medicationId: med.id, name: `${med.name} ${med.strength}`.trim(), unitPrice: med.unitPrice, requiresRx: med.requiresRx, sellable: med.sellableQuantity, quantity: 1 },
          med.sellableQuantity
        )
      );
      setQuery('');
      setResults([]);
      searchRef.current?.focus();
    },
    [t, toast]
  );

  const setQuantity = (medicationId: string, quantity: number) =>
    setCart((prev) => prev.map((l) => (l.medicationId === medicationId ? { ...l, quantity: Math.max(1, Math.floor(quantity) || 1) } : l)));
  const removeLine = (medicationId: string) => setCart((prev) => prev.filter((l) => l.medicationId !== medicationId));

  // Pending in-house prescriptions of the chosen patient
  useEffect(() => {
    if (!patient) return;
    let live = true;
    api
      .getPendingPharmacyPrescriptions()
      .then((list) => live && setPending(list.filter((p) => p.patient.id === patient.id)))
      .catch(() => live && setPending([]));
    return () => {
      live = false;
    };
  }, [patient]);

  /** Link a hospital prescription: its lines in the cart point to the prescribed items */
  const attachPrescription = useCallback((rx: PendingPrescription, fillCart: boolean) => {
    setPrescription(rx);
    setRxMode('hospital');
    setCart((prev) => {
      let next = prev.map((line) => {
        const item = rx.items.find((i) => !i.isDispensed && i.medicationId === line.medicationId);
        return item ? { ...line, prescriptionItemId: item.id } : line;
      });
      if (fillCart) {
        for (const item of rx.items.filter((i) => !i.isDispensed)) {
          if (next.some((l) => l.medicationId === item.medicationId)) continue;
          next = [
            ...next,
            {
              medicationId: item.medicationId,
              name: `${item.name} ${item.strength}`.trim(),
              unitPrice: 0, // filled in by the quote
              requiresRx: true,
              sellable: item.stockSellable,
              quantity: Math.max(1, item.quantity),
              prescriptionItemId: item.id,
            },
          ];
        }
      }
      return next;
    });
  }, []);

  const detachPrescription = () => {
    setPrescription(null);
    setCart((prev) => prev.map((line) => ({ ...line, prescriptionItemId: undefined })));
  };

  // "Délivrer et encaisser" from the prescriptions page: ?prescriptionId=…
  const prefillId = searchParams.get('prescriptionId');
  const prefilled = useRef(false);
  useEffect(() => {
    if (!prefillId || prefilled.current) return;
    prefilled.current = true;
    api
      .getPendingPharmacyPrescriptions()
      .then((list) => {
        const rx = list.find((p) => p.id === prefillId);
        if (!rx) {
          toast.warning(t('pos.rx.notPending'));
          return;
        }
        setCustomerMode('patient');
        setPatient({ id: rx.patient.id, patientId: rx.patient.patientId, name: rx.patient.name });
        setPending(list.filter((p) => p.patient.id === rx.patient.id));
        attachPrescription(rx, true);
      })
      .catch((err) => toast.error(t('pos.loadFailed'), messageOf(err, '')));
  }, [prefillId, attachPrescription, t, toast]);

  // Quote (stock check, prices, prescription need), debounced on cart changes
  const quotedPatientId = customerMode === 'patient' && patient ? patient.id : null;
  const quoteKey = useMemo(
    () => JSON.stringify({ items: cart.map((l) => [l.medicationId, l.quantity]), rx: prescription?.id ?? null, patient: quotedPatientId }),
    [cart, prescription, quotedPatientId]
  );
  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      api
        .quotePharmacySale({
          items: cart.map((l) => ({ medicationId: l.medicationId, quantity: l.quantity })),
          ...(prescription ? { prescriptionId: prescription.id } : {}),
          ...(quotedPatientId ? { patientId: quotedPatientId } : {}),
        })
        .then((res) => {
          if (!live) return;
          setQuote(res);
          // Prices and stock come from the server
          setCart((prev) =>
            prev.map((line) => {
              const q = res.lines.find((l) => l.medicationId === line.medicationId);
              return q && (q.unitPrice !== line.unitPrice || q.sellable !== line.sellable || q.requiresRx !== line.requiresRx)
                ? { ...line, unitPrice: q.unitPrice, sellable: q.sellable, requiresRx: q.requiresRx }
                : line;
            })
          );
        })
        .catch(() => live && setQuote(null));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // quoteKey captures what matters in cart and prescription
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const discountAmount = Math.round(Number(discount.replace(/\s/g, '').replace(',', '.')) || 0);
  const totals = cartTotals(cart, discountAmount);
  const warnings = new Map((quote?.lines ?? []).filter((l) => l.warning).map((l) => [l.medicationId, l]));
  // Drugs the patient is allergic to: selling them needs the pharmacist's reason
  const allergyLines = (quote?.lines ?? []).filter((l) => l.allergy);
  const allergyById = new Map(allergyLines.map((l) => [l.medicationId, l.allergy as string]));
  const rxRequired = quote ? quote.rxRequired : cart.some((l) => l.requiresRx && !l.prescriptionItemId);
  const uncovered = cart.filter((l) => l.requiresRx && !l.prescriptionItemId);
  const extProblem = externalRxProblem(extPrescriber, extDate);
  const discountTooHigh = discountNeedsAdmin(totals.discount, totals.subtotal, user?.role);

  const checkBeforePay = (): string | null => {
    if (!session) return t('pos.till.openFirst');
    if (cart.length === 0) return t('pos.cart.empty');
    if (warnings.size > 0) return t('pos.cart.fixStock');
    if (discountTooHigh) return t('pos.discount.tooHigh');
    if (allergyLines.length > 0 && !allergyReason.trim()) return t('pos.allergy.reasonRequired');
    if (customerMode === 'patient' && !patient) return t('pos.customer.pickPatient');
    if (rxRequired && extProblem) {
      if (extProblem === 'FUTURE') return t('pos.rx.ext.future');
      if (extProblem === 'TOO_OLD') return t('pos.rx.ext.tooOld');
      return t('pos.rx.required', { list: uncovered.map((l) => l.name).join(', ') || t('pos.rx.someItems') });
    }
    return null;
  };

  const startPayment = () => {
    const problem = checkBeforePay();
    if (problem) return setError(problem);
    setError('');
    setPayError('');
    setPaying(true);
  };

  const pay = async (choice: PaymentChoice) => {
    setSaving(true);
    setPayError('');
    try {
      const sale = await api.createPharmacySale({
        items: cart.map((l) => ({ medicationId: l.medicationId, quantity: l.quantity, ...(l.prescriptionItemId ? { prescriptionItemId: l.prescriptionItemId } : {}) })),
        ...(customerMode === 'patient' && patient ? { patientId: patient.id } : {}),
        ...(customerMode === 'walkin' && customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerMode === 'walkin' && customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(prescription ? { prescriptionId: prescription.id } : {}),
        ...(rxRequired && !extProblem ? { externalPrescriber: extPrescriber.trim(), externalRxDate: extDate, ...(extRef.trim() ? { externalRxRef: extRef.trim() } : {}) } : {}),
        ...(totals.discount > 0 ? { discount: totals.discount } : {}),
        ...(allergyLines.length > 0 && allergyReason.trim() ? { allergyOverrideReason: allergyReason.trim() } : {}),
        ...choice,
      });
      setDone(sale);
      setPaying(false);
      setSaving(false);
      refreshSession();
    } catch (err) {
      setPayError(messageOf(err, t('pos.actionFailed')));
      setSaving(false);
    }
  };

  const newSale = () => {
    setDone(null);
    setCart([]);
    setDiscount('');
    setAllergyReason('');
    setQuote(null);
    setCustomerMode('walkin');
    setPatient(null);
    setCustomerName('');
    setCustomerPhone('');
    setPrescription(null);
    setPending([]);
    setExtPrescriber('');
    setExtDate('');
    setExtRef('');
    setError('');
    if (prefillId) router.replace('/dashboard/pharmacy/pos');
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto mt-6">
        <div className={`${cardClass} p-8 text-center space-y-4`}>
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('pos.done.title', { number: done.number })}</h1>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(done.total)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{methodLabel(done.paymentMethod)}</p>
          {done.paymentMethod === 'CASH' && done.changeGiven !== null && (
            <p className="text-lg font-semibold text-lime-700 dark:text-lime-400">{t('pos.done.change', { amount: formatCurrency(done.changeGiven) })}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button type="button" className={cancelBtn} onClick={() => openPdf('receipt', done.id)}>{t('pos.done.print')}</button>
            <button type="button" className={primaryBtn} onClick={newSale} autoFocus>{t('pos.done.newSale')}</button>
          </div>
          <Link href={`/dashboard/pharmacy/sales?sale=${done.id}`} className="block text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('pos.done.viewSale')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pos.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{t('pos.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/pharmacy/prescriptions" className={cancelBtn}>{t('nav.pharmacyPrescriptions')}</Link>
          <Link href="/dashboard/pharmacy/sales" className={cancelBtn}>{t('nav.pharmacySales')}</Link>
        </div>
      </div>

      <TillBar session={session} loading={sessionLoading} onOpen={() => setTillDialog('open')} onClose={() => setTillDialog('close')} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Search and cart */}
        <div className="lg:col-span-3 space-y-4">
          <div className={`${cardClass} p-4`}>
            <label className={labelClass} htmlFor="pos-search">{t('pos.search.label')}</label>
            <div className="relative">
              <input
                id="pos-search"
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && visibleResults[0]) {
                    e.preventDefault();
                    addMedication(visibleResults[0]);
                  } else if (e.key === 'Escape') {
                    setQuery('');
                  }
                }}
                placeholder={t('pos.search.placeholder')}
                className={inputClass}
                autoFocus
                autoComplete="off"
              />
              {q.length >= 2 && (
                <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  {searching && visibleResults.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">{t('pos.searching')}</li>}
                  {!searching && visibleResults.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">{t('pos.noResult')}</li>}
                  {visibleResults.map((med, index) => (
                    <li key={med.id}>
                      <button
                        type="button"
                        onClick={() => addMedication(med)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${index === 0 ? 'bg-lime-50/60 dark:bg-lime-900/10' : ''}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {med.name} {med.strength} {med.requiresRx && <RxBadge />}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(med.unitPrice)}</span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          <span>{med.genericName} · {med.dosageForm}</span>
                          <span className={med.sellableQuantity <= 0 ? 'text-red-600 font-medium' : med.isLow ? 'text-orange-600 font-medium' : ''}>
                            {t('pos.search.stock', { count: med.sellableQuantity })}
                          </span>
                          {med.nearestExpiry && <ExpiryBadge date={med.nearestExpiry} />}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('pos.search.hint')}</p>
          </div>

          <div className={cardClass}>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('pos.cart.title')}</h2>
              {cart.length > 0 && (
                <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setCart([])}>{t('pos.cart.clear')}</button>
              )}
            </div>
            {cart.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('pos.cart.emptyHint')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {cart.map((line) => {
                  const warning = warnings.get(line.medicationId);
                  return (
                    <li key={line.medicationId} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[10rem]">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {line.name} {line.requiresRx && <RxBadge />}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatCurrency(line.unitPrice)} · {t('pos.search.stock', { count: line.sellable })}
                            {line.prescriptionItemId && <span className="ml-2 text-lime-700 dark:text-lime-400">{t('pos.cart.prescribed')}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" className={smallBtn} onClick={() => setQuantity(line.medicationId, line.quantity - 1)} aria-label={t('pos.cart.less')}>−</button>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => setQuantity(line.medicationId, Number(e.target.value))}
                            className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            aria-label={t('pos.cart.quantity')}
                          />
                          <button type="button" className={smallBtn} onClick={() => setQuantity(line.medicationId, line.quantity + 1)} aria-label={t('pos.cart.more')}>+</button>
                        </div>
                        <p className="w-28 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(line.quantity * line.unitPrice)}</p>
                        <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => removeLine(line.medicationId)} aria-label={t('pos.cart.remove')}>
                          ✕
                        </button>
                      </div>
                      {allergyById.has(line.medicationId) && (
                        <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">
                          {t('pos.allergy.line', { allergy: allergyById.get(line.medicationId) ?? '' })}
                        </p>
                      )}
                      {warning && (
                        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{t('pos.cart.notEnough', { count: warning.sellable })}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Customer, prescription, totals */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`${cardClass} p-4 space-y-3`}>
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('pos.customer.title')}</h2>
            <div className="flex gap-2">
              {(['walkin', 'patient'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={customerMode === mode}
                  onClick={() => {
                    setCustomerMode(mode);
                    if (mode === 'walkin') {
                      setPatient(null);
                      setPending([]);
                      detachPrescription();
                    }
                  }}
                  className={`flex-1 px-3 py-1.5 rounded-lg border text-sm font-medium ${
                    customerMode === mode ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {t(`pos.customer.${mode}`)}
                </button>
              ))}
            </div>
            {customerMode === 'walkin' ? (
              <div className="grid grid-cols-2 gap-2">
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('pos.customer.name')} className={inputClass} aria-label={t('pos.customer.name')} />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t('pos.customer.phone')} className={inputClass} aria-label={t('pos.customer.phone')} />
              </div>
            ) : patient ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-lime-50 dark:bg-lime-900/20">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{patient.patientId}</p>
                </div>
                <button
                  type="button"
                  className="text-sm text-lime-700 dark:text-lime-400 hover:underline"
                  onClick={() => {
                    setPatient(null);
                    setPending([]);
                    detachPrescription();
                  }}
                >
                  {t('pos.change')}
                </button>
              </div>
            ) : (
              <PatientPicker onPick={setPatient} />
            )}
          </div>

          {(rxRequired || prescription || pending.length > 0) && (
            <div className={`${cardClass} p-4 space-y-3 ${rxRequired ? 'border-purple-300 dark:border-purple-700' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('pos.rx.title')}</h2>
                {rxRequired && <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{t('pos.rx.needed')}</span>}
              </div>
              {rxRequired && uncovered.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-300">{t('pos.rx.forItems', { list: uncovered.map((l) => l.name).join(', ') })}</p>
              )}
              <div className="flex gap-2">
                {(['hospital', 'external'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={rxMode === mode}
                    onClick={() => setRxMode(mode)}
                    className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      rxMode === mode ? 'border-purple-500 bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {t(`pos.rx.${mode}`)}
                  </button>
                ))}
              </div>
              {rxMode === 'hospital' ? (
                <div className="space-y-2">
                  {customerMode !== 'patient' || !patient ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.rx.pickPatientFirst')}</p>
                  ) : prescription ? (
                    <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t('pos.rx.byDoctor', { name: prescription.doctorName })}</p>
                        <button type="button" className="text-xs text-purple-700 dark:text-purple-300 hover:underline" onClick={detachPrescription}>{t('pos.rx.detach')}</button>
                      </div>
                      <ul className="text-xs text-gray-600 dark:text-gray-300">
                        {prescription.items.filter((i) => !i.isDispensed).map((i) => (
                          <li key={i.id}>• {i.name} {i.strength} — {i.dosage}, {i.frequency}, {i.duration} ({t('pos.rx.qty', { count: i.quantity })})</li>
                        ))}
                      </ul>
                      <button type="button" className="text-xs text-purple-700 dark:text-purple-300 hover:underline" onClick={() => attachPrescription(prescription, true)}>{t('pos.rx.addItems')}</button>
                      <PrescriptionSafetyInfo prescriptionId={prescription.id} />
                    </div>
                  ) : pending.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.rx.nonePending')}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {pending.map((rx) => (
                        <li key={rx.id}>
                          <button type="button" onClick={() => attachPrescription(rx, true)} className="w-full text-left p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <span className="block text-sm font-medium text-gray-900 dark:text-white">{t('pos.rx.byDoctor', { name: rx.doctorName })}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{rx.items.filter((i) => !i.isDispensed).map((i) => i.name).join(', ')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rxRequired && prescription && <p className="text-xs text-purple-700 dark:text-purple-300">{t('pos.rx.stillNeeded')}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <input value={extPrescriber} onChange={(e) => setExtPrescriber(e.target.value)} placeholder={t('pos.rx.ext.prescriber')} className={inputClass} aria-label={t('pos.rx.ext.prescriber')} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5" htmlFor="ext-date">{t('pos.rx.ext.date')}</label>
                      <input id="ext-date" type="date" max={localDateString()} value={extDate} onChange={(e) => setExtDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5" htmlFor="ext-ref">{t('pos.rx.ext.ref')}</label>
                      <input id="ext-ref" value={extRef} onChange={(e) => setExtRef(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  {extProblem === 'TOO_OLD' && <p className="text-xs text-red-600">{t('pos.rx.ext.tooOld')}</p>}
                  {extProblem === 'FUTURE' && <p className="text-xs text-red-600">{t('pos.rx.ext.future')}</p>}
                </div>
              )}
            </div>
          )}

          {allergyLines.length > 0 && (
            <div className="rounded-xl border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t('pos.allergy.title')}</p>
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc pl-5">
                {allergyLines.map((l) => (
                  <li key={l.medicationId}>{t('pos.allergy.item', { name: l.name, allergy: l.allergy ?? '' })}</li>
                ))}
              </ul>
              <label htmlFor="pos-allergy-reason" className="block text-sm text-red-800 dark:text-red-200">{t('pos.allergy.reason')}</label>
              <textarea
                id="pos-allergy-reason"
                rows={2}
                value={allergyReason}
                onChange={(e) => setAllergyReason(e.target.value)}
                className="w-full rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>
          )}

          <div className={`${cardClass} p-4 space-y-3`}>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-300">{t('pos.subtotal')}</dt>
                <dd className="text-gray-900 dark:text-white">{formatCurrency(totals.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>
                  <label htmlFor="pos-discount" className="text-gray-600 dark:text-gray-300">{t('pos.discount.label')}</label>
                </dt>
                <dd>
                  <input
                    id="pos-discount"
                    inputMode="numeric"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="w-28 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </dd>
              </div>
              {discountTooHigh && <p className="text-xs text-red-600">{t('pos.discount.tooHigh')}</p>}
              <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                <dt className="text-lg font-semibold text-gray-900 dark:text-white">{t('pos.total')}</dt>
                <dd className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totals.total)}</dd>
              </div>
            </dl>
            <ErrorBox message={error} />
            <button type="button" className={`${primaryBtn} w-full py-3 text-base font-semibold`} onClick={startPayment} disabled={cart.length === 0}>
              {t('pos.pay.cta', { amount: formatCurrency(totals.total) })}
            </button>
          </div>
        </div>
      </div>

      {paying && <PaymentDialog total={totals.total} saving={saving} error={payError} onClose={() => !saving && setPaying(false)} onConfirm={pay} />}
      {tillDialog === 'open' && (
        <OpenTillDialog
          onClose={() => setTillDialog(null)}
          onOpened={(s) => {
            setTillDialog(null);
            setSession(s);
            tillToasts.opened(s);
            refreshSession();
          }}
        />
      )}
      {tillDialog === 'close' && session && (
        <CloseTillDialog
          session={session}
          onClose={() => setTillDialog(null)}
          onClosed={(s) => {
            setTillDialog(null);
            tillToasts.closed(s);
            refreshSession();
          }}
        />
      )}
    </div>
  );
}

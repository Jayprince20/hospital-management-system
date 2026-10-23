'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, type QueueTicket, type TriageAvpu, type TriageInput, type TriageLevel, type TriageMobility, type TriageScore } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { LevelBadge } from '@/components/queue/ticket-card';
import { LEVEL_BADGE, parseReason, TRIAGE_DISCRIMINATORS, TRIAGE_LEVELS } from '@/lib/queue';

const MOBILITY: TriageMobility[] = ['WALKING', 'WITH_HELP', 'STRETCHER'];
const AVPU: TriageAvpu[] = ['ALERT', 'CONFUSED', 'VOICE', 'PAIN', 'UNRESPONSIVE'];

type VitalKey = 'respiratoryRate' | 'heartRate' | 'systolic' | 'diastolic' | 'temperature' | 'oxygenSaturation' | 'weight';
const VITALS: Array<{ key: VitalKey; label: string; step?: string; min: number; max: number }> = [
  { key: 'respiratoryRate', label: 'q.triage.rr', min: 0, max: 80 },
  { key: 'heartRate', label: 'q.triage.hr', min: 0, max: 250 },
  { key: 'systolic', label: 'q.triage.sbp', min: 0, max: 300 },
  { key: 'diastolic', label: 'q.triage.dbp', min: 0, max: 200 },
  { key: 'temperature', label: 'q.triage.temp', step: '0.1', min: 25, max: 45 },
  { key: 'oxygenSaturation', label: 'q.triage.spo2', min: 0, max: 100 },
  { key: 'weight', label: 'q.triage.weight', step: '0.1', min: 0, max: 400 },
];

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5';

export default function TriagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { t, formatDateTime } = useLanguage();

  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [loadError, setLoadError] = useState('');
  const [complaint, setComplaint] = useState('');
  const [mobility, setMobility] = useState<TriageMobility>('WALKING');
  const [avpu, setAvpu] = useState<TriageAvpu>('ALERT');
  const [trauma, setTrauma] = useState(false);
  const [vitals, setVitals] = useState<Record<VitalKey, string>>({
    respiratoryRate: '', heartRate: '', systolic: '', diastolic: '', temperature: '', oxygenSaturation: '', weight: '',
  });
  const [discriminators, setDiscriminators] = useState<string[]>([]);
  const [score, setScore] = useState<TriageScore | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState(false);
  const [level, setLevel] = useState<TriageLevel | null>(null);
  // Until a colour is picked by hand, the decided colour follows the suggestion
  const [levelTouched, setLevelTouched] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [notes, setNotes] = useState('');
  const [vitalsUnmeasurable, setVitalsUnmeasurable] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const scoreSeq = useRef(0);

  useEffect(() => {
    api
      .getQueueTicket(id)
      .then((tk) => {
        setTicket(tk);
        if (tk.latestTriage?.chiefComplaint) setComplaint(tk.latestTriage.chiefComplaint);
        else if (tk.appointment?.reason) setComplaint(tk.appointment.reason);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : t('q.loadFailed')));
  }, [id, t]);

  const input: TriageInput = useMemo(() => {
    const v: TriageInput['vitals'] = {};
    for (const { key } of VITALS) {
      const raw = vitals[key].replace(',', '.').trim();
      if (raw !== '' && Number.isFinite(Number(raw))) v[key] = Number(raw);
    }
    return { chiefComplaint: complaint.trim(), mobility, avpu, trauma, vitals: v, discriminators };
  }, [complaint, mobility, avpu, trauma, vitals, discriminators]);

  // Live score (debounced): the complaint text doesn't change it, so leave it out of the key
  const scoreKey = JSON.stringify({ ...input, chiefComplaint: '' });
  useEffect(() => {
    const seq = ++scoreSeq.current;
    setScoring(true);
    const timer = setTimeout(() => {
      api
        .scoreTriage({ ...input, chiefComplaint: input.chiefComplaint || '-' })
        .then((res) => {
          if (seq !== scoreSeq.current) return;
          setScore(res);
          setScoreError(false);
        })
        .catch(() => seq === scoreSeq.current && setScoreError(true))
        .finally(() => seq === scoreSeq.current && setScoring(false));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scoreKey captures every input the score depends on
  }, [scoreKey]);

  useEffect(() => {
    if (score && !levelTouched) setLevel(score.suggestedLevel);
  }, [score, levelTouched]);

  // Without any measurement the score is 0 and suggests green: never let that pass silently
  const nothingMeasured = Object.keys(input.vitals).length === 0 && discriminators.length === 0;
  const differs = Boolean(score && level && level !== score.suggestedLevel);
  const canTriage = ticket ? ticket.status === 'WAITING_TRIAGE' || ticket.status === 'WAITING' : false;

  const toggleDiscriminator = (code: string) =>
    setDiscriminators((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const reasonLabel = (code: string) => {
    const r = parseReason(code);
    if (r.kind === 'tews') return t('q.triage.reason.tews', { score: r.score });
    if (r.kind === 'spo2') return t('q.triage.reason.spo2');
    if (r.kind === 'discriminator') return t(`q.disc.${r.code}`);
    return r.code;
  };

  const save = async () => {
    if (!ticket) return;
    if (!input.chiefComplaint) return setError(t('q.triage.complaintRequired'));
    if (!level) return setError(t('q.triage.scoreFailed'));
    if (differs && !overrideReason.trim()) return setError(t('q.triage.overrideRequired'));
    if (nothingMeasured && !vitalsUnmeasurable) return setError(t('q.triage.noVitalsBlock'));
    setSaving(true);
    setError('');
    try {
      const res = await api.triageTicket(ticket.id, {
        ...input,
        level,
        ...(differs ? { overrideReason: overrideReason.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(t('q.triage.saved', { number: res.ticket.number, level: t(`q.level.${level}`) }));
      router.push('/dashboard/queue');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('q.actionFailed'));
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{loadError}</div>
        <Link href="/dashboard/queue" className="text-lime-700 dark:text-lime-400 hover:underline">{t('q.triage.back')}</Link>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="flex justify-center h-48 items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link href="/dashboard/queue" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('q.triage.back')}</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{t('q.triage.title', { number: ticket.number })}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('q.triage.subtitle')}</p>
        </div>
        <p className="text-sm px-3 py-2 rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{t('q.triage.decisionSupport')}</p>
      </div>

      {!canTriage && <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg text-sm">{t('q.triage.notPossible')}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className={card}>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('q.triage.patient')}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {ticket.patient.firstName} {ticket.patient.lastName}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                {' · '}{ticket.patient.patientId}
                {ticket.patient.age !== null && ticket.patient.age !== undefined ? ` · ${t('q.ticket.age', { age: ticket.patient.age })}` : ''}
                {' · '}{t(`q.source.${ticket.source}`)}
              </span>
            </p>
            <p className={`text-sm mt-1 ${ticket.patient.allergies.length ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              {ticket.patient.allergies.length ? t('q.ticket.allergies', { list: ticket.patient.allergies.join(', ') }) : t('q.triage.noAllergies')}
            </p>
          </div>

          <div className={`${card} space-y-4`}>
            <div>
              <label className={labelClass} htmlFor="triage-complaint">{t('q.triage.complaint')}</label>
              <input id="triage-complaint" value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder={t('q.triage.complaintPlaceholder')} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <fieldset>
                <legend className={labelClass}>{t('q.triage.mobility')}</legend>
                <div className="space-y-1">
                  {MOBILITY.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <input type="radio" name="mobility" checked={mobility === m} onChange={() => setMobility(m)} className="text-lime-600 focus:ring-lime-500" />
                      {t(`q.triage.mobility.${m}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className={labelClass}>{t('q.triage.avpu')}</legend>
                <div className="space-y-1">
                  {AVPU.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <input type="radio" name="avpu" checked={avpu === a} onChange={() => setAvpu(a)} className="text-lime-600 focus:ring-lime-500" />
                      {t(`q.triage.avpu.${a}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={trauma} onChange={(e) => setTrauma(e.target.checked)} className="rounded border-gray-300 text-lime-600 focus:ring-lime-500" />
              {t('q.triage.trauma')}
            </label>
          </div>

          <div className={card}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t('q.triage.vitals')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {VITALS.map((v) => (
                <div key={v.key}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1" htmlFor={`triage-${v.key}`}>{t(v.label)}</label>
                  <input
                    id={`triage-${v.key}`}
                    type="number"
                    inputMode="decimal"
                    step={v.step ?? '1'}
                    min={v.min}
                    max={v.max}
                    value={vitals[v.key]}
                    onChange={(e) => setVitals((prev) => ({ ...prev, [v.key]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('q.triage.discriminators')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('q.triage.discriminatorsHint')}</p>
            <div className="space-y-4">
              {(['RED', 'ORANGE', 'YELLOW'] as const).map((group) => (
                <div key={group}>
                  <div className="mb-2"><LevelBadge level={group} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {TRIAGE_DISCRIMINATORS.filter((d) => d.level === group).map((d) => (
                      <label key={d.code} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <input type="checkbox" checked={discriminators.includes(d.code)} onChange={() => toggleDiscriminator(d.code)} className="rounded border-gray-300 text-lime-600 focus:ring-lime-500" />
                        {t(`q.disc.${d.code}`)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5 lg:sticky lg:top-4">
          <div className={card}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t('q.triage.result')}</h2>
            {scoreError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{t('q.triage.scoreFailed')}</p>}
            {score ? (
              <div className={`space-y-3 ${scoring ? 'opacity-60' : ''}`} aria-live="polite">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('q.triage.tews')}</span>
                  <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{score.tewsScore ?? '—'}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('q.triage.suggested')}</p>
                  <div className={`rounded-lg px-3 py-2 text-center font-bold ${LEVEL_BADGE[score.suggestedLevel]}`}>{t(`q.level.${score.suggestedLevel}`)}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">{t(`q.level.target.${score.suggestedLevel}`)}</p>
                </div>
                {score.reasons.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('q.triage.reasons')}</p>
                    <ul className="text-sm text-gray-800 dark:text-gray-200 list-disc pl-5">
                      {score.reasons.map((r) => <li key={r}>{reasonLabel(r)}</li>)}
                    </ul>
                  </div>
                )}
                {score.missing.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('q.triage.missing', { list: score.missing.map((m) => (t(`q.triage.missing.${m}`) === `q.triage.missing.${m}` ? m : t(`q.triage.missing.${m}`))).join(', ') })}
                  </p>
                )}
              </div>
            ) : (
              !scoreError && <p className="text-sm text-gray-500 dark:text-gray-400">{t('q.triage.computing')}</p>
            )}
          </div>

          <div className={`${card} space-y-3`}>
            <fieldset>
              <legend className={labelClass}>{t('q.triage.finalLevel')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {TRIAGE_LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => { setLevel(l); setLevelTouched(true); }}
                    aria-pressed={level === l}
                    className={`px-2 py-2 rounded-lg text-sm font-semibold border-2 ${LEVEL_BADGE[l]} ${level === l ? 'border-gray-900 dark:border-white ring-2 ring-offset-1 ring-gray-900 dark:ring-white' : 'border-transparent opacity-60 hover:opacity-90'}`}
                  >
                    {t(`q.level.short.${l}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            {nothingMeasured && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm space-y-2">
                <p>{t('q.triage.noVitals')}</p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={vitalsUnmeasurable} onChange={(e) => setVitalsUnmeasurable(e.target.checked)} />
                  {t('q.triage.vitalsUnmeasurable')}
                </label>
              </div>
            )}
            {differs && (
              <div>
                <label className={labelClass} htmlFor="triage-override">{t('q.triage.override')}</label>
                <textarea id="triage-override" rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className={inputClass} />
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="triage-notes">{t('q.triage.notes')}</label>
              <textarea id="triage-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </div>
            {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}
            <button type="button" onClick={save} disabled={saving || !canTriage} className="w-full px-4 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg font-medium disabled:opacity-50">
              {t('q.triage.save')}
            </button>
          </div>

          {ticket.triages && ticket.triages.length > 0 && (
            <div className={card}>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{t('q.triage.history')}</h2>
              <ul className="space-y-2">
                {ticket.triages.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-center gap-2"><LevelBadge level={a.level} short /><span className="text-gray-500 dark:text-gray-400">{formatDateTime(a.createdAt)}</span></div>
                    <p className="text-gray-800 dark:text-gray-200">{a.chiefComplaint}{a.assessedByName ? ` — ${a.assessedByName}` : ''}</p>
                    {a.overrideReason && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{a.overrideReason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

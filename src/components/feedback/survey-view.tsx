'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type FeedbackSurvey, type FeedbackSurveyInput } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { COMPLAINT_CATEGORIES, FEEDBACK_ASPECTS, MAX_COMMENT_LENGTH, surveyPayload, surveyProblem, type SurveyAnswers } from '@/lib/patient-extras';
import { RecommendScale, StarRating } from './rating-inputs';
import { PublicShell } from './public-shell';

type State =
  | { kind: 'loading' }
  | { kind: 'open'; survey: FeedbackSurvey }
  | { kind: 'thanks' }
  | { kind: 'already' }
  | { kind: 'expired' }
  | { kind: 'unknown' }
  | { kind: 'error'; message: string };

const EMPTY: SurveyAnswers = {
  overall: null,
  waitTime: null,
  staffCourtesy: null,
  explanations: null,
  cleanliness: null,
  recommend: null,
  comment: '',
  isComplaint: false,
  complaintCategory: '',
  contactBack: false,
};

/** Public satisfaction survey reached from the SMS sent after a visit (no login) */
export function SurveyView({ token }: { token: string }) {
  const { t, formatDate } = useLanguage();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [answers, setAnswers] = useState<SurveyAnswers>(EMPTY);
  const [problem, setProblem] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const survey = await api.getFeedbackSurvey(token);
      if (survey.status === 'SUBMITTED') setState({ kind: 'already' });
      else if (survey.status === 'EXPIRED') setState({ kind: 'expired' });
      else setState({ kind: 'open', survey });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState({ kind: 'unknown' });
      else if (err instanceof ApiError && err.status === 410) setState({ kind: 'expired' });
      else if (err instanceof ApiError && err.status === 429) setState({ kind: 'error', message: t('fb.survey.tooMany') });
      else setState({ kind: 'error', message: err instanceof Error && err.message ? err.message : t('fb.survey.loadFailed') });
    }
  }, [token, t]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const set = <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => setAnswers((a) => ({ ...a, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const issue = surveyProblem(answers);
    if (issue) {
      setProblem(t(`fb.survey.problem.${issue}`));
      return;
    }
    setProblem('');
    setSending(true);
    try {
      await api.submitFeedbackSurvey(token, surveyPayload(answers) as unknown as FeedbackSurveyInput);
      setState({ kind: 'thanks' });
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setState({ kind: 'already' });
      else if (err instanceof ApiError && err.status === 410) setState({ kind: 'expired' });
      else if (err instanceof ApiError && err.status === 429) setProblem(t('fb.survey.tooMany'));
      else setProblem(err instanceof Error && err.message ? err.message : t('fb.survey.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicShell title={t('fb.survey.title')}>
      {state.kind === 'loading' && <p className="text-gray-500 dark:text-gray-400">{t('fb.loading')}</p>}
      {state.kind === 'unknown' && <Message tone="red" title={t('fb.survey.unknown')} text={t('fb.survey.unknownHelp')} />}
      {state.kind === 'expired' && <Message tone="amber" title={t('fb.survey.expired')} text={t('fb.survey.expiredHelp')} />}
      {state.kind === 'already' && <Message tone="green" title={t('fb.survey.already')} text={t('fb.survey.alreadyHelp')} />}
      {state.kind === 'thanks' && (
        <Message tone="green" title={t('fb.survey.thanks')} text={answers.isComplaint || answers.contactBack ? t('fb.survey.thanksFollowUp') : t('fb.survey.thanksHelp')} />
      )}
      {state.kind === 'error' && <Message tone="amber" title={t('fb.survey.loadFailed')} text={state.message} />}

      {state.kind === 'open' && (
        <form onSubmit={submit} className="space-y-6" noValidate>
          <div className="rounded-xl bg-lime-50 p-4 text-gray-800 dark:bg-lime-900/20 dark:text-gray-100">
            <p className="text-lg font-semibold">{state.survey.patientFirstName ? t('fb.survey.hello', { name: state.survey.patientFirstName }) : t('fb.survey.helloAnon')}</p>
            <p className="mt-1 text-sm">
              {t(state.survey.visit.kind === 'STAY' ? 'fb.survey.aboutStay' : 'fb.survey.aboutConsultation', {
                date: state.survey.visit.date ? formatDate(state.survey.visit.date, { day: 'numeric', month: 'long', year: 'numeric' }) : '—',
              })}
              {state.survey.visit.department ? ` · ${state.survey.visit.department}` : ''}
              {state.survey.visit.doctorName ? ` · ${state.survey.visit.doctorName}` : ''}
            </p>
          </div>

          <StarRating id="overall" label={t('fb.survey.overall')} value={answers.overall} onChange={(v) => set('overall', v)} required />
          <div className="grid gap-5 sm:grid-cols-2">
            {FEEDBACK_ASPECTS.map((aspect) => (
              <StarRating key={aspect} id={aspect} label={t(`fb.aspect.${aspect}`)} value={answers[aspect]} onChange={(v) => set(aspect, v)} />
            ))}
          </div>
          <RecommendScale value={answers.recommend} onChange={(v) => set('recommend', v)} />

          <div>
            <label htmlFor="survey-comment" className="mb-2 block text-base font-medium text-gray-900 dark:text-white">
              {t('fb.survey.comment')}
            </label>
            <textarea
              id="survey-comment"
              rows={4}
              maxLength={MAX_COMMENT_LENGTH}
              value={answers.comment}
              onChange={(e) => set('comment', e.target.value)}
              placeholder={t('fb.survey.commentPlaceholder')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 focus:border-transparent focus:ring-2 focus:ring-lime-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
              {answers.comment.length}/{MAX_COMMENT_LENGTH}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <label className="flex min-h-12 items-center gap-3 text-base text-gray-900 dark:text-white">
              <input type="checkbox" checked={answers.isComplaint} onChange={(e) => set('isComplaint', e.target.checked)} className="h-6 w-6" />
              {t('fb.survey.complaint')}
            </label>
            {answers.isComplaint && (
              <div>
                <label htmlFor="survey-category" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('fb.survey.category')}
                </label>
                <select
                  id="survey-category"
                  value={answers.complaintCategory}
                  onChange={(e) => set('complaintCategory', e.target.value as SurveyAnswers['complaintCategory'])}
                  className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{t('fb.survey.categoryPick')}</option>
                  {COMPLAINT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`fb.category.${c}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex min-h-12 items-center gap-3 text-base text-gray-900 dark:text-white">
              <input type="checkbox" checked={answers.contactBack} onChange={(e) => set('contactBack', e.target.checked)} className="h-6 w-6" />
              {t('fb.survey.contactBack')}
            </label>
          </div>

          {problem && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {problem}
            </p>
          )}
          <button type="submit" disabled={sending} className="h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
            {sending ? t('fb.survey.sending') : t('fb.survey.send')}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('fb.survey.privacy')}</p>
        </form>
      )}
    </PublicShell>
  );
}

function Message({ tone, title, text }: { tone: 'green' | 'amber' | 'red'; title: string; text: string }) {
  const styles = {
    green: 'border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200',
    amber: 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200',
    red: 'border-red-500 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200',
  }[tone];
  return (
    <div className={`rounded-xl border-2 p-5 ${styles}`} role="status">
      <p className="text-lg font-bold">{title}</p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { SurveyView } from '@/components/feedback';

// Public survey reached from the SMS sent after a visit (no login)
export default function FeedbackSurveyPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? decodeURIComponent(params.token) : '';
  return <SurveyView key={token} token={token} />;
}

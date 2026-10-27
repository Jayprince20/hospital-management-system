'use client';

import { useParams } from 'next/navigation';
import { ConfirmView } from '@/components/confirmation';

// Public page from the appointment reminder: confirm or cancel (no login)
export default function AppointmentConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? decodeURIComponent(params.token) : '';
  return <ConfirmView key={token} token={token} />;
}

'use client';

import { useParams } from 'next/navigation';
import { VerifyView } from '@/components/documents/verify-view';

// Public page reached from the QR code printed on a certificate (no login)
export default function VerifyCodePage() {
  const params = useParams<{ code: string }>();
  const code = typeof params?.code === 'string' ? decodeURIComponent(params.code) : '';
  return <VerifyView key={code} initialCode={code} />;
}

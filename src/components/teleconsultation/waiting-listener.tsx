'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';
import { useToast } from '@/components/toast';
import { TeleEvents } from '@/lib/teleconsultation';

/** Doctors anywhere in the dashboard: a toast when a patient enters the virtual waiting room */
export function TeleWaitingListener() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const { getSocket, isConnected } = useNotifications();
  const isDoctor = user?.role === 'DOCTOR';

  useEffect(() => {
    if (!isDoctor || !isConnected) return;
    const socket = getSocket();
    if (!socket) return;
    const onWaiting = ({ patientName }: { appointmentId: string; patientName: string }) => {
      toast.info(t('tele.waitingToast', { name: patientName }), t('tele.waitingToastHint'));
    };
    socket.on(TeleEvents.WAITING, onWaiting);
    return () => {
      socket.off(TeleEvents.WAITING, onWaiting);
    };
  }, [isDoctor, isConnected, getSocket, toast, t]);

  return null;
}

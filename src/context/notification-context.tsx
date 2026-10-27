'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import type { Socket } from 'socket.io-client';
import { useSocket, ServerEvents, ClientEvents } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { useAuth } from './auth-context';

// Notification types
export type NotificationType =
  | 'appointment'
  | 'lab_result'
  | 'payment'
  | 'prescription'
  | 'system'
  | 'promotion';

const KNOWN_TYPES: readonly NotificationType[] = ['appointment', 'lab_result', 'payment', 'prescription', 'system', 'promotion'];

// Backend services emit more specific types (lab_critical, cash-desk, roster…);
// map them onto the display families so styling lookups never miss.
const TYPE_ALIASES: Record<string, NotificationType> = {
  lab_critical: 'lab_result',
  imaging_critical: 'lab_result',
  imaging_result: 'lab_result',
  'cash-desk': 'payment',
};

export function notificationKind(type: string | null | undefined): NotificationType {
  if (!type) return 'system';
  if ((KNOWN_TYPES as readonly string[]).includes(type)) return type as NotificationType;
  return TYPE_ALIASES[type] ?? 'system';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  toastEnabled: boolean;
}

export interface ToastNotification {
  id: string;
  notification: Notification;
  isVisible: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  toasts: ToastNotification[];
  settings: NotificationSettings;
  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  dismissToast: (id: string) => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  requestDesktopPermission: () => Promise<NotificationPermission>;
  /** The shared Socket.io connection (one per tab), for teleconsultation signalling */
  getSocket: () => Socket | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY_SETTINGS = 'notification_settings';
const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  desktopEnabled: false,
  toastEnabled: true,
};

// Sound utility
const playNotificationSound = () => {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
};

// Desktop notification utility
const showDesktopNotification = (notification: Notification) => {
  if (Notification.permission === 'granted') {
    const desktopNotif = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      tag: notification.id,
    });

    desktopNotif.onclick = () => {
      window.focus();
      desktopNotif.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => desktopNotif.close(), 5000);
  }
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated: signedIn, mfaSetupRequired, mustChangePassword } = useAuth();
  // Until 2FA enrolment or a forced password change is done the API refuses everything else
  const isAuthenticated = signedIn && !mfaSetupRequired && !mustChangePassword;
  const { isConnected, on, emit, connect, disconnect, getSocket } = useSocket({ autoConnect: false });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const notificationsRef = useRef<Notification[]>([]);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  const hasInitialized = useRef(false);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        } catch {
          // Use defaults
        }
      }
    }
  }, []);

  // Connect socket when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      connect();
    } else {
      disconnect();
    }
  }, [isAuthenticated, user, connect, disconnect]);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await api.getNotifications({ limit: 50 });
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated && !hasInitialized.current) {
      hasInitialized.current = true;
      fetchNotifications();
    }
    if (!isAuthenticated) {
      hasInitialized.current = false;
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchNotifications]);

  // Add toast notification
  const addToast = useCallback((notification: Notification) => {
    const toastId = `toast-${notification.id}-${Date.now()}`;
    setToasts((prev) => [
      ...prev,
      { id: toastId, notification, isVisible: true },
    ]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === toastId ? { ...t, isVisible: false } : t))
      );
      // Remove from array after animation
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 300);
    }, 5000);
  }, []);

  // Dismiss toast
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isVisible: false } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  // Handle new notification from socket
  const handleNewNotification = useCallback(
    (notification: Notification) => {
      // A reconnect sync replays stored notifications: ignore the ones already listed
      if (notificationsRef.current.some((n) => n.id === notification.id)) return;
      notificationsRef.current = [notification, ...notificationsRef.current];
      setNotifications((prev) => (prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]));
      setUnreadCount((prev) => prev + 1);

      // Show toast if enabled
      if (settings.toastEnabled) {
        addToast(notification);
      }

      // Play sound if enabled
      if (settings.soundEnabled) {
        playNotificationSound();
      }

      // Show desktop notification if enabled and document is hidden
      if (settings.desktopEnabled && document.hidden) {
        showDesktopNotification(notification);
      }
    },
    [settings, addToast]
  );

  // Handle notification updated
  const handleNotificationUpdated = useCallback((notification: Notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? notification : n))
    );
    if (notification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  // Handle notification deleted
  const handleNotificationDeleted = useCallback((data: { id: string }) => {
    setNotifications((prev) => {
      const notification = prev.find((n) => n.id === data.id);
      if (notification && !notification.isRead) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      return prev.filter((n) => n.id !== data.id);
    });
  }, []);

  // Handle all read
  const handleAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  // Handle unread count update
  const handleUnreadCount = useCallback((data: { count: number }) => {
    setUnreadCount(data.count);
  }, []);

  // Subscribe to socket events
  useEffect(() => {
    if (!isConnected) return;

    const cleanups = [
      on<Notification>(ServerEvents.NOTIFICATION_NEW, handleNewNotification),
      on<Notification>(ServerEvents.NOTIFICATION_UPDATED, handleNotificationUpdated),
      on<{ id: string }>(ServerEvents.NOTIFICATION_DELETED, handleNotificationDeleted),
      on(ServerEvents.NOTIFICATION_ALL_READ, handleAllRead),
      on<{ count: number }>(ServerEvents.NOTIFICATION_UNREAD_COUNT, handleUnreadCount),
    ];

    // Catch up on what arrived while disconnected. Before the first fetch there is
    // nothing to catch up from (the REST fetch loads the list), so don't replay it all.
    const latest = notificationsRef.current[0]?.createdAt;
    if (latest) emit(ClientEvents.NOTIFICATIONS_SYNC, { lastSyncTimestamp: latest });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [
    isConnected,
    on,
    emit,
    handleNewNotification,
    handleNotificationUpdated,
    handleNotificationDeleted,
    handleAllRead,
    handleUnreadCount,
  ]);

  // Mark as read
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await api.markNotificationAsRead(id);
        // Optimistic update
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        // Also emit to socket for real-time sync
        emit(ClientEvents.NOTIFICATION_READ, { id });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [emit]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsAsRead();
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      // Also emit to socket
      emit(ClientEvents.NOTIFICATION_READ_ALL, {});
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [emit]);

  // Delete notification
  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        await api.deleteNotification(id);
        // Optimistic update
        setNotifications((prev) => {
          const notification = prev.find((n) => n.id === id);
          if (notification && !notification.isRead) {
            setUnreadCount((count) => Math.max(0, count - 1));
          }
          return prev.filter((n) => n.id !== id);
        });
        // Emit to socket
        emit(ClientEvents.NOTIFICATION_DELETE, { id });
      } catch (error) {
        console.error('Failed to delete notification:', error);
      }
    },
    [emit]
  );

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Request desktop notification permission
  const requestDesktopPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      updateSettings({ desktopEnabled: true });
    }
    return permission;
  }, [updateSettings]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        isConnected,
        toasts,
        settings,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        dismissToast,
        updateSettings,
        requestDesktopPermission,
        getSocket,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

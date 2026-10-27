'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Server events (received from server)
export const ServerEvents = {
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_UPDATED: 'notification:updated',
  NOTIFICATION_DELETED: 'notification:deleted',
  NOTIFICATION_ALL_READ: 'notification:all-read',
  NOTIFICATION_UNREAD_COUNT: 'notification:unread-count',
  CONNECTION_ERROR: 'connection:error',
  CONNECTION_SUCCESS: 'connection:success',
} as const;

// Client events (sent to server)
export const ClientEvents = {
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_READ_ALL: 'notification:read-all',
  NOTIFICATION_DELETE: 'notification:delete',
  NOTIFICATIONS_SYNC: 'notifications:sync',
  SUBSCRIBE_ROOM: 'subscribe:room',
  UNSUBSCRIBE_ROOM: 'unsubscribe:room',
} as const;

export type ServerEventType = (typeof ServerEvents)[keyof typeof ServerEvents];
export type ClientEventType = (typeof ClientEvents)[keyof typeof ClientEvents];

export interface UseSocketOptions {
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface UseSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  emit: <T = unknown>(event: ClientEventType, data?: T) => void;
  on: <T = unknown>(event: ServerEventType, callback: (data: T) => void) => () => void;
  off: (event: ServerEventType) => void;
  /** The underlying connection, for features with their own events and acks (teleconsultation) */
  getSocket: () => Socket | null;
}

function getSocketUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use the browser's current hostname with the backend port
    // Socket.io runs on the same backend server
    const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || '3000';
    return `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
  }
  return process.env.INTERNAL_API_URL || 'http://backend:3000';
}

const SOCKET_URL = getSocketUrl();

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    autoConnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  }, []);

  const connect = useCallback(() => {
    const token = getToken();

    if (!token) {
      setError('No authentication token available');
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      console.log('[Socket] Connected to server');
    });

    socketRef.current.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);

      if (reason === 'io server disconnect') {
        // Server disconnected us, likely auth issue
        setError('Disconnected by server');
      }
    });

    socketRef.current.on('connect_error', (err) => {
      setIsConnecting(false);
      setError(err.message || 'Connection failed');
      console.error('[Socket] Connection error:', err.message);
    });

    socketRef.current.on(ServerEvents.CONNECTION_ERROR, (data: { message: string }) => {
      setError(data.message);
      console.error('[Socket] Server error:', data.message);
    });

    socketRef.current.on(ServerEvents.CONNECTION_SUCCESS, (data: { message: string; userId: string }) => {
      console.log('[Socket] Connection successful:', data.message);
    });

  }, [getToken, reconnectionAttempts, reconnectionDelay]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, []);

  const emit = useCallback(<T = unknown>(event: ClientEventType, data?: T) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('[Socket] Cannot emit, not connected');
    }
  }, []);

  const on = useCallback(<T = unknown>(event: ServerEventType, callback: (data: T) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }

    // Return cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  const off = useCallback((event: ServerEventType) => {
    if (socketRef.current) {
      socketRef.current.off(event);
    }
  }, []);

  // Auto-connect on mount if token exists
  useEffect(() => {
    // Connect on the next tick: connect() updates state, which must not happen synchronously in an effect
    const timer = autoConnect && getToken() ? setTimeout(connect, 0) : undefined;

    return () => {
      clearTimeout(timer);
      disconnect();
    };
  }, [autoConnect, connect, disconnect, getToken]);

  // Reconnect when token changes (e.g., after login)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        if (e.newValue) {
          connect();
        } else {
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);

  const getSocket = useCallback(() => socketRef.current, []);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    emit,
    on,
    off,
    getSocket,
  };
}

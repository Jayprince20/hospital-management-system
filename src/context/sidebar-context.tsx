'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { readStored, writeStored } from '@/lib/navigation';

const COLLAPSED_KEY = 'hms.sidebar.collapsed';

interface SidebarState {
  /** Desktop sidebar shown as an icon rail */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Page search (⌘K / Ctrl+K) */
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // The dashboard shell only renders in the browser (after the auth check), so the saved preference can be read up front
  const [collapsed, setCollapsed] = useState(() => (typeof window === 'undefined' ? false : readStored(COLLAPSED_KEY, false)));
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writeStored(COLLAPSED_KEY, !current);
      return !current;
    });
  }, []);

  // ⌘K (Mac) / Ctrl+K opens the page search from anywhere in the dashboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <SidebarContext.Provider value={{ collapsed, toggleCollapsed, paletteOpen, setPaletteOpen }}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used inside SidebarProvider');
  return ctx;
}

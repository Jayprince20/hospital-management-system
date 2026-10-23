'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api, type ActingForLink } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import {
  ACTING_CHANGE_EVENT,
  ACTING_STORAGE_KEY,
  canSeeClinical as levelSeesClinical,
  readActingProfile,
  writeActingProfile,
  type ActingLevel,
  type ActingProfile,
} from '@/lib/patient-extras';

/**
 * Family access in the patient portal: which record the signed-in patient is looking at.
 * The choice lives in sessionStorage (this tab only); the API client reads it on every request
 * and sends X-Act-As-Patient, so pages need nothing special beyond re-loading when it changes
 * (the dashboard layout re-mounts the page on a switch).
 */
interface ActingPatientContextValue {
  /** Relatives this account may act for (patients only) */
  links: ActingForLink[];
  linksLoaded: boolean;
  refreshLinks: () => Promise<void>;
  /** The relative being acted for, or null for one's own record */
  acting: ActingProfile | null;
  setActing: (link: ActingForLink | null) => void;
  isActing: boolean;
  level: ActingLevel;
  canSeeClinical: boolean;
  /** Patient record the portal pages should show: the relative's, else one's own */
  effectivePatientId: string | null;
}

const fallback: ActingPatientContextValue = {
  links: [],
  linksLoaded: true,
  refreshLinks: async () => {},
  acting: null,
  setActing: () => {},
  isActing: false,
  level: 'SELF',
  canSeeClinical: true,
  effectivePatientId: null,
};

const ActingPatientContext = createContext<ActingPatientContextValue>(fallback);

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACTING_STORAGE_KEY) onChange();
  };
  window.addEventListener(ACTING_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ACTING_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

// The raw string is the snapshot (stable between renders); parsing happens below
const getSnapshot = () => {
  try {
    return window.sessionStorage.getItem(ACTING_STORAGE_KEY);
  } catch {
    return null;
  }
};
const getServerSnapshot = () => null;

function store(profile: ActingProfile | null) {
  writeActingProfile(window.sessionStorage, profile);
  window.dispatchEvent(new Event(ACTING_CHANGE_EVENT));
}

export function ActingPatientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isPatient = user?.role === 'PATIENT';
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [links, setLinks] = useState<ActingForLink[]>([]);
  const [linksLoaded, setLinksLoaded] = useState(false);

  // A stored choice only counts for the account that made it
  const stored = useMemo(() => (raw && user ? readActingProfile({ getItem: () => raw, setItem: () => {}, removeItem: () => {} }, user.id) : null), [raw, user]);

  const refreshLinks = useCallback(async () => {
    if (!isPatient) {
      setLinks([]);
      setLinksLoaded(true);
      return;
    }
    try {
      setLinks((await api.getMyProxies()).actingFor);
    } catch {
      setLinks([]);
    } finally {
      setLinksLoaded(true);
    }
  }, [isPatient]);

  useEffect(() => {
    // Loaded from a timer: no state change during the render that mounted us
    const timer = setTimeout(() => {
      refreshLinks();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshLinks]);

  // Forget a choice that no longer holds: another account, staff, or a link that was removed
  useEffect(() => {
    if (!raw || !user) return;
    const invalid = !isPatient || !stored || (linksLoaded && !links.some((l) => l.patient.id === stored.patientId));
    if (invalid) store(null);
  }, [raw, user, isPatient, stored, links, linksLoaded]);

  const setActing = useCallback(
    (link: ActingForLink | null) => {
      if (!user || !link) {
        store(null);
        return;
      }
      store({
        patientId: link.patient.id,
        firstName: link.patient.firstName,
        lastName: link.patient.lastName,
        relationship: link.relationship,
        accessLevel: link.accessLevel,
        ownerUserId: user.id,
      });
    },
    [user]
  );

  const value = useMemo<ActingPatientContextValue>(() => {
    // While the links load, keep showing the stored choice (it is re-checked once they arrive)
    const acting = isPatient && stored ? stored : null;
    const level: ActingLevel = acting ? acting.accessLevel : 'SELF';
    return {
      links,
      linksLoaded,
      refreshLinks,
      acting,
      setActing,
      isActing: Boolean(acting),
      level,
      canSeeClinical: levelSeesClinical(level),
      effectivePatientId: acting?.patientId ?? user?.patientId ?? null,
    };
  }, [isPatient, stored, links, linksLoaded, refreshLinks, setActing, user?.patientId]);

  return <ActingPatientContext.Provider value={value}>{children}</ActingPatientContext.Provider>;
}

/** Outside the provider (public pages) this reports "acting as oneself" */
export function useActingPatient(): ActingPatientContextValue {
  return useContext(ActingPatientContext);
}

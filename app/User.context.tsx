/**
 * User.context.tsx
 *
 * Global authentication state: holds the auth token in React state and exposes
 * it (plus a setter and an auth-loading flag) via a typed context + hook.
 *
 * Persistence is isolated behind the `authStorage` adapter below — to persist
 * sessions across app launches, swap the in-memory implementation for
 * AsyncStorage / expo-secure-store in exactly one place.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';

/* ---------------------------------- Types --------------------------------- */

export type AuthToken = string;

export interface UserContextValue {
  /** Current auth token, or `null` when signed out. */
  authToken: AuthToken | null;
  /** Sets the auth token, or clears it with `null`. */
  setAuthToken: (token: AuthToken | null) => void;
  /** True while the auth session is being restored / resolved. */
  loadingAuth: boolean;
}

/* ----------------------------- Storage adapter ---------------------------- */

interface AuthStorageAdapter {
  load: () => Promise<AuthToken | null>;
  save: (token: AuthToken) => Promise<void>;
  clear: () => Promise<void>;
}

/** Default in-memory adapter — replace with AsyncStorage / SecureStore. */
const memoryStorage: AuthStorageAdapter = (() => {
  let token: AuthToken | null = null;
  return {
    load: async () => token,
    save: async (next) => {
      token = next;
    },
    clear: async () => {
      token = null;
    },
  };
})();

const authStorage: AuthStorageAdapter = memoryStorage;

/* --------------------------------- Context -------------------------------- */

const UserContext = createContext<UserContextValue | undefined>(undefined);
UserContext.displayName = 'UserContext';

export interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps): ReactElement {
  const [authToken, setAuthTokenState] = useState<AuthToken | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

  // Restore any persisted session exactly once on mount.
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const restored = await authStorage.load();
        if (isMounted && restored) {
          setAuthTokenState(restored);
        }
      } catch {
        // A failed restore must never block the UI — treat as signed out.
      } finally {
        if (isMounted) {
          setLoadingAuth(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setAuthToken = useCallback((token: AuthToken | null) => {
    setAuthTokenState(token);
    // Persist fire-and-forget; storage failures must not corrupt UI state.
    const persist = token ? authStorage.save(token) : authStorage.clear();
    persist.catch(() => undefined);
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({ authToken, setAuthToken, loadingAuth }),
    [authToken, setAuthToken, loadingAuth],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/* ---------------------------------- Hook ---------------------------------- */

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a <UserProvider>.');
  }
  return context;
}

export default UserContext;
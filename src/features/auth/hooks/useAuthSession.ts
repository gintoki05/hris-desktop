import { useEffect, useMemo, useState } from "react";
import {
  getCurrentAuthSession,
  login as loginWithRepository,
  logout as logoutFromRepository,
  roleCan,
} from "../services/auth.service";
import type { AuthPermission, AuthSession, LoginInput } from "../types";

type AuthSessionState = {
  session: AuthSession | null;
  isLoading: boolean;
  errorMessage: string | null;
  login: (input: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
  can: (permission: AuthPermission) => boolean;
};

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCurrentAuthSession()
      .then((currentSession) => {
        if (!isMounted) {
          return;
        }

        setSession(currentSession);
        setErrorMessage(null);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setErrorMessage("Sesi lokal gagal dibaca. Silakan login ulang.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return useMemo(
    () => ({
      session,
      isLoading,
      errorMessage,
      async login(input) {
        const result = await loginWithRepository(input);

        if (!result.ok) {
          setErrorMessage(result.message);
          return false;
        }

        setSession(result.session);
        setErrorMessage(null);
        return true;
      },
      async logout() {
        await logoutFromRepository();
        setSession(null);
        setErrorMessage(null);
      },
      can(permission) {
        return session ? roleCan(session.user.role, permission) : false;
      },
    }),
    [errorMessage, isLoading, session],
  );
}

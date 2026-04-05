import { createContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type UserRole = "participant" | "researcher" | "admin";

export interface AuthState {
  token: string | null;
  role: UserRole | null;
  participantId: string | null;
}

export interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (token: string, role: UserRole, participantId?: string) => void;
  logout: () => void;
}

const initialState: AuthState = {
  token: null,
  role: null,
  participantId: null,
};

export const AuthContext = createContext<AuthContextValue>({
  ...initialState,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const stored = localStorage.getItem("wellab_auth");
    if (stored) {
      try {
        return JSON.parse(stored) as AuthState;
      } catch {
        return initialState;
      }
    }
    return initialState;
  });

  const login = useCallback(
    (token: string, role: UserRole, participantId?: string) => {
      const newState: AuthState = {
        token,
        role,
        participantId: participantId ?? null,
      };
      setAuthState(newState);
      localStorage.setItem("wellab_auth", JSON.stringify(newState));
    },
    []
  );

  const logout = useCallback(() => {
    setAuthState(initialState);
    localStorage.removeItem("wellab_auth");
  }, []);

  const value: AuthContextValue = {
    ...authState,
    isAuthenticated: authState.token !== null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

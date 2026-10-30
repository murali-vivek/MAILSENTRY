import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getSession } from "./api/auth";
import { LoadingState } from "./components/LoadingState";

type AuthState = {
  status: "loading" | "in" | "out";
  demoEnabled: boolean;
  refresh: () => Promise<void>;
  markSignedIn: (demoEnabled: boolean) => void;
  markSignedOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [demoEnabled, setDemoEnabled] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      setDemoEnabled(session.demoEnabled);
      setStatus("in");
    } catch {
      setStatus("out");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const value = useMemo<AuthState>(() => ({
    status,
    demoEnabled,
    refresh,
    markSignedIn: (enabled) => {
      setDemoEnabled(enabled);
      setStatus("in");
    },
    markSignedOut: () => setStatus("out"),
  }), [demoEnabled, refresh, status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === "loading") return <LoadingState label="Checking session" />;
  if (auth.status === "out") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

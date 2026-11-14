/* Sessão: Supabase Auth quando configurado, demonstração caso contrário. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { signIn as signInRequest, signOutEverywhere, switchActiveUser } from "@/services/userService";
import { getDemoState, subscribeDemo } from "@/services/demo/demoDb";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  authenticated: boolean;
  user: UserProfile;
  users: UserProfile[];
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => void;
  switchUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [snapshot, setSnapshot] = useState(() => getDemoState());

  useEffect(() => subscribeDemo(() => setSnapshot({ ...getDemoState() })), []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    await signInRequest(identifier, password);
    setAuthenticated(true);
  }, []);

  const signOut = useCallback(() => {
    void signOutEverywhere();
    setAuthenticated(false);
  }, []);

  const switchUser = useCallback(async (userId: string) => {
    await switchActiveUser(userId);
  }, []);

  const value = useMemo(
    () => ({ authenticated, user: snapshot.user, users: snapshot.users, signIn, signOut, switchUser }),
    [authenticated, snapshot, signIn, signOut, switchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@teamsync/shared";
import { supabase } from "@/lib/supabase";
import * as authService from "@/services/auth";
import type { LoginInput, SignUpInput } from "@/lib/validations";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: {
    full_name: string;
    avatar_url?: string | null;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const next = await authService.getProfile(userId);
      setProfile(next);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setStatus(data.session ? "authenticated" : "unauthenticated");
      if (data.session?.user) {
        void loadProfile(data.session.user.id);
        void supabase.realtime.setAuth(data.session.access_token);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      setStatus(next ? "authenticated" : "unauthenticated");
      if (next?.user) {
        await loadProfile(next.user.id);
        await supabase.realtime.setAuth(next.access_token);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      signIn: async (input) => {
        await authService.signIn(input);
      },
      signUp: async (input) => {
        await authService.signUp(input);
      },
      signOut: async () => {
        await authService.signOut();
      },
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
      updateProfile: async (patch) => {
        if (!session?.user) throw new Error("Not signed in");
        const next = await authService.updateProfile(session.user.id, patch);
        setProfile(next);
      },
    }),
    [status, session, profile, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

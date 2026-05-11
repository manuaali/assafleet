import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "superadmin" | "admin" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roleLoading: boolean;
  userRole: AppRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

interface ServerRoleResponse {
  role: AppRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  userId: string;
  verifiedAt: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function promiseWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [serverVerifiedAdmin, setServerVerifiedAdmin] = useState(false);
  const [serverVerifiedSuperAdmin, setServerVerifiedSuperAdmin] = useState(false);

  // Fetch role from server-side edge function for secure verification
  const fetchUserRoleFromServer = async (
    accessToken: string
  ): Promise<{ role: ServerRoleResponse | null; authInvalid: boolean }> => {
    try {
      const response = await promiseWithTimeout(
        supabase.functions.invoke("get-user-role", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        6500
      );

      if (response.error) {
        console.error("Error fetching role from server:", response.error);
        const status =
          (response.error as { status?: number; context?: { status?: number } })?.status ??
          (response.error as { context?: { status?: number } })?.context?.status;
        const message = String((response.error as { message?: string })?.message ?? "");
        const authInvalid =
          status === 401 ||
          status === 403 ||
          /invalid|expired|unauthorized|jwt|token/i.test(message);
        return { role: null, authInvalid };
      }

      if (response.data?.error) {
        console.error("Server returned error:", response.data.error);
        return { role: null, authInvalid: false };
      }

      return { role: response.data as ServerRoleResponse, authInvalid: false };
    } catch (error) {
      console.error("Error in fetchUserRoleFromServer:", error);
      return { role: null, authInvalid: false };
    }
  };

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setUserRole(null);
    setServerVerifiedAdmin(false);
    setServerVerifiedSuperAdmin(false);
    setRoleLoading(false);
  };

  const updateRoleState = (serverRole: ServerRoleResponse | null) => {
    if (serverRole) {
      setUserRole(serverRole.role);
      setServerVerifiedAdmin(serverRole.isAdmin);
      setServerVerifiedSuperAdmin(serverRole.isSuperAdmin);
    } else {
      // Fallback to basic user role if server verification fails
      setUserRole("user");
      setServerVerifiedAdmin(false);
      setServerVerifiedSuperAdmin(false);
    }

    setRoleLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      // Handle sign out events
      if (event === "SIGNED_OUT" || !newSession) {
        clearAuthState();
        setLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession.user);

      // Important: never block app rendering on role verification.
      setLoading(false);

      if (newSession.access_token) {
        setRoleLoading(true);

        void (async () => {
          const serverRole = await fetchUserRoleFromServer(newSession.access_token);
          if (isMounted) {
            updateRoleState(serverRole);
          }
        })();
      } else {
        updateRoleState(null);
      }
    });

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        const {
          data: { session: existingSession },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error || !existingSession) {
          clearAuthState();
          return;
        }

        setSession(existingSession);
        setUser(existingSession.user);

        // Allow UI to render immediately when session is present.
        setLoading(false);

        if (existingSession.access_token) {
          setRoleLoading(true);
          void (async () => {
            const serverRole = await fetchUserRoleFromServer(existingSession.access_token);
            if (isMounted) {
              updateRoleState(serverRole);
            }
          })();
        } else {
          updateRoleState(null);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        if (isMounted) {
          clearAuthState();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthState();
  };

  // Use server-verified roles for security
  const isAdmin = serverVerifiedAdmin;
  const isSuperAdmin = serverVerifiedSuperAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roleLoading,
        userRole,
        isAdmin,
        isSuperAdmin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "superadmin" | "admin" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [serverVerifiedAdmin, setServerVerifiedAdmin] = useState(false);
  const [serverVerifiedSuperAdmin, setServerVerifiedSuperAdmin] = useState(false);

  // Fetch role from server-side edge function for secure verification
  const fetchUserRoleFromServer = async (accessToken: string): Promise<ServerRoleResponse | null> => {
    try {
      const response = await supabase.functions.invoke('get-user-role', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      // Check for HTTP errors (401, 403, etc.) or function errors
      if (response.error) {
        console.error("Error fetching role from server:", response.error);
        // If token is invalid/expired, return null to trigger graceful fallback
        return null;
      }

      // Check if response data indicates an error
      if (response.data?.error) {
        console.error("Server returned error:", response.data.error);
        return null;
      }

      return response.data as ServerRoleResponse;
    } catch (error) {
      console.error("Error in fetchUserRoleFromServer:", error);
      return null;
    }
  };

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setUserRole(null);
    setServerVerifiedAdmin(false);
    setServerVerifiedSuperAdmin(false);
  };

  const updateRoleState = (serverRole: ServerRoleResponse | null) => {
    if (serverRole) {
      setUserRole(serverRole.role);
      setServerVerifiedAdmin(serverRole.isAdmin);
      setServerVerifiedSuperAdmin(serverRole.isSuperAdmin);
    } else {
      // Fallback to basic user role if server verification fails
      setUserRole('user');
      setServerVerifiedAdmin(false);
      setServerVerifiedSuperAdmin(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;

        // Handle sign out events
        if (event === 'SIGNED_OUT' || !newSession) {
          clearAuthState();
          setLoading(false);
          return;
        }

        setSession(newSession);
        setUser(newSession.user);
        
        if (newSession.access_token) {
          // Defer role fetch to avoid blocking
          const serverRole = await fetchUserRoleFromServer(newSession.access_token);
          if (isMounted) {
            updateRoleState(serverRole);
          }
        }
        
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (error || !existingSession) {
          clearAuthState();
          setLoading(false);
          return;
        }

        setSession(existingSession);
        setUser(existingSession.user);
        
        if (existingSession.access_token) {
          const serverRole = await fetchUserRoleFromServer(existingSession.access_token);
          if (isMounted) {
            updateRoleState(serverRole);
          }
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
    setUser(null);
    setSession(null);
    setUserRole(null);
    setServerVerifiedAdmin(false);
    setServerVerifiedSuperAdmin(false);
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

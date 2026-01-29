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

      if (response.error) {
        console.error("Error fetching role from server:", response.error);
        return null;
      }

      return response.data as ServerRoleResponse;
    } catch (error) {
      console.error("Error in fetchUserRoleFromServer:", error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.access_token) {
          // Fetch role from server-side for secure verification
          setTimeout(async () => {
            const serverRole = await fetchUserRoleFromServer(session.access_token);
            if (serverRole) {
              setUserRole(serverRole.role);
              setServerVerifiedAdmin(serverRole.isAdmin);
              setServerVerifiedSuperAdmin(serverRole.isSuperAdmin);
            } else {
              setUserRole('user');
              setServerVerifiedAdmin(false);
              setServerVerifiedSuperAdmin(false);
            }
          }, 0);
        } else {
          setUserRole(null);
          setServerVerifiedAdmin(false);
          setServerVerifiedSuperAdmin(false);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.access_token) {
        const serverRole = await fetchUserRoleFromServer(session.access_token);
        if (serverRole) {
          setUserRole(serverRole.role);
          setServerVerifiedAdmin(serverRole.isAdmin);
          setServerVerifiedSuperAdmin(serverRole.isSuperAdmin);
        } else {
          setUserRole('user');
          setServerVerifiedAdmin(false);
          setServerVerifiedSuperAdmin(false);
        }
      }
      
      setLoading(false);
    });

    return () => {
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

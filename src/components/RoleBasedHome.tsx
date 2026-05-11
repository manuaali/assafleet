import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Redirects authenticated users to the right "home" based on role:
 * - Admins/superadmins -> /dashboard (Yleisnäkymä)
 * - Regular users      -> /my-vehicle
 */
export function RoleBasedHome() {
  const { user, loading, roleLoading, isAdmin } = useAuth();

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={isAdmin ? "/dashboard" : "/my-vehicle"} replace />;
}

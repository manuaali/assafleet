import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminComplianceCard } from "@/components/dashboard/AdminComplianceCard";
import { InspectionReminderCard } from "@/components/dashboard/InspectionReminderCard";
import { ComplianceCalendar } from "@/components/dashboard/ComplianceCalendar";
import { Car, Users, AlertTriangle, TrendingUp, Clock, Gauge } from "lucide-react";
import { VehicleStatus, vehicleStatusLabels } from "@/types/database";

interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  orderedVehicles: number;
  returningVehicles: number;
  returnedVehicles: number;
  totalUsers: number;
  vehiclesNearingContractEnd: number;
  vehiclesOverMileage: number;
}

export default function Dashboard() {
  const { isAdmin, userRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchAdminStats = async () => {
    try {
      // Fetch vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("*");

      if (vehiclesError) throw vehiclesError;

      // Fetch users count
      const { count: usersCount, error: usersError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      if (usersError) throw usersError;

      // Calculate stats
      const now = new Date();
      const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const vehiclesList = vehicles || [];
      
      const vehiclesNearingContractEnd = vehiclesList.filter((v) => {
        if (!v.contract_end_date) return false;
        const endDate = new Date(v.contract_end_date);
        return endDate <= threeMonthsFromNow && endDate >= now;
      }).length;

      const vehiclesOverMileage = vehiclesList.filter((v) => {
        if (!v.contract_kilometers || !v.current_kilometers) return false;
        return v.current_kilometers > v.contract_kilometers;
      }).length;

      setStats({
        totalVehicles: vehiclesList.length,
        activeVehicles: vehiclesList.filter((v) => v.status === "active").length,
        orderedVehicles: vehiclesList.filter((v) => v.status === "ordered").length,
        returningVehicles: vehiclesList.filter((v) => v.status === "returning").length,
        returnedVehicles: vehiclesList.filter((v) => v.status === "returned").length,
        totalUsers: usersCount || 0,
        vehiclesNearingContractEnd,
        vehiclesOverMileage,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    // User dashboard - redirect to my-vehicle or show simplified view
    return (
      <DashboardLayout>
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold tracking-tight">Tervetuloa!</h1>
          <p className="mt-2 text-muted-foreground">
            Siirry "Oma ajoneuvo" -sivulle nähdäksesi ajoneuvosi tiedot.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yleisnäkymä</h1>
          <p className="text-muted-foreground">
            Ajoneuvokaluston tilannekatsaus
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Ajoneuvoja yhteensä"
            value={stats?.totalVehicles}
            icon={Car}
            loading={loading}
          />
          <StatsCard
            title="Aktiivisia"
            value={stats?.activeVehicles}
            icon={TrendingUp}
            loading={loading}
            variant="success"
          />
          <StatsCard
            title="Käyttäjiä"
            value={stats?.totalUsers}
            icon={Users}
            loading={loading}
          />
          <StatsCard
            title="Tilattuja"
            value={stats?.orderedVehicles}
            icon={Clock}
            loading={loading}
            variant="warning"
          />
        </div>

        {/* Alerts */}
        {!loading && stats && (stats.vehiclesNearingContractEnd > 0 || stats.vehiclesOverMileage > 0) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Huomioitavaa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.vehiclesNearingContractEnd > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-background p-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-warning" />
                    <span>Sopimus päättymässä 3 kk sisällä</span>
                  </div>
                  <Badge variant="secondary">{stats.vehiclesNearingContractEnd} ajoneuvoa</Badge>
                </div>
              )}
              {stats.vehiclesOverMileage > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-background p-3">
                  <div className="flex items-center gap-3">
                    <Gauge className="h-4 w-4 text-destructive" />
                    <span>Sopimuskilometrit ylitetty</span>
                  </div>
                  <Badge variant="destructive">{stats.vehiclesOverMileage} ajoneuvoa</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Inspection Reminder */}
        <InspectionReminderCard />

        {/* Compliance Card - Monthly Inspections */}
        <AdminComplianceCard />

        {/* Compliance Calendar */}
        <ComplianceCalendar />

        {/* Vehicle Status Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Ajoneuvojen tilat</CardTitle>
            <CardDescription>Kaluston jakautuminen tiloittain</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <StatusBar label="Aktiivinen" count={stats?.activeVehicles || 0} total={stats?.totalVehicles || 1} status="active" />
                <StatusBar label="Tilattu" count={stats?.orderedVehicles || 0} total={stats?.totalVehicles || 1} status="ordered" />
                <StatusBar label="Palautuksessa" count={stats?.returningVehicles || 0} total={stats?.totalVehicles || 1} status="returning" />
                <StatusBar label="Palautettu" count={stats?.returnedVehicles || 0} total={stats?.totalVehicles || 1} status="returned" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

interface StatsCardProps {
  title: string;
  value: number | undefined;
  icon: React.ElementType;
  loading: boolean;
  variant?: "default" | "success" | "warning" | "destructive";
}

function StatsCard({ title, value, icon: Icon, loading, variant = "default" }: StatsCardProps) {
  const iconColorClass = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[variant];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconColorClass}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatusBarProps {
  label: string;
  count: number;
  total: number;
  status: VehicleStatus;
}

function StatusBar({ label, count, total, status }: StatusBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  const colorClass = {
    ordered: "bg-status-ordered",
    active: "bg-status-active",
    returning: "bg-status-returning",
    returned: "bg-status-returned",
  }[status];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

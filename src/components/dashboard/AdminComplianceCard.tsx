import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardCheck, AlertTriangle, User, Car, Gauge } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { fi } from "date-fns/locale";

interface MissingItem {
  userId: string;
  userName: string;
  userEmail: string;
  vehicleName: string;
  vehiclePlate: string;
  missingInspection: boolean;
  missingMileage: boolean;
}

interface ComplianceStats {
  totalActiveVehicles: number;
  completedInspections: number;
  pendingInspections: number;
  missingItems: MissingItem[];
}

export function AdminComplianceCard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ComplianceStats | null>(null);

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      const currentMonth = startOfMonth(new Date()).toISOString().split("T")[0];

      // Get all active vehicles with responsible users
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select(`
          id,
          make,
          model,
          license_plate,
          responsible_user_id,
          current_kilometers
        `)
        .eq("status", "active")
        .not("responsible_user_id", "is", null);

      if (vehiclesError) throw vehiclesError;

      // Get all inspections for current month
      const { data: inspections, error: inspectionsError } = await supabase
        .from("vehicle_inspections")
        .select("vehicle_id, status")
        .eq("inspection_month", currentMonth);

      if (inspectionsError) throw inspectionsError;

      // Get user profiles for vehicle owners
      const userIds = [...new Set(vehicles?.map((v) => v.responsible_user_id).filter(Boolean))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Get mileage logs for current month
      const startOfCurrentMonth = startOfMonth(new Date());
      const { data: mileageLogs, error: mileageError } = await supabase
        .from("mileage_logs")
        .select("vehicle_id")
        .gte("logged_at", startOfCurrentMonth.toISOString());

      if (mileageError) throw mileageError;

      // Calculate stats
      const inspectionMap = new Map(inspections?.map((i) => [i.vehicle_id, i.status]));
      const mileageSet = new Set(mileageLogs?.map((m) => m.vehicle_id));
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      const missingItems: MissingItem[] = [];
      let completed = 0;
      let pending = 0;

      vehicles?.forEach((vehicle) => {
        const inspectionStatus = inspectionMap.get(vehicle.id);
        const hasMileageLog = mileageSet.has(vehicle.id);
        const profile = profileMap.get(vehicle.responsible_user_id);

        if (inspectionStatus === "completed") {
          completed++;
        } else {
          pending++;
        }

        const missingInspection = inspectionStatus !== "completed";
        const missingMileage = !hasMileageLog;

        if (missingInspection || missingMileage) {
          missingItems.push({
            userId: vehicle.responsible_user_id!,
            userName: profile?.full_name || "Tuntematon",
            userEmail: profile?.email || "",
            vehicleName: `${vehicle.make} ${vehicle.model}`,
            vehiclePlate: vehicle.license_plate,
            missingInspection,
            missingMileage,
          });
        }
      });

      setStats({
        totalActiveVehicles: vehicles?.length || 0,
        completedInspections: completed,
        pendingInspections: pending,
        missingItems,
      });
    } catch (error) {
      console.error("Error fetching compliance data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const completionPercentage =
    stats.totalActiveVehicles > 0
      ? Math.round((stats.completedInspections / stats.totalActiveVehicles) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Kuukausitarkastukset - {format(new Date(), "LLLL", { locale: fi })}
        </CardTitle>
        <CardDescription>
          Toteutumisaste ja puuttuvat tarkastukset
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Completion Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Toteutumisaste</span>
            <span className="text-2xl font-bold">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{stats.completedInspections} suoritettu</span>
            <span>{stats.pendingInspections} puuttuu</span>
          </div>
        </div>

        {/* Missing Items List */}
        {stats.missingItems.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Puuttuvat kirjaukset ({stats.missingItems.length})
            </h4>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {stats.missingItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{item.userName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Car className="h-3 w-3" />
                        <span>{item.vehicleName}</span>
                        <span className="text-xs">({item.vehiclePlate})</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {item.missingInspection && (
                        <Badge variant="destructive" className="text-xs">
                          <ClipboardCheck className="h-3 w-3 mr-1" />
                          Tarkastus
                        </Badge>
                      )}
                      {item.missingMileage && (
                        <Badge variant="secondary" className="text-xs">
                          <Gauge className="h-3 w-3 mr-1" />
                          Kilometrit
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {stats.missingItems.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 text-success" />
            <p>Kaikki tarkastukset ja kirjaukset on tehty!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

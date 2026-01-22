import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  Fuel,
  Calendar,
  Gauge,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  Vehicle,
  LeasingCompany,
  MileageLog,
  vehicleStatusLabels,
  fuelTypeLabels,
  VehicleStatus,
  FuelType,
} from "@/types/database";

interface VehicleWithCompany extends Vehicle {
  leasing_companies?: LeasingCompany | null;
}

export default function MyVehicle() {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<VehicleWithCompany | null>(null);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMileage, setNewMileage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchMyVehicle();
    }
  }, [user]);

  const fetchMyVehicle = async () => {
    try {
      // Fetch vehicle assigned to user
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select("*, leasing_companies(*)")
        .eq("responsible_user_id", user?.id)
        .maybeSingle();

      if (vehicleError) throw vehicleError;

      if (vehicleData) {
        setVehicle(vehicleData as VehicleWithCompany);

        // Fetch mileage logs
        const { data: logsData, error: logsError } = await supabase
          .from("mileage_logs")
          .select("*")
          .eq("vehicle_id", vehicleData.id)
          .order("logged_at", { ascending: false })
          .limit(10);

        if (logsError) throw logsError;
        setMileageLogs(logsData as MileageLog[]);
      }
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Ajoneuvotietojen hakeminen epäonnistui.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogMileage = async () => {
    const kilometers = parseInt(newMileage);
    if (!kilometers || kilometers <= 0) {
      toast({
        variant: "destructive",
        title: "Virheellinen lukema",
        description: "Syötä kelvollinen kilometrilukema.",
      });
      return;
    }

    if (vehicle?.current_kilometers && kilometers < vehicle.current_kilometers) {
      toast({
        variant: "destructive",
        title: "Virheellinen lukema",
        description: "Uusi lukema ei voi olla pienempi kuin nykyinen.",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Insert mileage log
      const { error: logError } = await supabase.from("mileage_logs").insert({
        vehicle_id: vehicle?.id,
        user_id: user?.id,
        kilometers,
        logged_at: new Date().toISOString(),
      });

      if (logError) throw logError;

      // Update vehicle current kilometers
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({ current_kilometers: kilometers })
        .eq("id", vehicle?.id);

      if (updateError) throw updateError;

      toast({
        title: "Kilometrit kirjattu",
        description: `Uusi lukema: ${kilometers.toLocaleString("fi-FI")} km`,
      });

      setNewMileage("");
      fetchMyVehicle();
    } catch (error: any) {
      console.error("Error logging mileage:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Kilometrien kirjaaminen epäonnistui.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calculateMileageStatus = () => {
    if (!vehicle?.contract_kilometers || !vehicle?.current_kilometers) {
      return { percentage: 0, isOverLimit: false, remainingKm: 0, projectedEnd: 0 };
    }

    const percentage = (vehicle.current_kilometers / vehicle.contract_kilometers) * 100;
    const isOverLimit = vehicle.current_kilometers > vehicle.contract_kilometers;
    const remainingKm = vehicle.contract_kilometers - vehicle.current_kilometers;

    // Simple projection based on average daily usage
    let projectedEnd = 0;
    if (vehicle.contract_start_date && mileageLogs.length > 0) {
      const startDate = new Date(vehicle.contract_start_date);
      const now = new Date();
      const daysElapsed = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const dailyAverage = vehicle.current_kilometers / daysElapsed;
      
      if (vehicle.contract_end_date) {
        const endDate = new Date(vehicle.contract_end_date);
        const daysRemaining = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        projectedEnd = vehicle.current_kilometers + (dailyAverage * daysRemaining);
      }
    }

    return { percentage: Math.min(percentage, 100), isOverLimit, remainingKm, projectedEnd };
  };

  const getStatusBadgeClass = (status: VehicleStatus) => {
    const classes = {
      ordered: "status-ordered",
      active: "status-active",
      returning: "status-returning",
      returned: "status-returned",
    };
    return classes[status];
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!vehicle) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <Car className="h-16 w-16 text-muted-foreground/30" />
          <h2 className="mt-6 text-xl font-semibold">Ei ajoneuvoa</h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Sinulle ei ole vielä osoitettu ajoneuvoa. Ota yhteyttä ylläpitäjään.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const mileageStatus = calculateMileageStatus();

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Oma ajoneuvo</h1>
          <p className="text-muted-foreground">
            Ajoneuvosi tiedot ja kilometriseuranta
          </p>
        </div>

        {/* Vehicle Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <Car className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    {vehicle.make} {vehicle.model}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-base">
                    {vehicle.license_plate}
                  </CardDescription>
                </div>
              </div>
              <Badge className={getStatusBadgeClass(vehicle.status as VehicleStatus)}>
                {vehicleStatusLabels[vehicle.status as VehicleStatus]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <Fuel className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Käyttövoima</p>
                  <p className="font-medium">{fuelTypeLabels[vehicle.fuel_type as FuelType]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Leasingyhtiö</p>
                  <p className="font-medium">
                    {vehicle.leasing_companies?.name || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Sopimus päättyy</p>
                  <p className="font-medium">
                    {vehicle.contract_end_date
                      ? new Date(vehicle.contract_end_date).toLocaleDateString("fi-FI")
                      : "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Gauge className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Sopimuskilometrit</p>
                  <p className="font-medium">
                    {vehicle.contract_kilometers?.toLocaleString("fi-FI") || "-"} km
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mileage Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Kilometriseuranta
            </CardTitle>
            <CardDescription>
              Nykyinen lukema ja ennuste
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ajettu</span>
                <span className="font-medium">
                  {vehicle.current_kilometers?.toLocaleString("fi-FI") || 0} /{" "}
                  {vehicle.contract_kilometers?.toLocaleString("fi-FI") || "-"} km
                </span>
              </div>
              <Progress
                value={mileageStatus.percentage}
                className={mileageStatus.isOverLimit ? "bg-destructive/20" : ""}
              />
              <div className="flex items-center gap-2">
                {mileageStatus.isOverLimit ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">
                      Sopimuskilometrit ylitetty {Math.abs(mileageStatus.remainingKm).toLocaleString("fi-FI")} km:llä
                    </span>
                  </>
                ) : mileageStatus.remainingKm > 0 ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm text-muted-foreground">
                      Jäljellä {mileageStatus.remainingKm.toLocaleString("fi-FI")} km
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            {/* Mileage Input */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <Label htmlFor="mileage" className="text-sm font-medium">
                Kirjaa uusi mittarilukema
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="mileage"
                  type="number"
                  placeholder="esim. 45000"
                  value={newMileage}
                  onChange={(e) => setNewMileage(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleLogMileage} disabled={isSaving}>
                  {isSaving ? "Kirjataan..." : "Kirjaa"}
                </Button>
              </div>
            </div>

            {/* Recent Logs */}
            {mileageLogs.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium">Viimeisimmät kirjaukset</h4>
                <div className="space-y-2">
                  {mileageLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.logged_at).toLocaleDateString("fi-FI")}
                      </span>
                      <span className="font-mono text-sm font-medium">
                        {log.kilometers.toLocaleString("fi-FI")} km
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

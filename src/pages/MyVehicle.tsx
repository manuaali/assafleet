import { useEffect, useState, useRef } from "react";
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
import { useMileageDueStatus, formatDueDateMessage } from "@/hooks/use-mileage-due";
import { getMileagePredictionFromLogs } from "@/hooks/use-mileage-prediction";
import { cn, formatDate } from "@/lib/utils";
import { ServiceVisitsCard } from "@/components/vehicles/ServiceVisitsCard";
import {
  Car,
  Fuel,
  Calendar,
  Gauge,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Snowflake,
  Wrench,
  Phone,
  Clock,
  CalendarClock,
  Activity,
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

interface VehicleData {
  vehicle: VehicleWithCompany;
  mileageLogs: MileageLog[];
}

// Single vehicle card component
function VehicleCard({ 
  vehicleData, 
  onMileageLogged 
}: { 
  vehicleData: VehicleData; 
  onMileageLogged: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMileage, setNewMileage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [shouldBounce, setShouldBounce] = useState(false);
  const mileageSectionRef = useRef<HTMLDivElement>(null);
  const mileageInputRef = useRef<HTMLInputElement>(null);
  
  const { vehicle, mileageLogs } = vehicleData;
  const { status: mileageDueStatus } = useMileageDueStatus(vehicle.id);

  // Auto-scroll to mileage section and trigger bounce animation if mileage is due
  useEffect(() => {
    if (mileageDueStatus?.isDue && !mileageDueStatus?.hasLoggedThisWeek) {
      const scrollTimer = setTimeout(() => {
        mileageSectionRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "center" 
        });
        
        setTimeout(() => {
          setShouldBounce(true);
          setTimeout(() => setShouldBounce(false), 1000);
        }, 500);
      }, 300);
      
      return () => clearTimeout(scrollTimer);
    }
  }, [mileageDueStatus]);

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

    if (vehicle.current_kilometers && kilometers < vehicle.current_kilometers) {
      toast({
        variant: "destructive",
        title: "Virheellinen lukema",
        description: "Uusi lukema ei voi olla pienempi kuin nykyinen.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error: logError } = await supabase.from("mileage_logs").insert({
        vehicle_id: vehicle.id,
        user_id: user?.id,
        kilometers,
        logged_at: new Date().toISOString(),
      });

      if (logError) throw logError;

      const { error: updateError } = await supabase
        .from("vehicles")
        .update({ current_kilometers: kilometers })
        .eq("id", vehicle.id);

      if (updateError) throw updateError;

      toast({
        title: "Kilometrit kirjattu",
        description: `${vehicle.make} ${vehicle.model}: ${kilometers.toLocaleString("fi-FI")} km`,
      });

      setNewMileage("");
      onMileageLogged();
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
    if (!vehicle.contract_kilometers || !vehicle.current_kilometers) {
      return { percentage: 0, isOverLimit: false, remainingKm: 0 };
    }

    const percentage = (vehicle.current_kilometers / vehicle.contract_kilometers) * 100;
    const isOverLimit = vehicle.current_kilometers > vehicle.contract_kilometers;
    const remainingKm = vehicle.contract_kilometers - vehicle.current_kilometers;

    return { percentage: Math.min(percentage, 100), isOverLimit, remainingKm };
  };

  const getStatusBadgeClass = (status: VehicleStatus) => {
    const classes: Record<string, string> = {
      ordered: "status-ordered",
      active: "status-active",
      returning: "status-returning",
      returned: "status-returned",
      out_of_use: "status-out-of-use",
    };
    return classes[status] || "";
  };

  const mileageStatus = calculateMileageStatus();
  
  // Calculate mileage prediction
  const mileagePrediction = getMileagePredictionFromLogs(
    mileageLogs.map(log => ({ kilometers: log.kilometers, logged_at: log.logged_at })),
    vehicle.contract_kilometers,
    vehicle.contract_end_date
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Vehicle Info Card */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Car className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg sm:text-xl truncate">
                  {vehicle.make} {vehicle.model}
                </CardTitle>
                <CardDescription className="mt-0.5 sm:mt-1 font-mono text-sm sm:text-base">
                  {vehicle.license_plate}
                </CardDescription>
              </div>
            </div>
            <Badge className={cn("self-start sm:self-auto", getStatusBadgeClass(vehicle.status as VehicleStatus))}>
              {vehicleStatusLabels[vehicle.status as VehicleStatus]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 sm:pt-0">
          <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <Fuel className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Käyttövoima</p>
                <p className="text-sm sm:text-base font-medium truncate">{fuelTypeLabels[vehicle.fuel_type as FuelType]}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3">
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Leasingyhtiö</p>
                <p className="text-sm sm:text-base font-medium truncate">
                  {vehicle.leasing_companies?.name || "-"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Sopimus päättyy</p>
                <p className="text-sm sm:text-base font-medium">
                  {vehicle.contract_end_date
                    ? formatDate(vehicle.contract_end_date)
                    : "-"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3">
              <Gauge className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Sopimuskilometrit</p>
                <p className="text-sm sm:text-base font-medium">
                  {vehicle.contract_kilometers?.toLocaleString("fi-FI") || "-"} km
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service and Tires Card */}
      {(vehicle.winter_tires_location || vehicle.service_location_name) && (
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Wrench className="h-4 w-4 sm:h-5 sm:w-5" />
              Huolto ja renkaat
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              {vehicle.winter_tires_location && (
                <div className="flex items-start gap-2 sm:gap-3">
                  <Snowflake className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Renkaiden säilytyspaikka</p>
                    <p className="text-sm sm:text-base font-medium">{vehicle.winter_tires_location}</p>
                  </div>
                </div>
              )}
              {vehicle.service_location_name && (
                <div className="flex items-start gap-2 sm:gap-3">
                  <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Huoltopaikka</p>
                    <p className="text-sm sm:text-base font-medium">{vehicle.service_location_name}</p>
                    {vehicle.service_location_phone && (
                      <a 
                        href={`tel:${vehicle.service_location_phone}`}
                        className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline bg-primary/10 px-3 py-2 rounded-lg active:bg-primary/20 transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        {vehicle.service_location_phone}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mileage Status Card */}
      <Card ref={mileageSectionRef} className={cn(
        mileageDueStatus?.isDue && !mileageDueStatus?.hasLoggedThisWeek && "ring-2 ring-warning",
        mileageDueStatus?.isOverdue && "ring-2 ring-destructive"
      )}>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Kilometriseuranta
            </CardTitle>
            {mileageDueStatus && (
              <Badge 
                variant={mileageDueStatus.isOverdue ? "destructive" : mileageDueStatus.isDue ? "warning" : "secondary"}
                className="flex items-center gap-1 self-start sm:self-auto text-xs sm:text-sm"
              >
                <Clock className="h-3 w-3" />
                {formatDueDateMessage(mileageDueStatus)}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Nykyinen lukema ja ennuste
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 pt-0">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between text-sm sm:text-base">
              <span className="text-muted-foreground">Ajettu</span>
              <span className="font-medium">
                {vehicle.current_kilometers?.toLocaleString("fi-FI") || 0} /{" "}
                {vehicle.contract_kilometers?.toLocaleString("fi-FI") || "-"} km
              </span>
            </div>
            <Progress
              value={mileageStatus.percentage}
              className={cn("h-2 sm:h-2.5", mileageStatus.isOverLimit ? "bg-destructive/20" : "")}
            />
            <div className="flex items-center gap-2">
              {mileageStatus.isOverLimit ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-xs sm:text-sm text-destructive">
                    Ylitetty {Math.abs(mileageStatus.remainingKm).toLocaleString("fi-FI")} km
                  </span>
                </>
              ) : mileageStatus.remainingKm > 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Jäljellä {mileageStatus.remainingKm.toLocaleString("fi-FI")} km
                  </span>
                </>
              ) : null}
            </div>

            {/* Mileage Prediction */}
            {mileagePrediction.hasEnoughData && mileagePrediction.averageKmPerWeek && (
              <div className="rounded-lg border bg-muted/20 p-3 sm:p-4 space-y-2 sm:space-y-3">
                <h4 className="text-xs sm:text-sm font-medium flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  Kilometriarvio
                </h4>
                <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Keskim. viikossa</p>
                      <p className="text-sm sm:text-base font-medium">
                        {mileagePrediction.averageKmPerWeek.toLocaleString("fi-FI")} km
                      </p>
                    </div>
                  </div>
                  {mileagePrediction.predictedKmInOneMonth && (
                    <div className="flex items-start gap-2">
                      <CalendarClock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Arvio kk:n päästä</p>
                        <p className="text-sm sm:text-base font-medium">
                          {mileagePrediction.predictedKmInOneMonth.toLocaleString("fi-FI")} km
                        </p>
                      </div>
                    </div>
                  )}
                  {mileagePrediction.predictedKmAtContractEnd && (
                    <div className="flex items-start gap-2">
                      <Gauge className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Arvio sop. päättyessä</p>
                        <p className="text-sm sm:text-base font-medium">
                          {mileagePrediction.predictedKmAtContractEnd.toLocaleString("fi-FI")} km
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mileage Input */}
          <div className={cn(
            "rounded-lg border bg-muted/30 p-3 sm:p-4 transition-all duration-300",
            mileageDueStatus?.isDue && !mileageDueStatus?.hasLoggedThisWeek && "border-warning bg-warning/10",
            mileageDueStatus?.isOverdue && "border-destructive bg-destructive/10"
          )}>
            <Label htmlFor={`mileage-${vehicle.id}`} className="text-xs sm:text-sm font-medium">
              Kirjaa uusi mittarilukema
            </Label>
            <div className="mt-2 flex gap-2">
              <Input
                ref={mileageInputRef}
                id={`mileage-${vehicle.id}`}
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="esim. 45000"
                value={newMileage}
                onChange={(e) => setNewMileage(e.target.value)}
                className={cn(
                  "flex-1 text-base sm:text-sm h-12 sm:h-10 transition-all duration-300",
                  shouldBounce && "animate-bounce-once scale-105 ring-2 ring-primary"
                )}
              />
              <Button 
                onClick={handleLogMileage} 
                disabled={isSaving}
                className="h-12 sm:h-10 px-4 sm:px-4 text-sm sm:text-sm min-w-[80px]"
              >
                {isSaving ? "..." : "Kirjaa"}
              </Button>
            </div>
          </div>

          {/* Recent Logs */}
          {mileageLogs.length > 0 && (
            <div>
              <h4 className="mb-2 sm:mb-3 text-xs sm:text-sm font-medium">Viimeisimmät kirjaukset</h4>
              <div className="space-y-1.5 sm:space-y-2">
                {mileageLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5 sm:py-2"
                  >
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {formatDate(log.logged_at)}
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-medium">
                      {log.kilometers.toLocaleString("fi-FI")} km
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Visits Card */}
      <ServiceVisitsCard vehicleId={vehicle.id} />

      {/* Activity Log */}
      <VehicleActivityLog vehicleId={vehicle.id} />
    </div>
  );
}

export default function MyVehicle() {
  const { user } = useAuth();
  const [vehiclesData, setVehiclesData] = useState<VehicleData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchMyVehicles();
    }
  }, [user]);

  const fetchMyVehicles = async () => {
    try {
      // Fetch all vehicles assigned to user
      const { data: vehiclesResult, error: vehicleError } = await supabase
        .from("vehicles")
        .select("*, leasing_companies(*)")
        .eq("responsible_user_id", user?.id)
        .order("created_at", { ascending: true });

      if (vehicleError) throw vehicleError;

      if (vehiclesResult && vehiclesResult.length > 0) {
        // Fetch mileage logs for all vehicles
        const vehicleIds = vehiclesResult.map(v => v.id);
        const { data: logsData, error: logsError } = await supabase
          .from("mileage_logs")
          .select("*")
          .in("vehicle_id", vehicleIds)
          .order("logged_at", { ascending: false });

        if (logsError) throw logsError;

        // Group logs by vehicle
        const logsByVehicle = new Map<string, MileageLog[]>();
        logsData?.forEach(log => {
          const existing = logsByVehicle.get(log.vehicle_id) || [];
          logsByVehicle.set(log.vehicle_id, [...existing, log as MileageLog]);
        });

        // Build vehicle data array
        const data: VehicleData[] = vehiclesResult.map(vehicle => ({
          vehicle: vehicle as VehicleWithCompany,
          mileageLogs: (logsByVehicle.get(vehicle.id) || []).slice(0, 10),
        }));

        setVehiclesData(data);
      } else {
        setVehiclesData([]);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast({
        variant: "destructive",
        title: "Virhe",
        description: "Ajoneuvotietojen hakeminen epäonnistui.",
      });
    } finally {
      setLoading(false);
    }
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

  if (vehiclesData.length === 0) {
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

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {vehiclesData.length > 1 ? "Omat ajoneuvot" : "Oma ajoneuvo"}
          </h1>
          <p className="text-muted-foreground">
            {vehiclesData.length > 1 
              ? `Sinulla on ${vehiclesData.length} ajoneuvoa` 
              : "Ajoneuvosi tiedot ja kilometriseuranta"
            }
          </p>
        </div>

        {vehiclesData.map((data, index) => (
          <div key={data.vehicle.id}>
            {vehiclesData.length > 1 && (
              <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
                Ajoneuvo {index + 1}
              </h2>
            )}
            <VehicleCard 
              vehicleData={data} 
              onMileageLogged={fetchMyVehicles} 
            />
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

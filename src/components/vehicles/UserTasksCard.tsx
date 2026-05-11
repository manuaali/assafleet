import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Phone,
  TrendingUp,
  ListTodo,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMileageDueStatus } from "@/hooks/use-mileage-due";
import { getMileagePredictionFromLogs } from "@/hooks/use-mileage-prediction";
import { ProfileDialog } from "@/components/profile/ProfileDialog";
import { cn, formatDate } from "@/lib/utils";
import type { Vehicle, MileageLog } from "@/types/database";
import { startOfMonth } from "date-fns";

type Severity = "info" | "warning" | "destructive";

interface Task {
  key: string;
  icon: React.ElementType;
  title: string;
  description?: string;
  severity: Severity;
  actionLabel: string;
  onAction: () => void;
}

interface UserTasksCardProps {
  vehicle: Vehicle;
  mileageLogs: MileageLog[];
  /** Scroll the user to the mileage logging section in this vehicle card */
  onScrollToMileage?: () => void;
}

export function UserTasksCard({ vehicle, mileageLogs, onScrollToMileage }: UserTasksCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: mileageDueStatus } = useMileageDueStatus(vehicle.id);
  const [profileOpen, setProfileOpen] = useState(false);
  const [phoneMissing, setPhoneMissing] = useState<boolean>(false);
  const [inspectionDoneThisMonth, setInspectionDoneThisMonth] = useState<boolean | null>(null);

  // Phone check
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPhoneMissing(!data?.phone || data.phone.trim() === "");
      });
  }, [user]);

  // Inspection-this-month check (per vehicle)
  useEffect(() => {
    // Match storage convention used in VehicleInspection.tsx (UTC date string)
    const month = startOfMonth(new Date()).toISOString().split("T")[0];
    supabase
      .from("vehicle_inspections")
      .select("status")
      .eq("vehicle_id", vehicle.id)
      .eq("inspection_month", month)
      .maybeSingle()
      .then(({ data }) => {
        setInspectionDoneThisMonth(data?.status === "completed");
      });
  }, [vehicle.id]);

  const prediction = useMemo(
    () =>
      getMileagePredictionFromLogs(
        mileageLogs.map((l) => ({ kilometers: l.kilometers, logged_at: l.logged_at })),
        vehicle.contract_kilometers,
        vehicle.contract_end_date
      ),
    [mileageLogs, vehicle.contract_kilometers, vehicle.contract_end_date]
  );

  const tasks: Task[] = [];

  // 1. Kilometrit
  if (mileageDueStatus?.isDue && !mileageDueStatus.hasLoggedThisWeek) {
    tasks.push({
      key: "mileage",
      icon: Gauge,
      title: "Kirjaa kilometrit",
      description: mileageDueStatus.isOverdue
        ? `Myöhässä ${mileageDueStatus.daysOverdue} pv`
        : "Tämän viikon mittarilukema puuttuu",
      severity: mileageDueStatus.isOverdue ? "destructive" : "warning",
      actionLabel: "Kirjaa",
      onAction: () => onScrollToMileage?.(),
    });
  }

  // 2. Kuukausitarkastus
  if (inspectionDoneThisMonth === false) {
    tasks.push({
      key: "inspection",
      icon: ClipboardCheck,
      title: "Suorita kuukausitarkastus",
      description: "Tämän kuukauden tarkastus puuttuu",
      severity: "warning",
      actionLabel: "Aloita",
      onAction: () => navigate("/inspection"),
    });
  }

  // 3. Puhelinnumero
  if (phoneMissing) {
    tasks.push({
      key: "phone",
      icon: Phone,
      title: "Lisää puhelinnumero",
      description: "Profiilistasi puuttuu yhteystieto",
      severity: "info",
      actionLabel: "Lisää",
      onAction: () => setProfileOpen(true),
    });
  }

  // 4. Sopimus päättymässä
  if (vehicle.contract_end_date) {
    const daysLeft = differenceInDays(new Date(vehicle.contract_end_date), new Date());
    if (daysLeft >= 0 && daysLeft <= 60) {
      tasks.push({
        key: "contract-end",
        icon: CalendarClock,
        title: "Sopimus päättymässä",
        description: `${daysLeft} pv jäljellä — ${formatDate(vehicle.contract_end_date)}`,
        severity: "warning",
        actionLabel: "OK",
        onAction: () => {},
      });
    }
  }

  // 5. Sopimuskilometrit ylittymässä
  if (vehicle.contract_kilometers && vehicle.current_kilometers) {
    const pct = (vehicle.current_kilometers / vehicle.contract_kilometers) * 100;
    const willExceed =
      prediction.predictedKmAtContractEnd != null &&
      vehicle.contract_kilometers != null &&
      prediction.predictedKmAtContractEnd > vehicle.contract_kilometers;

    if (pct >= 100) {
      tasks.push({
        key: "km-over",
        icon: AlertTriangle,
        title: "Sopimuskilometrit ylitetty",
        description: `${vehicle.current_kilometers.toLocaleString("fi-FI")} / ${vehicle.contract_kilometers.toLocaleString("fi-FI")} km`,
        severity: "destructive",
        actionLabel: "OK",
        onAction: () => {},
      });
    } else if (pct >= 90) {
      tasks.push({
        key: "km-warning",
        icon: TrendingUp,
        title: "Sopimuskilometrit lähellä rajaa",
        description: `${pct.toFixed(0)} % sopimuksesta käytetty`,
        severity: "warning",
        actionLabel: "OK",
        onAction: () => {},
      });
    } else if (willExceed) {
      tasks.push({
        key: "km-forecast",
        icon: TrendingUp,
        title: "Kilometrit uhkaavat ylittyä",
        description: `Ennuste sopimuksen päättyessä: ${prediction.predictedKmAtContractEnd!.toLocaleString("fi-FI")} km`,
        severity: "warning",
        actionLabel: "OK",
        onAction: () => {},
      });
    }
  }

  if (tasks.length === 0) return null;

  return (
    <>
      <Card className="border-warning/30">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ListTodo className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
            Tehtävät ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {tasks.map((t) => {
            const Icon = t.icon;
            const isInfo = t.severity === "info";
            const isWarn = t.severity === "warning";
            const isDest = t.severity === "destructive";
            return (
              <div
                key={t.key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  isInfo && "border-border bg-muted/30",
                  isWarn && "border-warning/40 bg-warning/10",
                  isDest && "border-destructive/40 bg-destructive/10"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isInfo && "text-muted-foreground",
                    isWarn && "text-warning",
                    isDest && "text-destructive"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                  )}
                </div>
                {t.actionLabel !== "OK" && (
                  <Button
                    size="sm"
                    variant={isDest ? "destructive" : isWarn ? "default" : "secondary"}
                    onClick={t.onAction}
                    className="shrink-0"
                  >
                    {t.actionLabel}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

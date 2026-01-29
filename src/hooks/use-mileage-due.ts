import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, addDays, isBefore, isAfter, differenceInDays, format } from "date-fns";
import { fi } from "date-fns/locale";

export interface MileageDueStatus {
  isDue: boolean;
  isOverdue: boolean;
  daysUntilDue: number;
  daysOverdue: number;
  nextDueDate: Date;
  lastLogDate: Date | null;
  hasLoggedThisWeek: boolean;
}

/**
 * Get the next Monday at 00:00 from a given date.
 * If today is Monday and no log exists, it's due today.
 */
export function getNextMondayDueDate(fromDate: Date = new Date()): Date {
  // Start of the current week (Monday)
  const weekStart = startOfWeek(fromDate, { weekStartsOn: 1 });
  
  // If we're before or on Monday, due date is this Monday
  // If we're past Monday, due date is next Monday
  const monday = weekStart;
  
  if (isBefore(fromDate, monday) || fromDate.toDateString() === monday.toDateString()) {
    return monday;
  }
  
  // Next Monday
  return addDays(weekStart, 7);
}

/**
 * Get the current week's Monday (the due date for this week)
 */
export function getCurrentWeekMonday(fromDate: Date = new Date()): Date {
  return startOfWeek(fromDate, { weekStartsOn: 1 });
}

/**
 * Calculate mileage due status based on last log date
 */
export function calculateMileageDueStatus(lastLogDate: Date | null, now: Date = new Date()): MileageDueStatus {
  const currentWeekMonday = getCurrentWeekMonday(now);
  const nextMonday = addDays(currentWeekMonday, 7);
  
  // Check if there's a log from this week (on or after this Monday)
  const hasLoggedThisWeek = lastLogDate ? !isBefore(lastLogDate, currentWeekMonday) : false;
  
  // If logged this week, next due is next Monday
  // If not logged, due is this Monday (which may be overdue)
  const nextDueDate = hasLoggedThisWeek ? nextMonday : currentWeekMonday;
  
  // Calculate days until due or overdue
  const daysDiff = differenceInDays(nextDueDate, now);
  
  const isDue = !hasLoggedThisWeek; // Due if not logged this week
  const isOverdue = isDue && isAfter(now, currentWeekMonday); // Overdue if past Monday and not logged
  
  return {
    isDue,
    isOverdue,
    daysUntilDue: hasLoggedThisWeek ? Math.max(0, daysDiff) : 0,
    daysOverdue: isOverdue ? Math.abs(differenceInDays(now, currentWeekMonday)) : 0,
    nextDueDate,
    lastLogDate,
    hasLoggedThisWeek,
  };
}

/**
 * Format the due date message
 */
export function formatDueDateMessage(status: MileageDueStatus): string {
  if (status.hasLoggedThisWeek) {
    const daysUntil = status.daysUntilDue;
    if (daysUntil === 0) {
      return "Seuraava kirjaus tänään";
    } else if (daysUntil === 1) {
      return "Seuraava kirjaus huomenna";
    } else {
      return `Seuraava kirjaus ${daysUntil} päivän päästä`;
    }
  } else {
    if (status.isOverdue) {
      if (status.daysOverdue === 1) {
        return "Kirjaus myöhässä 1 päivän";
      }
      return `Kirjaus myöhässä ${status.daysOverdue} päivää`;
    }
    return "Kilometrikirjaus tänään";
  }
}

/**
 * Hook to get mileage due status for a specific vehicle
 */
export function useMileageDueStatus(vehicleId: string | null | undefined) {
  const [status, setStatus] = useState<MileageDueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    const fetchLastLog = async () => {
      try {
        const { data, error } = await supabase
          .from("mileage_logs")
          .select("logged_at")
          .eq("vehicle_id", vehicleId)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        const lastLogDate = data ? new Date(data.logged_at) : null;
        setStatus(calculateMileageDueStatus(lastLogDate));
      } catch (error) {
        console.error("Error fetching mileage log status:", error);
        setStatus(calculateMileageDueStatus(null));
      } finally {
        setLoading(false);
      }
    };

    fetchLastLog();
  }, [vehicleId]);

  return { status, loading };
}

/**
 * Hook to get mileage due status for all vehicles (admin view)
 */
export function useAllVehiclesMileageStatus() {
  const [statusMap, setStatusMap] = useState<Map<string, MileageDueStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllLogs = async () => {
      try {
        // Get the latest log for each vehicle
        const { data: vehicles, error: vehiclesError } = await supabase
          .from("vehicles")
          .select("id, responsible_user_id")
          .not("responsible_user_id", "is", null);

        if (vehiclesError) throw vehiclesError;

        if (!vehicles || vehicles.length === 0) {
          setStatusMap(new Map());
          setLoading(false);
          return;
        }

        // Get latest mileage log for each vehicle
        const { data: logs, error: logsError } = await supabase
          .from("mileage_logs")
          .select("vehicle_id, logged_at")
          .in("vehicle_id", vehicles.map(v => v.id))
          .order("logged_at", { ascending: false });

        if (logsError) throw logsError;

        // Group logs by vehicle and get the latest one
        const latestLogByVehicle = new Map<string, Date>();
        logs?.forEach(log => {
          if (!latestLogByVehicle.has(log.vehicle_id)) {
            latestLogByVehicle.set(log.vehicle_id, new Date(log.logged_at));
          }
        });

        // Calculate status for each vehicle
        const newStatusMap = new Map<string, MileageDueStatus>();
        vehicles.forEach(vehicle => {
          const lastLogDate = latestLogByVehicle.get(vehicle.id) || null;
          newStatusMap.set(vehicle.id, calculateMileageDueStatus(lastLogDate));
        });

        setStatusMap(newStatusMap);
      } catch (error) {
        console.error("Error fetching all vehicles mileage status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllLogs();
  }, []);

  return { statusMap, loading };
}

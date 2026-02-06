import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, addDays } from "date-fns";

export interface MileagePrediction {
  averageKmPerWeek: number | null;
  predictedEndDate: Date | null;
  hasEnoughData: boolean; // At least 5 logs
}

/**
 * Calculate mileage prediction based on historical logs
 * Requires at least 5 logs for reliable prediction
 */
export function calculateMileagePrediction(
  logs: { kilometers: number; logged_at: string }[],
  contractKilometers: number | null
): MileagePrediction {
  // Need at least 5 logs for meaningful prediction
  if (logs.length < 5 || !contractKilometers) {
    return {
      averageKmPerWeek: null,
      predictedEndDate: null,
      hasEnoughData: logs.length >= 5,
    };
  }

  // Sort by date ascending
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  // Calculate time span and km difference
  const firstLog = sortedLogs[0];
  const lastLog = sortedLogs[sortedLogs.length - 1];
  
  const firstDate = new Date(firstLog.logged_at);
  const lastDate = new Date(lastLog.logged_at);
  
  const daysDiff = differenceInDays(lastDate, firstDate);
  const kmDiff = lastLog.kilometers - firstLog.kilometers;

  // Avoid division by zero
  if (daysDiff <= 0 || kmDiff <= 0) {
    return {
      averageKmPerWeek: null,
      predictedEndDate: null,
      hasEnoughData: true,
    };
  }

  // Calculate average km per day and per week
  const avgKmPerDay = kmDiff / daysDiff;
  const avgKmPerWeek = Math.round(avgKmPerDay * 7);

  // Calculate remaining km
  const currentKm = lastLog.kilometers;
  const remainingKm = contractKilometers - currentKm;

  // If already over limit, no prediction needed
  if (remainingKm <= 0) {
    return {
      averageKmPerWeek: avgKmPerWeek,
      predictedEndDate: null, // Already exceeded
      hasEnoughData: true,
    };
  }

  // Calculate days until contract limit reached
  const daysUntilLimit = Math.ceil(remainingKm / avgKmPerDay);
  const predictedEndDate = addDays(new Date(), daysUntilLimit);

  return {
    averageKmPerWeek: avgKmPerWeek,
    predictedEndDate,
    hasEnoughData: true,
  };
}

/**
 * Hook to get mileage prediction for a vehicle
 */
export function useMileagePrediction(
  vehicleId: string | null | undefined,
  contractKilometers: number | null
) {
  const [prediction, setPrediction] = useState<MileagePrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) {
      setPrediction(null);
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from("mileage_logs")
          .select("kilometers, logged_at")
          .eq("vehicle_id", vehicleId)
          .order("logged_at", { ascending: true });

        if (error) throw error;

        const result = calculateMileagePrediction(data || [], contractKilometers);
        setPrediction(result);
      } catch (error) {
        console.error("Error fetching mileage logs for prediction:", error);
        setPrediction(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [vehicleId, contractKilometers]);

  return { prediction, loading };
}

/**
 * Calculate prediction from existing logs (synchronous version for when logs are already loaded)
 */
export function getMileagePredictionFromLogs(
  logs: { kilometers: number; logged_at: string }[],
  contractKilometers: number | null
): MileagePrediction {
  return calculateMileagePrediction(logs, contractKilometers);
}

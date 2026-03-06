import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, addDays } from "date-fns";

export interface MileagePrediction {
  averageKmPerWeek: number | null;
  predictedKmAtContractEnd: number | null;
  predictedKmInOneMonth: number | null;
  hasEnoughData: boolean;
}

/**
 * Calculate mileage prediction based on historical logs.
 * Predicts: km at contract end date, km in 1 month.
 * Requires at least 5 logs for reliable prediction.
 */
export function calculateMileagePrediction(
  logs: { kilometers: number; logged_at: string }[],
  contractKilometers: number | null,
  contractEndDate: string | null
): MileagePrediction {
  if (logs.length < 5) {
    return {
      averageKmPerWeek: null,
      predictedKmAtContractEnd: null,
      predictedKmInOneMonth: null,
      hasEnoughData: false,
    };
  }

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  const firstLog = sortedLogs[0];
  const lastLog = sortedLogs[sortedLogs.length - 1];

  const firstDate = new Date(firstLog.logged_at);
  const lastDate = new Date(lastLog.logged_at);

  const daysDiff = differenceInDays(lastDate, firstDate);
  const kmDiff = lastLog.kilometers - firstLog.kilometers;

  if (daysDiff <= 0 || kmDiff <= 0) {
    return {
      averageKmPerWeek: null,
      predictedKmAtContractEnd: null,
      predictedKmInOneMonth: null,
      hasEnoughData: true,
    };
  }

  const avgKmPerDay = kmDiff / daysDiff;
  const avgKmPerWeek = Math.round(avgKmPerDay * 7);
  const currentKm = lastLog.kilometers;
  const now = new Date();

  // Predict km in one month (30 days)
  const daysUntilOneMonth = 30;
  const daysSinceLastLog = differenceInDays(now, lastDate);
  const predictedKmInOneMonth = Math.round(
    currentKm + avgKmPerDay * (daysSinceLastLog + daysUntilOneMonth)
  );

  // Predict km at contract end
  let predictedKmAtContractEnd: number | null = null;
  if (contractEndDate) {
    const endDate = new Date(contractEndDate);
    const daysUntilEnd = differenceInDays(endDate, now);
    if (daysUntilEnd > 0) {
      predictedKmAtContractEnd = Math.round(
        currentKm + avgKmPerDay * (daysSinceLastLog + daysUntilEnd)
      );
    }
  }

  return {
    averageKmPerWeek: avgKmPerWeek,
    predictedKmAtContractEnd,
    predictedKmInOneMonth,
    hasEnoughData: true,
  };
}

/**
 * Hook to get mileage prediction for a vehicle
 */
export function useMileagePrediction(
  vehicleId: string | null | undefined,
  contractKilometers: number | null,
  contractEndDate: string | null
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

        const result = calculateMileagePrediction(data || [], contractKilometers, contractEndDate);
        setPrediction(result);
      } catch (error) {
        console.error("Error fetching mileage logs for prediction:", error);
        setPrediction(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [vehicleId, contractKilometers, contractEndDate]);

  return { prediction, loading };
}

/**
 * Calculate prediction from existing logs (synchronous version)
 */
export function getMileagePredictionFromLogs(
  logs: { kilometers: number; logged_at: string }[],
  contractKilometers: number | null,
  contractEndDate: string | null
): MileagePrediction {
  return calculateMileagePrediction(logs, contractKilometers, contractEndDate);
}

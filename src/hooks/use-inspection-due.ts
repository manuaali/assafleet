import { useMemo } from "react";
import { startOfMonth, addDays, isWeekend, isSameMonth, differenceInDays, isAfter, isBefore, isSameDay } from "date-fns";

/**
 * Get the first working day (Monday-Friday) of a given month
 */
export function getFirstWorkingDayOfMonth(date: Date): Date {
  let firstDay = startOfMonth(date);
  
  // If it's a weekend, move to Monday
  while (isWeekend(firstDay)) {
    firstDay = addDays(firstDay, 1);
  }
  
  return firstDay;
}

/**
 * Get the first working day of the next month
 */
export function getNextInspectionDate(fromDate: Date = new Date()): Date {
  const nextMonth = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 1);
  return getFirstWorkingDayOfMonth(nextMonth);
}

/**
 * Get the first working day of the current month
 */
export function getCurrentInspectionDate(fromDate: Date = new Date()): Date {
  return getFirstWorkingDayOfMonth(fromDate);
}

export interface InspectionDueStatus {
  // Current month's inspection date
  currentMonthDate: Date;
  // Next month's inspection date
  nextMonthDate: Date;
  // Days until inspection (negative if overdue)
  daysUntilDue: number;
  // Is inspection due today or overdue
  isDueOrOverdue: boolean;
  // Is due tomorrow
  isDueTomorrow: boolean;
  // Is due in 3 days or less
  isDueSoon: boolean;
  // Human-readable message
  message: string;
}

export function useInspectionDueStatus(): InspectionDueStatus {
  return useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const currentMonthDate = getCurrentInspectionDate(now);
    const nextMonthDate = getNextInspectionDate(now);
    
    // Determine which inspection date to use (current or next month)
    let targetDate = currentMonthDate;
    if (isAfter(today, currentMonthDate)) {
      // Current month's inspection has passed, look at next month
      targetDate = nextMonthDate;
    }
    
    const daysUntilDue = differenceInDays(targetDate, today);
    const isDueOrOverdue = isSameDay(today, currentMonthDate) || (isAfter(today, currentMonthDate) && isSameMonth(today, currentMonthDate));
    const isDueTomorrow = daysUntilDue === 1;
    const isDueSoon = daysUntilDue <= 3 && daysUntilDue > 0;
    
    let message = "";
    if (isDueOrOverdue) {
      if (isSameDay(today, currentMonthDate)) {
        message = "Tarkastuspäivä on tänään!";
      } else {
        message = `Tarkastus myöhässä ${Math.abs(differenceInDays(today, currentMonthDate))} päivää`;
      }
    } else if (isDueTomorrow) {
      message = "Tarkastuspäivä on huomenna";
    } else if (isDueSoon) {
      message = `Tarkastuspäivä ${daysUntilDue} päivän päästä`;
    } else {
      message = `Seuraava tarkastus ${daysUntilDue} päivän päästä`;
    }
    
    return {
      currentMonthDate,
      nextMonthDate,
      daysUntilDue,
      isDueOrOverdue,
      isDueTomorrow,
      isDueSoon,
      message,
    };
  }, []);
}

/**
 * Generate all mileage logging dates (Mondays) and inspection dates for a given year/month range
 */
export function generateComplianceDates(startDate: Date, months: number = 12): {
  mileageDates: Date[];
  inspectionDates: Date[];
} {
  const mileageDates: Date[] = [];
  const inspectionDates: Date[] = [];
  
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  
  // Generate Mondays (mileage logging dates)
  let current = new Date(startDate);
  // Find first Monday
  while (current.getDay() !== 1) {
    current = addDays(current, 1);
  }
  
  while (isBefore(current, endDate)) {
    mileageDates.push(new Date(current));
    current = addDays(current, 7);
  }
  
  // Generate first working days of each month (inspection dates)
  current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (isBefore(current, endDate)) {
    inspectionDates.push(getFirstWorkingDayOfMonth(current));
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  
  return { mileageDates, inspectionDates };
}

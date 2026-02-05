import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { fi } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to Finnish style dd/MM/yyyy
 */
export function formatDate(date: Date | string | null | undefined, includeTime = false): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return format(d, includeTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy");
}

/**
 * Format date with weekday in Finnish (e.g., "maanantai 05/02/2026")
 */
export function formatDateWithWeekday(date: Date | string | null | undefined, includeTime = false): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return format(d, includeTime ? "EEEE dd/MM/yyyy 'klo' HH:mm" : "EEEE dd/MM/yyyy", { locale: fi });
}

/**
 * Format short date for chat messages (e.g., "05/02 14:30")
 */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return format(d, "dd/MM HH:mm");
}

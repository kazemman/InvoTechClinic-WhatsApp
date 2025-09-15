import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to dd/mm/year format
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format a date to dd/mm/year with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const dateStr = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  return `${dateStr} ${timeStr}`;
}

/**
 * Format time only
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Convert Date to datetime-local input format (YYYY-MM-DDTHH:mm) in local timezone
 * This avoids the timezone conversion issues with toISOString()
 */
export function dateToLocalDateTimeString(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  // Get local date and time components to avoid UTC conversion
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local input string to Date object, preserving local timezone
 * This ensures the date represents the exact time the user selected
 */
export function localDateTimeStringToDate(dateTimeString: string): Date {
  if (!dateTimeString) return new Date();
  
  // The datetime-local input provides YYYY-MM-DDTHH:mm format in local time
  // We create a Date object directly from this, which treats it as local time
  return new Date(dateTimeString);
}

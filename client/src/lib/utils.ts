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

/**
 * Round a date to the nearest 30-minute interval
 * This ensures appointments are scheduled in 30-minute slots
 */
export function roundToNearest30Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  
  // Round to nearest 30-minute interval
  if (minutes < 15) {
    rounded.setMinutes(0, 0, 0); // Round down to :00
  } else if (minutes < 45) {
    rounded.setMinutes(30, 0, 0); // Round to :30
  } else {
    rounded.setMinutes(0, 0, 0); // Round up to next hour :00
    rounded.setHours(rounded.getHours() + 1);
  }
  
  return rounded;
}

/**
 * Check if a date is aligned to a 30-minute boundary
 */
export function isAlignedTo30Minutes(date: Date): boolean {
  const minutes = date.getMinutes();
  return minutes === 0 || minutes === 30;
}

/**
 * Get the next available 30-minute slot from the current time
 * Useful for setting default appointment times
 */
export function getNextAvailable30MinuteSlot(): Date {
  const now = new Date();
  const next = new Date(now);
  
  // Add 30 minutes to current time as buffer
  next.setMinutes(next.getMinutes() + 30);
  
  // Round to next 30-minute boundary
  return roundToNearest30Minutes(next);
}

import { format, parseISO } from 'date-fns';
import { utcToZonedTime, formatInTimeZone } from 'date-fns-tz';

// Central Time Zone (handles CST/CDT automatically)
const CENTRAL_TIMEZONE = 'America/Chicago';

/**
 * Formats a date in Central Time
 * @param date - Date string (ISO format) or Date object
 * @param formatStr - Format string (default: 'MMM d, yyyy HH:mm')
 * @returns Formatted date string in Central Time
 */
export const formatInCentral = (
  date: string | Date,
  formatStr: string = 'MMM d, yyyy HH:mm'
): string => {
  if (!date) return '';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      // SQLite returns datetime as 'YYYY-MM-DD HH:MM:SS' (UTC)
      // Convert to ISO 8601 format: 'YYYY-MM-DDTHH:MM:SSZ'
      const sqliteFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (sqliteFormat.test(date)) {
        // Replace space with 'T' and add 'Z' to indicate UTC
        dateObj = parseISO(date.replace(' ', 'T') + 'Z');
      } else {
        // Already in ISO format or other format
        dateObj = parseISO(date);
      }
    } else {
      dateObj = date;
    }

    return formatInTimeZone(dateObj, CENTRAL_TIMEZONE, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return '';
  }
};

/**
 * Gets the current date/time in Central Time
 * @returns Date object in Central Time
 */
export const getCurrentCentralDate = (): Date => {
  return utcToZonedTime(new Date(), CENTRAL_TIMEZONE);
};

/**
 * Formats current Central Time date for date inputs (yyyy-MM-dd)
 * @returns Formatted date string for HTML date inputs
 */
export const getCurrentCentralDateForInput = (): string => {
  return formatInTimeZone(new Date(), CENTRAL_TIMEZONE, 'yyyy-MM-dd');
};

/**
 * Adds days to current date and returns in Central Time for date inputs
 * @param days - Number of days to add
 * @returns Formatted date string (yyyy-MM-dd)
 */
export const addDaysInCentral = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatInTimeZone(date, CENTRAL_TIMEZONE, 'yyyy-MM-dd');
};

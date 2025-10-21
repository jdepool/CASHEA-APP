/**
 * Get the Monday of the current week
 */
export function getMonday(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the Sunday of the current week
 */
export function getSunday(date: Date = new Date()): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/**
 * Get the Friday of the current week
 */
export function getFriday(date: Date = new Date()): Date {
  const monday = getMonday(date);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return friday;
}

/**
 * Check if a date falls within the current week (Monday-Sunday)
 */
export function isInCurrentWeek(date: Date | string): boolean {
  const checkDate = typeof date === 'string' ? parseExcelDate(date) : new Date(date);
  
  if (!checkDate || isNaN(checkDate.getTime())) {
    return false;
  }

  const monday = getMonday();
  monday.setHours(0, 0, 0, 0);
  
  const sunday = getSunday();
  sunday.setHours(23, 59, 59, 999);

  const checkTime = checkDate.getTime();
  return checkTime >= monday.getTime() && checkTime <= sunday.getTime();
}

/**
 * Parse Excel date formats (both serial numbers and date strings)
 */
export function parseExcelDate(value: any): Date | null {
  if (!value) return null;

  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }

  // If it's an Excel serial number
  if (typeof value === 'number') {
    // Excel serial date starts from December 31, 1899 (serial 1 = January 1, 1900)
    const excelEpoch = new Date(1899, 11, 31);
    let daysOffset = value;
    
    // Excel incorrectly considers 1900 a leap year
    // For dates after Feb 28, 1900 (serial >= 60), subtract 1 day to compensate
    if (value >= 60) {
      daysOffset = value - 1;
    }
    
    const date = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return date;
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    // Try DD/MM/YYYY format first
    const ddmmyyyyMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      return new Date(year, month, day);
    }

    // Try ISO format or other standard formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Format date as DD/MM/YYYY
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  
  const d = typeof date === 'string' ? parseExcelDate(date) : date;
  if (!d || isNaN(d.getTime())) return "";

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
}

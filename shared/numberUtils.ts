/**
 * Normalize a number string to a consistent numeric value
 * Handles various locale formats:
 * - "1,200.50" (US format - comma thousand, period decimal)
 * - "1.200,50" (European format - period thousand, comma decimal)
 * - "1200.50" (no thousand separator)
 * - "1,200" (US whole number with thousand separator)
 * - "1.200" (European whole number with thousand separator)
 */
export function normalizeNumber(value: any): number {
  // Handle already-numeric values
  if (typeof value === 'number') {
    return isNaN(value) ? NaN : value;
  }

  // Convert to string and trim
  const str = String(value).trim();
  
  if (!str) {
    return NaN;
  }

  // Remove currency symbols and other non-numeric characters except . , - and spaces
  let cleaned = str.replace(/[^\d.,-]/g, '');
  
  // Count occurrences of each separator
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;
  
  if (dotCount === 0 && commaCount === 0) {
    // No separators, just parse as is
    const parsed = parseFloat(cleaned);
    return parsed;
  }
  
  // Find last occurrence of each separator
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  
  // Count digits after last separator to detect decimal vs thousand separator
  let digitsAfterLastSep = 0;
  if (lastDot > lastComma) {
    digitsAfterLastSep = cleaned.length - lastDot - 1;
  } else if (lastComma > lastDot) {
    digitsAfterLastSep = cleaned.length - lastComma - 1;
  }
  
  // Determine separator types based on multiple factors:
  // 1. If there are multiple of the same separator, it's a thousand separator
  // 2. If digits after last separator is 2 or 3, it's likely a decimal separator
  // 3. If digits after last separator is not 2 or 3, it's likely a thousand separator
  
  if (dotCount > 1) {
    // Multiple dots = European thousand separator (e.g., "1.200.300,50")
    // Remove dots, convert comma to period
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (commaCount > 1) {
    // Multiple commas = US thousand separator (e.g., "1,200,300.50")
    // Remove commas
    cleaned = cleaned.replace(/,/g, '');
  } else if (dotCount === 1 && commaCount === 1) {
    // Both present once - determine by position
    if (lastDot > lastComma) {
      // Period is after comma: US format (1,200.50)
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Comma is after period: European format (1.200,50)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (dotCount === 1) {
    // Only one dot
    if (digitsAfterLastSep === 2) {
      // Exactly 2 digits after = decimal separator (e.g., "1200.50")
      // Keep as is
    } else if (digitsAfterLastSep === 3) {
      // 3 digits after: could be thousand separator OR decimal with 3 places
      // Only treat as thousand separator if there's strong evidence:
      // - The 3 digits are all zeros (e.g., "1.000", "12.000")
      // - OR the part before the separator looks like thousands (1-999)
      const afterSep = cleaned.substring(lastDot + 1);
      const beforeSep = cleaned.substring(0, lastDot);
      
      if (afterSep === '000') {
        // All zeros = thousand separator (e.g., "1.000" → 1000)
        cleaned = cleaned.replace(/\./g, '');
      } else if (beforeSep === '0' || beforeSep.startsWith('0.') || parseInt(beforeSep) === 0) {
        // Starts with 0 = decimal (e.g., "0.123" stays 0.123)
        // Keep as is
      } else if (beforeSep.length > 0 && beforeSep.length <= 3 && /^\d+$/.test(beforeSep)) {
        // 1-3 non-zero digits before, digits after not all zeros
        // Only treat as thousand separator if result would be >= 1000
        // This prevents "57.375" from becoming 57375 (clearly a decimal, not a thousand)
        const beforeNum = parseInt(beforeSep);
        if (beforeNum >= 100) {
          // e.g., "100.200" → 100200, "999.999" → 999999
          cleaned = cleaned.replace(/\./g, '');
        }
        // else: keep as decimal (e.g., "57.375" stays 57.375)
      } else {
        // Otherwise keep as decimal (e.g., "1234.567" with 4+ digits before)
        // Keep as is
      }
    } else if (digitsAfterLastSep === 0 || digitsAfterLastSep === 1) {
      // 0 or 1 digit = decimal (e.g., "1.2" or "1.")
      // Keep as is
    } else {
      // 4+ digits = probably an error or unusual format
      // Keep as is and let parseFloat handle it
    }
  } else if (commaCount === 1) {
    // Only one comma
    if (digitsAfterLastSep === 2) {
      // Exactly 2 digits after = decimal separator (e.g., "1200,50")
      cleaned = cleaned.replace(',', '.');
    } else if (digitsAfterLastSep === 3) {
      // 3 digits after: could be thousand separator OR decimal with 3 places
      const afterSep = cleaned.substring(lastComma + 1);
      const beforeSep = cleaned.substring(0, lastComma);
      
      if (afterSep === '000') {
        // All zeros = thousand separator (e.g., "1,000" → 1000)
        cleaned = cleaned.replace(/,/g, '');
      } else if (beforeSep === '0' || beforeSep.startsWith('0,') || parseInt(beforeSep) === 0) {
        // Starts with 0 = decimal (e.g., "0,123" → "0.123")
        cleaned = cleaned.replace(',', '.');
      } else if (beforeSep.length > 0 && beforeSep.length <= 3 && /^\d+$/.test(beforeSep)) {
        // 1-3 non-zero digits before, digits after not all zeros
        // Only treat as thousand separator if result would be >= 1000
        const beforeNum = parseInt(beforeSep);
        if (beforeNum >= 100) {
          // e.g., "100,200" → 100200, "999,999" → 999999
          cleaned = cleaned.replace(/,/g, '');
        } else {
          // else: treat as decimal (e.g., "57,375" → "57.375")
          cleaned = cleaned.replace(',', '.');
        }
      } else {
        // Otherwise treat as decimal (e.g., "0,123" → "0.123")
        cleaned = cleaned.replace(',', '.');
      }
    } else if (digitsAfterLastSep === 0 || digitsAfterLastSep === 1) {
      // 0 or 1 digit = decimal (e.g., "1,2" or "1,")
      cleaned = cleaned.replace(',', '.');
    } else {
      // 4+ digits = probably an error or unusual format
      cleaned = cleaned.replace(',', '.');
    }
  }
  
  const parsed = parseFloat(cleaned);
  return parsed; // Return NaN if parsing fails
}

/**
 * Normalize a number to a consistent string representation for comparison
 * Uses 8 decimal places to ensure precision while allowing comparison
 * Returns empty string for invalid values
 */
export function normalizeNumberForKey(value: any): string {
  const num = normalizeNumber(value);
  if (isNaN(num)) {
    return ''; // Invalid number
  }
  return num.toFixed(8);
}

/**
 * Normalize a reference number by removing leading zeros for comparison
 * Examples:
 * - "000437506838" → "437506838"
 * - "00123" → "123"
 * - "0" → "0"
 * - "" → ""
 * - null → ""
 * - undefined → ""
 */
export function normalizeReferenceNumber(value: any): string {
  // Handle null/undefined
  if (value == null) {
    return '';
  }
  
  // Convert to string and trim
  const str = String(value).trim();
  
  // Return empty string for empty values
  if (!str) {
    return '';
  }
  
  // Remove leading zeros but keep at least one digit
  // "000" becomes "0", "00123" becomes "123"
  const normalized = str.replace(/^0+/, '') || '0';
  
  return normalized;
}

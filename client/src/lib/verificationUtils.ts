import { normalizeNumber } from '@shared/numberUtils';

/**
 * Normalizes a reference string by removing spaces, leading zeros, and converting to lowercase
 */
export function normalizeReference(ref: any): string {
  return String(ref).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();
}

/**
 * Checks if two references match using 8-digit partial matching logic.
 * Supports:
 * - Exact match
 * - One reference contains the other (e.g., "18115088341384" contains "115088341384")
 * - At least 8 consecutive digits match (checks BOTH directions)
 * - Last 8 digits match (common case for partial references)
 */
export function referencesMatch(ref1: string, ref2: string): boolean {
  const normalized1 = normalizeReference(ref1);
  const normalized2 = normalizeReference(ref2);
  
  // Exact match
  if (normalized1 === normalized2) {
    return true;
  }
  
  // Extract only digits for numeric comparison
  const digits1 = normalized1.replace(/\D/g, '');
  const digits2 = normalized2.replace(/\D/g, '');
  
  // Check if either has at least 8 digits
  if (digits1.length < 8 && digits2.length < 8) {
    return false;
  }
  
  // Check if one contains the other (handles prefix/suffix cases like "18" + "115088341384")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Check if last 8 digits match (common case for bank references with extra prefix)
  if (digits1.length >= 8 && digits2.length >= 8) {
    const last8_1 = digits1.slice(-8);
    const last8_2 = digits2.slice(-8);
    if (last8_1 === last8_2) {
      return true;
    }
  }
  
  // Check for 8-digit substring match in BOTH directions
  // Check if any 8-digit substring of ref1 exists in ref2
  for (let i = 0; i <= digits1.length - 8; i++) {
    const substring = digits1.substring(i, i + 8);
    if (digits2.includes(substring)) {
      return true;
    }
  }
  
  // Check if any 8-digit substring of ref2 exists in ref1
  for (let i = 0; i <= digits2.length - 8; i++) {
    const substring = digits2.substring(i, i + 8);
    if (digits1.includes(substring)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if two amounts match within a tolerance of ±$0.01
 */
export function amountsMatch(amount1: number, amount2: number, tolerance: number = 0.01): boolean {
  return Math.abs(amount1 - amount2) <= tolerance;
}

/**
 * Interface for verification parameters
 */
export interface VerificationParams {
  reference: any;
  amountVES?: any;
  amountUSD?: any;
}

/**
 * Interface for bank statement row data
 */
export interface BankStatementRow {
  [key: string]: any;
}

/**
 * Verifies if a payment/transaction exists in bank statements.
 * Returns "SI" if found, "NO" if not found.
 * 
 * Matching logic:
 * - Reference: 8-digit partial matching (handles prefixes like "18" in bank refs)
 * - Amount: ±$0.01 tolerance, checks both Debe and Haber columns against both VES and USD amounts
 */
export function verifyInBankStatements(
  params: VerificationParams,
  bankStatementRows: BankStatementRow[],
  bankStatementHeaders: string[]
): string {
  // If no bank statements available, return "NO"
  if (!bankStatementRows || bankStatementRows.length === 0) {
    return 'NO';
  }

  const { reference, amountVES, amountUSD } = params;

  // If no reference or amounts, can't verify
  if (!reference || (!amountVES && !amountUSD)) {
    return 'NO';
  }

  // Find relevant headers in bank statement (case-insensitive)
  const referenciaHeader = bankStatementHeaders?.find(h => 
    h.toLowerCase().includes('referencia')
  );
  const debeHeader = bankStatementHeaders?.find(h => 
    h.toLowerCase().includes('debe')
  );
  const haberHeader = bankStatementHeaders?.find(h => 
    h.toLowerCase().includes('haber')
  );

  // Normalize payment amounts
  const normalizedVES = amountVES ? normalizeNumber(amountVES) : null;
  const normalizedUSD = amountUSD ? normalizeNumber(amountUSD) : null;

  // Search bank statements for matching reference and amount
  const found = bankStatementRows.some(bankRow => {
    // Check reference match
    if (referenciaHeader) {
      const bankRef = bankRow[referenciaHeader];
      if (bankRef) {
        if (!referencesMatch(reference, bankRef)) {
          return false; // Reference doesn't match
        }
      } else {
        return false; // No reference in bank statement
      }
    } else {
      return false; // No reference header in bank statement
    }

    // Reference matches, now check amount
    // Check both Debe and Haber columns
    let amountFound = false;

    if (debeHeader) {
      const debeAmount = bankRow[debeHeader];
      if (debeAmount !== null && debeAmount !== undefined) {
        const normalizedDebe = normalizeNumber(debeAmount);
        if (!isNaN(normalizedDebe)) {
          // Check against both VES and USD amounts (bank could have either)
          if (normalizedVES !== null && amountsMatch(normalizedDebe, normalizedVES)) {
            amountFound = true;
          }
          if (normalizedUSD !== null && amountsMatch(normalizedDebe, normalizedUSD)) {
            amountFound = true;
          }
        }
      }
    }

    if (haberHeader && !amountFound) {
      const haberAmount = bankRow[haberHeader];
      if (haberAmount !== null && haberAmount !== undefined) {
        const normalizedHaber = normalizeNumber(haberAmount);
        if (!isNaN(normalizedHaber)) {
          // Check against both VES and USD amounts
          if (normalizedVES !== null && amountsMatch(normalizedHaber, normalizedVES)) {
            amountFound = true;
          }
          if (normalizedUSD !== null && amountsMatch(normalizedHaber, normalizedUSD)) {
            amountFound = true;
          }
        }
      }
    }

    return amountFound;
  });

  return found ? 'SI' : 'NO';
}

/**
 * Reverse lookup: verifies if a bank statement transaction matches any payment record.
 * Returns "SI" if found, "NO" if not found.
 * 
 * This is the opposite of verifyInBankStatements - it checks if a bank transaction
 * has a corresponding payment record.
 */
export function verifyInPaymentRecords(
  bankRef: any,
  bankAmountDebe: any,
  bankAmountHaber: any,
  paymentRecords: any[],
  paymentHeaders: string[]
): string {
  // If no payment records available, return "NO"
  if (!paymentRecords || paymentRecords.length === 0) {
    return 'NO';
  }

  // If no reference or amounts, can't verify
  if (!bankRef || (!bankAmountDebe && !bankAmountHaber)) {
    return 'NO';
  }

  // Find relevant headers in payment records (case-insensitive)
  const referenciaHeader = paymentHeaders?.find(h => 
    h.toLowerCase().includes('referencia')
  );
  const montoVESHeader = paymentHeaders?.find(h => 
    h.toLowerCase().includes('monto') && h.toLowerCase().includes('ves')
  );
  const montoUSDHeader = paymentHeaders?.find(h => 
    h.toLowerCase().includes('monto') && h.toLowerCase().includes('usd')
  );

  // Normalize bank amounts
  const normalizedDebe = bankAmountDebe ? normalizeNumber(bankAmountDebe) : null;
  const normalizedHaber = bankAmountHaber ? normalizeNumber(bankAmountHaber) : null;

  // Use whichever bank amount exists (Debe or Haber)
  const bankAmount = normalizedDebe || normalizedHaber;
  if (!bankAmount || isNaN(bankAmount)) {
    return 'NO';
  }

  // Search payment records for matching reference and amount
  const found = paymentRecords.some(paymentRow => {
    // Check reference match
    if (referenciaHeader) {
      const paymentRef = paymentRow[referenciaHeader];
      if (paymentRef) {
        if (!referencesMatch(bankRef, paymentRef)) {
          return false; // Reference doesn't match
        }
      } else {
        return false; // No reference in payment record
      }
    } else {
      return false; // No reference header in payment records
    }

    // Reference matches, now check amount
    // Check both VES and USD payment amounts
    let amountFound = false;

    if (montoVESHeader) {
      const vesAmount = paymentRow[montoVESHeader];
      if (vesAmount !== null && vesAmount !== undefined) {
        const normalizedVES = normalizeNumber(vesAmount);
        if (!isNaN(normalizedVES) && amountsMatch(bankAmount, normalizedVES)) {
          amountFound = true;
        }
      }
    }

    if (montoUSDHeader && !amountFound) {
      const usdAmount = paymentRow[montoUSDHeader];
      if (usdAmount !== null && usdAmount !== undefined) {
        const normalizedUSD = normalizeNumber(usdAmount);
        if (!isNaN(normalizedUSD) && amountsMatch(bankAmount, normalizedUSD)) {
          amountFound = true;
        }
      }
    }

    return amountFound;
  });

  return found ? 'SI' : 'NO';
}

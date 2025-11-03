import { useState, useMemo } from "react";
import { normalizeNumber } from "@shared/numberUtils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface PaymentRecord {
  [key: string]: any;
}

interface PaymentRecordsTableProps {
  records: PaymentRecord[];
  headers: string[];
  ordersData: any[];
  bankStatementRows: any[];
  bankStatementHeaders: string[];
}

export function PaymentRecordsTable({ records, headers, ordersData, bankStatementRows, bankStatementHeaders }: PaymentRecordsTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Build a map of order numbers to their status from ordersData
  const orderStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    ordersData.forEach((order) => {
      const ordenNum = order["Orden"];
      const statusOrden = order["Status Orden"] || order["STATUS ORDEN"] || order["status orden"];
      if (ordenNum != null && statusOrden != null) {
        map.set(String(ordenNum), String(statusOrden));
      }
    });
    return map;
  }, [ordersData]);

  // Function to verify if a payment exists in bank statements
  const verifyPaymentInBankStatement = useMemo(() => {
    // Find relevant headers in bank statement (case-insensitive)
    const referenciaHeader = bankStatementHeaders.find(h => 
      h.toLowerCase().includes('referencia')
    );
    const debeHeader = bankStatementHeaders.find(h => 
      h.toLowerCase().includes('debe')
    );
    const haberHeader = bankStatementHeaders.find(h => 
      h.toLowerCase().includes('haber')
    );

    return (record: PaymentRecord): string => {
      // If no bank statements available, return "NO"
      if (!bankStatementRows || bankStatementRows.length === 0) {
        return 'NO';
      }

      const paymentRef = record['# Referencia'];
      // Handle case-insensitive column name matching
      const paymentAmountVES = record['Monto Pagado en VES'] || record['Monto pagado en VES'];
      const paymentAmountUSD = record['Monto Pagado en USD'] || record['Monto pagado en USD'];

      // If no reference or amounts, can't verify
      if (!paymentRef || (!paymentAmountVES && !paymentAmountUSD)) {
        return 'NO';
      }

      // Normalize payment reference (remove spaces, leading zeros)
      const normalizedPaymentRef = String(paymentRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();

      // Normalize payment amounts
      const normalizedVES = paymentAmountVES ? normalizeNumber(paymentAmountVES) : null;
      const normalizedUSD = paymentAmountUSD ? normalizeNumber(paymentAmountUSD) : null;

      // Search bank statements for matching reference and amount
      const found = bankStatementRows.some(bankRow => {
        // Check reference match
        if (referenciaHeader) {
          const bankRef = bankRow[referenciaHeader];
          if (bankRef) {
            const normalizedBankRef = String(bankRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();
            if (normalizedBankRef !== normalizedPaymentRef) {
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
          if (debeAmount) {
            const normalizedDebe = normalizeNumber(debeAmount);
            if (!isNaN(normalizedDebe)) {
              // Check against both VES and USD amounts (bank could have either)
              if (normalizedVES !== null && Math.abs(normalizedDebe - normalizedVES) < 0.01) {
                amountFound = true;
              }
              if (normalizedUSD !== null && Math.abs(normalizedDebe - normalizedUSD) < 0.01) {
                amountFound = true;
              }
            }
          }
        }

        if (haberHeader && !amountFound) {
          const haberAmount = bankRow[haberHeader];
          if (haberAmount) {
            const normalizedHaber = normalizeNumber(haberAmount);
            if (!isNaN(normalizedHaber)) {
              // Check against both VES and USD amounts
              if (normalizedVES !== null && Math.abs(normalizedHaber - normalizedVES) < 0.01) {
                amountFound = true;
              }
              if (normalizedUSD !== null && Math.abs(normalizedHaber - normalizedUSD) < 0.01) {
                amountFound = true;
              }
            }
          }
        }

        return amountFound;
      });

      return found ? 'SI' : 'NO';
    };
  }, [bankStatementRows, bankStatementHeaders]);
  
  // Enrich records with Status Orden and read VERIFICACION from stored data
  const enrichedRecords = useMemo(() => {
    return records.map(record => {
      const ordenNum = record['# Orden'];
      const statusOrden = ordenNum != null 
        ? (orderStatusMap.get(String(ordenNum)) || 'NOT FOUND')
        : 'NOT FOUND';
      
      // Read VERIFICACION from stored data (calculated server-side during upload)
      const verificacion = record['VERIFICACION'] || 'NO';
      
      const enriched: PaymentRecord = {
        ...record,
        'Status Orden': statusOrden,
        'VERIFICACION': verificacion
      };
      return enriched;
    });
  }, [records, orderStatusMap]);
  
  // Define the desired column order patterns (case-insensitive)
  const desiredOrderPatterns = [
    { pattern: /^#\s*orden$/i, display: '# Orden' },
    { pattern: /^#\s*cuota\s*pagada$/i, display: '# Cuota Pagada' },
    { pattern: /^status\s*orden$/i, display: 'Status Orden' },
    { pattern: /^monto\s*pagado\s*en\s*ves$/i, display: 'Monto Pagado en VES' },
    { pattern: /^#\s*referencia$/i, display: '# Referencia' },
    { pattern: /^verificacion$/i, display: 'VERIFICACION' },
    { pattern: /^m[eé]todo\s*de\s*pago$/i, display: 'Método de Pago' },
    { pattern: /^monto\s*pagado\s*en\s*usd$/i, display: 'Monto Pagado en USD' },
    { pattern: /^tasa\s*de\s*cambio$/i, display: 'Tasa de Cambio' },
    { pattern: /^fecha\s*tasa\s*de\s*cambio$/i, display: 'Fecha Tasa de Cambio' }
  ];
  
  // Columns to hide (case-insensitive)
  const hiddenPatterns = [/factura/i, /sucursal/i, /monto\s*asignado/i];
  
  // Helper function to find header by pattern (also check enriched columns)
  const findHeaderByPattern = (pattern: RegExp) => {
    // First check if it's an enriched column
    if (pattern.test('Status Orden')) {
      return 'Status Orden';
    }
    if (pattern.test('VERIFICACION')) {
      return 'VERIFICACION';
    }
    // Then check original headers
    return headers.find(h => pattern.test(h));
  };
  
  // Build ordered headers by finding actual headers that match patterns
  const orderedHeaders: string[] = [];
  desiredOrderPatterns.forEach(({ pattern }) => {
    const matchedHeader = findHeaderByPattern(pattern);
    if (matchedHeader) {
      orderedHeaders.push(matchedHeader);
    }
  });
  
  // Add any extra columns that don't match desired or hidden patterns
  const extraColumns = headers.filter(h => 
    !hiddenPatterns.some(hidden => hidden.test(h)) &&
    !desiredOrderPatterns.some(({ pattern }) => pattern.test(h))
  );
  
  orderedHeaders.push(...extraColumns);

  // Build a map of expected installment amounts: (Order#, Installment#) => Expected Amount
  const expectedAmountsMap = new Map<string, number>();
  
  ordersData.forEach((order) => {
    const ordenNum = order["Orden"];
    if (ordenNum == null) return;
    
    // Extract expected amounts for installments 1-14 (including zero)
    for (let i = 1; i <= 14; i++) {
      const expectedAmountRaw = order[`Cuota ${i}`];
      if (expectedAmountRaw != null) { // Allow 0, skip only null/undefined
        const amount = normalizeNumber(expectedAmountRaw);
        // Only store valid amounts (skip NaN)
        if (!isNaN(amount)) {
          expectedAmountsMap.set(`${ordenNum}_${i}`, amount);
        }
      }
    }
  });

  // Build a map to detect duplicates (same Order + Cuota Pagada + Referencia combination)
  const duplicateMap = useMemo(() => {
    const countMap = new Map<string, number>();
    
    enrichedRecords.forEach((record) => {
      const ordenNum = record['# Orden'];
      const cuotaNum = record['# Cuota Pagada'];
      const referencia = record['# Referencia'];
      
      if (ordenNum != null && cuotaNum != null && referencia != null) {
        const key = `${ordenNum}_${cuotaNum}_${referencia}`;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    });
    
    return countMap;
  }, [enrichedRecords]);

  // Check if a payment is a duplicate (same Order + Cuota + Referencia appears more than once)
  const isDuplicatePayment = (record: PaymentRecord): boolean => {
    const ordenNum = record['# Orden'];
    const cuotaNum = record['# Cuota Pagada'];
    const referencia = record['# Referencia'];
    
    if (ordenNum == null || cuotaNum == null || referencia == null) return false;
    
    const key = `${ordenNum}_${cuotaNum}_${referencia}`;
    const count = duplicateMap.get(key) || 0;
    
    return count > 1;
  };

  // Check if a payment is partial (paid less than expected)
  const isPartialPayment = (record: PaymentRecord): boolean => {
    const ordenNum = record['# Orden'];
    const cuotaNum = record['# Cuota Pagada'];
    // Use "Monto Pagado en USD" (actual amount paid in USD) for comparison
    const amountPaidRaw = record['Monto Pagado en USD'];
    
    // Skip only if critical fields are null/undefined (0 is valid)
    if (ordenNum == null || cuotaNum == null || amountPaidRaw == null) return false;
    
    // Parse comma-separated cuota numbers (e.g., "4,5" means cuotas 4 AND 5)
    const cuotaNumbers = String(cuotaNum).split(',').map(c => c.trim()).filter(c => c);
    
    // Calculate total expected amount by summing all cuotas in this payment
    let totalExpectedAmount = 0;
    let foundAtLeastOne = false;
    
    for (const cuota of cuotaNumbers) {
      const key = `${ordenNum}_${cuota}`;
      const expectedAmount = expectedAmountsMap.get(key);
      
      if (expectedAmount != null) {
        totalExpectedAmount += expectedAmount;
        foundAtLeastOne = true;
      }
    }
    
    // If no expected amounts found, can't determine if partial
    if (!foundAtLeastOne) return false;
    
    // Normalize payment amount using locale-aware parser
    const paidAmount = normalizeNumber(amountPaidRaw);
    
    // Skip if amount failed to parse
    if (isNaN(paidAmount)) return false;
    
    // Consider partial if paid amount is less than expected by more than $0.25 tolerance
    return paidAmount < (totalExpectedAmount - 0.25);
  };

  const formatValue = (value: any, header: string) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const headerLower = header.toLowerCase();
    
    // Check if this is a Referencia column - prevent scientific notation
    if (headerLower.includes('referencia')) {
      const valueStr = String(value);
      // Check if it's in scientific notation
      if (valueStr.includes('E') || valueStr.includes('e')) {
        // Convert scientific notation to full number
        // Reference numbers should be integers, use round to handle floating point errors
        try {
          const scientificValue = Number(valueStr);
          if (!isNaN(scientificValue) && Math.abs(scientificValue) < Number.MAX_SAFE_INTEGER) {
            // For safe integers, round and convert to string
            // Use round instead of floor to handle floating point representation errors
            return Math.round(scientificValue).toString();
          } else {
            // For very large numbers, keep original
            return valueStr;
          }
        } catch (e) {
          return valueStr;
        }
      }
      return valueStr;
    }
    
    // Check if this is a currency column (VES or USD)
    if (headerLower.includes('ves') || headerLower.includes('usd') || headerLower.includes('monto')) {
      // Use locale-aware parser to handle different number formats
      const numValue = normalizeNumber(value);
      
      // Handle invalid numbers
      if (isNaN(numValue)) {
        return String(value); // Show original value if can't parse
      }

      const currency = headerLower.includes('ves') ? 'VES' : 'USD';
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numValue);
    }

    return String(value);
  };

  const isNumericColumn = (header: string) => {
    const headerLower = header.toLowerCase();
    return headerLower.includes('monto') || headerLower.includes('ves') || headerLower.includes('usd');
  };

  const handleSort = (header: string) => {
    if (sortColumn === header) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(header);
      setSortDirection('asc');
    }
  };

  const sortedRecords = useMemo(() => {
    if (!sortColumn) return enrichedRecords;

    return [...enrichedRecords].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Handle currency values
      if (isNumericColumn(sortColumn)) {
        const aNum = normalizeNumber(aVal);
        const bNum = normalizeNumber(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
      }

      // Handle strings
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [enrichedRecords, sortColumn, sortDirection]);

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-state">
        No hay registros de pago para mostrar
      </div>
    );
  }

  return (
    <div className="relative w-full border rounded-md overflow-auto" style={{ maxHeight: '70vh' }}>
      <table className="w-full border-collapse text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead className="sticky top-0 z-10 bg-muted shadow-sm">
          <tr>
            {orderedHeaders.map((header, idx) => (
              <th
                key={idx}
                onClick={() => handleSort(header)}
                className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap cursor-pointer hover-elevate ${
                  isNumericColumn(header) ? 'text-right' : 'text-left'
                } ${idx === 0 ? 'sticky left-0 z-20 bg-muted' : ''}`}
                data-testid={`header-${idx}`}
              >
                <div className={`flex items-center gap-1 ${isNumericColumn(header) ? 'justify-end' : 'justify-start'}`}>
                  <span>{header}</span>
                  {sortColumn === header ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRecords.map((record, rowIdx) => {
            const isDuplicate = isDuplicatePayment(record);
            return (
              <tr
                key={rowIdx}
                className={`border-b hover-elevate ${isDuplicate ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}
                data-testid={`row-${rowIdx}`}
              >
                {orderedHeaders.map((header, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-4 py-3 whitespace-nowrap ${
                      isNumericColumn(header) ? 'text-right font-mono' : ''
                    } ${colIdx === 0 ? 'sticky left-0 z-10 bg-card' : ''}`}
                    data-testid={`cell-${rowIdx}-${colIdx}`}
                  >
                    {formatValue(record[header], header)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

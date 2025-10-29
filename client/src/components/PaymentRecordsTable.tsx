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
}

export function PaymentRecordsTable({ records, headers, ordersData }: PaymentRecordsTableProps) {
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
  
  // Enrich records with Status Orden lookup
  const enrichedRecords = useMemo(() => {
    return records.map(record => {
      const ordenNum = record['# Orden'];
      const statusOrden = ordenNum != null 
        ? (orderStatusMap.get(String(ordenNum)) || 'NOT FOUND')
        : 'NOT FOUND';
      
      const enriched: PaymentRecord = {
        ...record,
        'Status Orden': statusOrden
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

    // Check if this is a currency column (VES or USD)
    const headerLower = header.toLowerCase();
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

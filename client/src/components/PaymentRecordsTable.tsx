import { normalizeNumber } from "@shared/numberUtils";

interface PaymentRecord {
  [key: string]: any;
}

interface PaymentRecordsTableProps {
  records: PaymentRecord[];
  headers: string[];
  ordersData: any[];
}

export function PaymentRecordsTable({ records, headers, ordersData }: PaymentRecordsTableProps) {
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

  // Check if a payment is partial (paid less than expected)
  const isPartialPayment = (record: PaymentRecord): boolean => {
    const ordenNum = record['# Orden'];
    const cuotaNum = record['# Cuota Pagada'];
    // Use "Monto Pagado en USD" (actual amount paid in USD) for comparison
    const amountPaidRaw = record['Monto Pagado en USD'];
    
    // Skip only if critical fields are null/undefined (0 is valid)
    if (ordenNum == null || cuotaNum == null || amountPaidRaw == null) return false;
    
    const key = `${ordenNum}_${cuotaNum}`;
    const expectedAmount = expectedAmountsMap.get(key);
    
    // If no expected amount found, can't determine if partial
    if (expectedAmount == null) return false;
    
    // Normalize payment amount using locale-aware parser
    const paidAmount = normalizeNumber(amountPaidRaw);
    
    // Skip if amount failed to parse
    if (isNaN(paidAmount)) return false;
    
    // Consider partial if paid amount is less than expected by more than $0.25 tolerance
    return paidAmount < (expectedAmount - 0.25);
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

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-state">
        No hay registros de pago para mostrar
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-auto border rounded-md">
      <table className="w-full border-collapse text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap ${
                  isNumericColumn(header) ? 'text-right' : 'text-left'
                }`}
                data-testid={`header-${idx}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, rowIdx) => {
            const isPartial = isPartialPayment(record);
            return (
              <tr
                key={rowIdx}
                className={`border-b hover-elevate ${isPartial ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}
                data-testid={`row-${rowIdx}`}
              >
                {headers.map((header, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-4 py-3 whitespace-nowrap ${
                      isNumericColumn(header) ? 'text-right font-mono' : ''
                    }`}
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

interface PaymentRecord {
  [key: string]: any;
}

interface PaymentRecordsTableProps {
  records: PaymentRecord[];
  headers: string[];
}

export function PaymentRecordsTable({ records, headers }: PaymentRecordsTableProps) {
  const formatValue = (value: any, header: string) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    // Check if this is a currency column (VES or USD)
    const headerLower = header.toLowerCase();
    if (headerLower.includes('ves') || headerLower.includes('usd')) {
      const numValue = typeof value === 'number' 
        ? value 
        : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;

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
          {records.map((record, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b hover-elevate"
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

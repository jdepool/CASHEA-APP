interface PaymentRecord {
  [key: string]: any;
}

interface PaymentRecordsTableProps {
  records: PaymentRecord[];
}

export function PaymentRecordsTable({ records }: PaymentRecordsTableProps) {
  const formatCurrency = (value: any, currency: 'VES' | 'USD') => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const numValue = typeof value === 'number' 
      ? value 
      : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;

    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
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
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap" data-testid="header-orden">
              # Orden
            </th>
            <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap" data-testid="header-cuota">
              # Cuota Pagada
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap" data-testid="header-ves">
              Monto Pagado en VES
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap" data-testid="header-referencia">
              # Referencia
            </th>
            <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap" data-testid="header-usd">
              Monto Pagado en USD
            </th>
            <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap" data-testid="header-metodo">
              Método de Pago
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, idx) => (
            <tr
              key={idx}
              className="border-b hover-elevate"
              data-testid={`row-${idx}`}
            >
              <td className="px-4 py-3 whitespace-nowrap" data-testid={`cell-orden-${idx}`}>
                {record["# Orden"] || "-"}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap" data-testid={`cell-cuota-${idx}`}>
                {record["# Cuota Pagada"] || "-"}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap font-mono" data-testid={`cell-ves-${idx}`}>
                {formatCurrency(record["Monto Pagado en VES"], 'VES')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap" data-testid={`cell-referencia-${idx}`}>
                {record["# Referencia"] || "-"}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap font-mono" data-testid={`cell-usd-${idx}`}>
                {formatCurrency(record["Monto Pagado en USD"], 'USD')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap" data-testid={`cell-metodo-${idx}`}>
                {record["Metodo de Pago"] || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
